import { Router } from 'express';
import { z } from 'zod';
import { authenticate, roles } from '../middleware/auth.js';
import { Outbox, transaction } from '../database/models.js';
import { assert } from '../services/terminologyService.js';
import { appendAudit } from '../services/auditService.js';

export const integrationRouter = Router();

integrationRouter.use(authenticate);

integrationRouter.get(
  '/integrations',
  roles('pharmacist', 'auditor'),
  async (req, res) => {
    const rows = await Outbox.find()
      .select('-resource -payload -userId -leaseToken')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(rows);
  }
);

integrationRouter.post(
  '/integrations/:id/retry',
  roles('pharmacist'),
  async (req, res) => {
    const key = z.string().regex(/^[A-Za-z0-9-]{1,90}$/).parse(req.params.id);
    await transaction(async (s) => {
      const job = await Outbox.findOneAndUpdate(
        { _id: key, status: 'dead' },
        {
          $set: {
            status: 'pending',
            attempts: 0,
            nextAttempt: new Date(),
            lastError: ''
          }
        },
        { session: s }
      );
      assert(
        job,
        'RETRY_NOT_FOUND',
        'Only failed jobs can be retried.',
        409
      );
      await appendAudit(s, { actor: req.user._id, action: 'INTEGRATION_RETRIED' });
    });
    res.json({ ok: true });
  }
);
