import { randomUUID } from 'node:crypto';
import { Indent, Receipt, Outbox, transaction } from '../database/models.js';
import { assert, AppError } from './terminologyService.js';
import { readOrder, dispenseResource } from './fhirService.js';
import { validateFormulation, temperaturePolicy } from './rxnormService.js';
import { appendAudit } from './auditService.js';
import { safeNotification } from './notificationService.js';
import { parseDelivery, acknowledge } from './hl7Service.js';
import { couriers } from '../fixtures.js';

export function assertScope(user, indent) {
  assert(indent, 'NOT_FOUND', 'Request not found.', 404);
  if (user.role === 'pharmacist' || user.role === 'auditor') return;
  if (user.role === 'nurse') {
    assert(indent.nurseId === user._id, 'NOT_FOUND', 'Request not found.', 404);
    return;
  }
  assert(
    user.floors &&
      user.floors.map((f) => f.toLowerCase()).includes(indent.floor.toLowerCase()),
    'NOT_FOUND',
    'Request not found.',
    404
  );
}

export async function getIndent(id, user) {
  const i = await Indent.findById(id).lean();
  assertScope(user, i);
  return i;
}

export async function validateAgainstOrder(input, user) {
  const order = await readOrder(input.prescriptionId, user);
  assert(
    input.dose === order.dose &&
      input.unit === order.unit &&
      input.route === order.route,
    'DOSE_MISMATCH',
    'Dose, UCUM units and route must exactly match the prescription. No automatic conversions are performed.'
  );
  const validation = await validateFormulation(input.requestedName, order.rxcui);
  return { order, validation };
}

export async function createIndent(input, user) {
  const { order, validation } = await validateAgainstOrder(input, user);
  const now = new Date().toISOString();
  const patientRef = input.patientRef
    ? input.patientRef.startsWith('Patient/')
      ? input.patientRef
      : `Patient/${input.patientRef}`
    : order.patientRef;
  const doc = {
    _id: randomUUID(),
    prescriptionId: input.prescriptionId,
    nurseId: user._id,
    nurseName: input.nurseName || user.name || 'Nurse Jamie (NURSE-552)',
    floor: input.floor || order.floor || 'IPD-3',
    room: input.room || '402',
    bed: input.bed || 'Bed B',
    patientRef,
    encounterRef: order.encounterRef,
    requestedName: input.requestedName,
    rxcui: order.rxcui,
    dose: input.dose,
    unit: input.unit,
    route: input.route,
    orderHash: order.orderHash,
    order,
    validation,
    status: 'requested',
    createdAt: now,
    updatedAt: now
  };
  await transaction(async (s) => {
    await appendAudit(s, {
      actor: user._id,
      action: 'INDENT_CREATED',
      entityId: doc._id
    });
    const duplicate = await Indent.exists({
      prescriptionId: input.prescriptionId,
      status: {
        $in: ['requested', 'validated', 'packed', 'dispatch-pending', 'dispatched']
      }
    }).session(s);
    assert(
      !duplicate,
      'DUPLICATE_INDENT',
      'An active request already exists for this prescription.',
      409
    );
    await Indent.create([doc], { session: s });
  });
  return doc;
}

async function freshCheck(indent, user) {
  const result = await validateAgainstOrder(indent, user);
  assert(
    result.order.orderHash === indent.orderHash,
    'ORDER_CHANGED',
    'The prescription or encounter changed. Cancel this request and create a new one.',
    409
  );
  return result;
}

export async function transition(id, user, action, input = {}) {
  const before = await getIndent(id, user);
  if (action === 'validate' || action === 'pack') await freshCheck(before, user);
  return transaction(async (s) => {
    const i = await Indent.findById(id).session(s);
    assertScope(user, i);
    const now = new Date().toISOString();
    if (action === 'validate') {
      assert(
        i.status === 'requested',
        'STATE_CONFLICT',
        'Only a requested indent can be approved.',
        409
      );
      i.status = 'validated';
    } else if (action === 'pack') {
      assert(
        i.status === 'validated',
        'STATE_CONFLICT',
        'Approve the request before packing.',
        409
      );
      const policy = temperaturePolicy(i.rxcui, input.temperature);
      assert(
        Date.parse(input.expiresAt) > Date.now(),
        'LOT_EXPIRED',
        'This batch is expired.'
      );
      i.packed = {
        at: now,
        by: user._id,
        temperature: input.temperature,
        lot: input.lot,
        expiresAt: input.expiresAt,
        policy
      };
      i.status = 'packed';
    } else if (action === 'cancel') {
      assert(
        ['requested', 'validated', 'packed'].includes(i.status),
        'STATE_CONFLICT',
        'A departed or completed delivery cannot be cancelled.',
        409
      );
      i.status = 'cancelled';
    } else if (action === 'receive') {
      assert(
        i.status === 'dispatched',
        'STATE_CONFLICT',
        'Wait until dispatch is recorded in the chart.',
        409
      );
      i.status = 'received';
    } else throw new AppError(400, 'ACTION_INVALID', 'Unknown action.');
    i.updatedAt = now;
    await i.save({ session: s });
    await appendAudit(s, {
      actor: user._id,
      action: {
        validate: 'INDENT_VALIDATED',
        pack: 'MEDICATION_PACKED',
        cancel: 'INDENT_CANCELLED',
        receive: 'DELIVERY_RECEIVED'
      }[action],
      entityId: i._id
    });
    return i.toObject();
  });
}

export async function dispatch(raw, user) {
  const e = parseDelivery(raw);
  const before = await getIndent(e.indentId, user);
  const prior = await Receipt.findById(e.receiptId).lean();
  if (prior) {
    assert(
      prior.digest === e.digest && prior.indentId === e.indentId,
      'REPLAY_CONFLICT',
      'This message ID was already used for different content.',
      409
    );
    return { indent: before, duplicate: true, ack: acknowledge(e) };
  }
  assert(
    before.status === 'packed',
    'STATE_CONFLICT',
    'Pack this request before processing departure.',
    409
  );
  await freshCheck(before, user);
  assert(
    e.prescriptionId === before.prescriptionId &&
      e.patientRef === before.patientRef,
    'HL7_PATIENT_ORDER_MISMATCH',
    'HL7 patient/order does not match the packed request.'
  );
  assert(
    e.rxcui === before.rxcui &&
      e.dose === before.dose &&
      e.unit === before.unit &&
      e.route === before.route,
    'HL7_MEDICATION_MISMATCH',
    'The HL7 formulation, dose or route does not match.'
  );
  await validateFormulation(e.drugName, before.rxcui);
  temperaturePolicy(before.rxcui, e.temperature);
  const departed = Date.parse(e.departedAt),
    eta = Date.parse(e.eta),
    now = Date.now();
  assert(
    departed >= Date.parse(before.packed.at) &&
      departed <= now + 60000 &&
      departed >= now - 300000,
    'DEPARTURE_TIME',
    'Departure must follow packing and be within the last five minutes.'
  );
  assert(
    eta > now && eta > departed && eta - departed <= 4 * 3600000,
    'ETA_INVALID',
    'ETA must be in the future and within four hours of departure.'
  );
  assert(
    Date.parse(before.packed.expiresAt) > eta,
    'LOT_EXPIRED',
    'The batch must remain valid through arrival.'
  );
  const payload = safeNotification(e);
  return transaction(async (s) => {
    await appendAudit(s, {
      actor: user._id,
      action: 'COURIER_DEPARTED',
      entityId: e.indentId
    });
    const receipt = await Receipt.findById(e.receiptId).session(s).lean();
    if (receipt) {
      assert(
        receipt.digest === e.digest,
        'REPLAY_CONFLICT',
        'Message content changed.',
        409
      );
      return {
        indent: await Indent.findById(e.indentId).session(s).lean(),
        duplicate: true,
        ack: acknowledge(e)
      };
    }
    const i = await Indent.findById(e.indentId).session(s);
    assertScope(user, i);
    assert(
      i.status === 'packed',
      'STATE_CONFLICT',
      'This request is no longer packed.',
      409
    );
    const courierObj = couriers.find((c) => c.id === e.courierId);
    const courierName = courierObj
      ? courierObj.label
      : e.courierId || 'Courier Unit';
    i.status = 'dispatch-pending';
    i.dispatch = {
      courierId: e.courierId,
      courierName,
      eta: e.eta,
      departedAt: e.departedAt,
      temperature: e.temperature,
      dispenseId: `cc-${i._id}`
    };
    i.updatedAt = new Date().toISOString();
    const resource = dispenseResource(i.toObject(), e);
    await i.save({ session: s });
    await Receipt.create(
      [{ _id: e.receiptId, digest: e.digest, indentId: i._id, createdAt: i.updatedAt }],
      { session: s }
    );
    await Outbox.create(
      [
        {
          _id: `dispense-${i._id}`,
          kind: 'dispense',
          resource,
          indentId: i._id,
          userId: i.nurseId,
          payload,
          status: 'pending',
          attempts: 0,
          nextAttempt: new Date(),
          createdAt: i.updatedAt
        }
      ],
      { session: s }
    );
    return { indent: i.toObject(), duplicate: false, ack: acknowledge(e) };
  });
}
