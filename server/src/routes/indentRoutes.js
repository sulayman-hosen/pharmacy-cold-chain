import { Router } from 'express';
import { z } from 'zod';
import { authenticate, roles } from '../middleware/auth.js';
import { Indent } from '../database/models.js';
import { readOrder } from '../services/fhirService.js';
import { audit } from '../services/auditService.js';
import { createIndent, transition, getIndent } from '../services/workflowService.js';
import { sampleMessage } from '../services/hl7Service.js';
import { config } from '../config/env.js';
import { assert } from '../services/terminologyService.js';
import { couriers } from '../fixtures.js';

export const indentRouter = Router();

const idSchema = z.string().regex(/^[A-Za-z0-9.-]{1,64}$/);
const uuidSchema = z.uuid();

const createBody = z
  .object({
    prescriptionId: idSchema,
    requestedName: z.string().trim().min(3).max(250),
    dose: z.number().positive().max(100000),
    unit: z.string().min(1).max(24),
    route: z.string().regex(/^\d+$/),
    patientRef: z.string().trim().min(1).max(100).optional(),
    nurseName: z.string().trim().min(1).max(150).optional(),
    floor: z.string().trim().min(1).max(50).optional(),
    room: z.string().trim().min(1).max(50).optional(),
    bed: z.string().trim().min(1).max(50).optional()
  })
  .passthrough();

const packBody = z
  .object({
    temperature: z.number().min(-100).max(100),
    lot: z.string().regex(/^[A-Za-z0-9.-]{1,60}$/),
    expiresAt: z.iso.datetime()
  })
  .strict();

const demoBody = z
  .object({
    courierId: z.enum(couriers.map((c) => c.id)),
    minutes: z.number().int().min(1).max(240),
    temperature: z.number().min(-100).max(100)
  })
  .strict();

indentRouter.use(authenticate);

indentRouter.get(
  '/prescriptions/:id',
  roles('nurse', 'pharmacist'),
  async (req, res) => {
    const order = await readOrder(idSchema.parse(req.params.id), req.user);
    await audit({ actor: req.user._id, action: 'PRESCRIPTION_READ' });
    const { resource, orderHash, medication, ...summary } = order;
    res.json(summary);
  }
);

indentRouter.get('/indents', roles('nurse', 'pharmacist', 'auditor'), async (req, res) => {
  const filter =
    req.user.role === 'pharmacist' || req.user.role === 'auditor'
      ? {}
      : { nurseId: req.user._id };
  const rows = await Indent.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  await audit({ actor: req.user._id, action: 'INDENT_LIST_READ' });
  res.json(rows.map(({ order, orderHash, ...row }) => row));
});

indentRouter.post('/indents', roles('nurse'), async (req, res) =>
  res.status(201).json(await createIndent(createBody.parse(req.body), req.user))
);

indentRouter.get('/indents/:id', roles('nurse', 'pharmacist'), async (req, res) => {
  const i = await getIndent(uuidSchema.parse(req.params.id), req.user);
  await audit({ actor: req.user._id, action: 'INDENT_READ', entityId: i._id });
  res.json(i);
});

for (const action of ['validate', 'pack', 'cancel', 'receive']) {
  indentRouter.post(
    `/indents/:id/${action}`,
    roles(
      ...(action === 'receive'
        ? ['nurse']
        : action === 'cancel'
        ? ['nurse', 'pharmacist']
        : ['pharmacist'])
    ),
    async (req, res) =>
      res.json(
        await transition(
          uuidSchema.parse(req.params.id),
          req.user,
          action,
          action === 'pack' ? packBody.parse(req.body) : {}
        )
      )
  );
}

indentRouter.post('/indents/:id/sample-hl7', roles('pharmacist'), async (req, res) => {
  assert(
    config.INTEGRATION_MODE === 'demo',
    'DEMO_ONLY',
    'Use your hospital interface in live mode.',
    403
  );
  const i = await getIndent(uuidSchema.parse(req.params.id), req.user);
  const raw = sampleMessage(i, demoBody.parse(req.body));
  await audit({ actor: req.user._id, action: 'HL7_SAMPLE_READ', entityId: i._id });
  res.json({ message: raw });
});
