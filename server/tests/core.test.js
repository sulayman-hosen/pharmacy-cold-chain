import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.INTEGRATION_MODE = 'demo';
process.env.AUDIT_HMAC_KEY =
  'unit-test-signing-key-never-use-in-production-123456';
const { parseDelivery, sampleMessage } = await import('../src/services/hl7Service.js');
const { safeNotification } = await import('../src/services/notificationService.js');
const { temperaturePolicy, validateFormulation } = await import('../src/services/rxnormService.js');
const { verifyRecords, GENESIS } = await import('../src/services/auditService.js');
const { sign } = await import('../src/services/terminologyService.js');
const { dispenseResource } = await import('../src/services/fhirService.js');
const { catalog } = await import('../src/fixtures.js');
const indent = {
  _id: 'bb67fc90-cba3-455c-8285-5277edbfc7ab',
  prescriptionId: 'demo-order-01',
  patientRef: 'Patient/demo-patient-01',
  encounterRef: 'Encounter/demo-encounter-01',
  floor: 'ipd-3',
  rxcui: '274783',
  validation: { name: catalog[0].name },
  dose: 10,
  unit: '[iU]',
  route: '34206005'
};
const raw = () => sampleMessage(indent);
test('Redox parses OMP^O09, clinical coding, ZCD and CRLF', () => {
  const e = parseDelivery(raw().replace(/\r/g, '\r\n'));
  assert.equal(e.patientRef, indent.patientRef);
  assert.equal(e.dose, 10);
  assert.equal(e.unit, '[iU]');
  assert.equal(e.courierId, 'C-07');
  assert.equal(e.temperature, 4);
});
test('MLLP frame can be parsed over the HTTP adapter', () =>
  assert.equal(parseDelivery('\x0b' + raw() + '\x1c\r').rxcui, '274783'));
test('Wrong event, repeated segments, missing fields, repeated identifiers are rejected', () => {
  for (const value of [
    raw().replace('OMP^O09', 'ADT^A01'),
    raw() + '\rPID|1',
    raw().replace('ZCD|DEPARTED', 'ZCD|'),
    raw().replace('demo-patient-01^^^', 'demo-patient-01~other^^^')
  ])
    assert.throws(() => parseDelivery(value));
});
test('Untrusted HL7 sender is rejected', () =>
  assert.throws(
    () => parseDelivery(raw().replace('PHARMACY|', 'EVIL|')),
    (e) => e.code === 'HL7_SENDER'
  ));
test('Same control ID with different body has a different digest', () => {
  const r = raw();
  assert.notEqual(
    parseDelivery(r).digest,
    parseDelivery(r.replace('ZCD|DEPARTED|C-07', 'ZCD|DEPARTED|C-12')).digest
  );
});
test('Notification builder cannot copy injected PHI or untrusted courier text', () => {
  const e = {
    ...parseDelivery(raw()),
    patientName: 'Alice Sensitive',
    mrn: '123456',
    bed: '7C',
    drug: 'secret medication'
  };
  const alert = safeNotification(e),
    json = JSON.stringify(alert);
  assert.equal(alert.title, 'Delivery update');
  assert(!json.includes('Alice') && !json.includes('123456') && !json.includes('secret'));
});
test('Boundary temperatures accepted; excursions blocked', () => {
  assert.equal(temperaturePolicy('274783', 2).minC, 2);
  assert.throws(
    () => temperaturePolicy('274783', 8.5),
    (e) => e.code === 'TEMPERATURE_EXCURSION'
  );
});
test('Formulation match requires complete name and exact RxNorm concept', async () => {
  assert.equal(
    (await validateFormulation(catalog[0].name, catalog[0].rxcui)).rxcui,
    catalog[0].rxcui
  );
  await assert.rejects(
    () => validateFormulation('insulin glargine', catalog[0].rxcui),
    (e) => e.code === 'DRUG_MISMATCH'
  );
});
test('Audit HMAC catches mutation, deletion, reordering and tail truncation', () => {
  const r1 = { seq: 1, previousHash: GENESIS, event: { a: 1 } };
  r1.hash = sign(process.env.AUDIT_HMAC_KEY, r1);
  const r2 = { seq: 2, previousHash: r1.hash, event: { a: 2 } };
  r2.hash = sign(process.env.AUDIT_HMAC_KEY, r2);
  const head = { seq: 2, hash: r2.hash };
  assert(verifyRecords([r1, r2], head, process.env.AUDIT_HMAC_KEY).valid);
  assert(
    !verifyRecords(
      [{ ...r1, event: { a: 9 } }, r2],
      head,
      process.env.AUDIT_HMAC_KEY
    ).valid
  );
  assert(!verifyRecords([r2], head, process.env.AUDIT_HMAC_KEY).valid);
  assert(!verifyRecords([r2, r1], head, process.env.AUDIT_HMAC_KEY).valid);
  assert(!verifyRecords([r1], head, process.env.AUDIT_HMAC_KEY).valid);
});
test('FHIR dispense uses correct R4 choice fields and separate preparation/handover', () => {
  const d = dispenseResource(
    {
      _id: 'i1',
      prescriptionId: 'p1',
      patientRef: 'Patient/1',
      encounterRef: 'Encounter/1',
      floor: 'ipd-3',
      order: {
        medication: { text: 'Drug' },
        quantity: { value: 1 },
        resource: { dosageInstruction: [] }
      },
      packed: { by: 'Sam', at: '2026-09-18T09:00:00Z', temperature: 4, lot: 'L1' }
    },
    { departedAt: '2026-09-18T09:10:00Z', courierId: 'C-07', eta: '2026-09-18T09:25:00Z', temperature: 4 }
  );
  assert.equal(d.whenPrepared, '2026-09-18T09:00:00Z');
  assert.equal(d.whenHandedOver, '2026-09-18T09:10:00Z');
});
