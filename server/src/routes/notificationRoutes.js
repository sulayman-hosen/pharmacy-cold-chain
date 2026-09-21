import { Router } from 'express';
import { z } from 'zod';
import { authenticate, roles } from '../middleware/auth.js';
import { Notification, PushSubscription } from '../database/models.js';
import { pushEnabled, checkPushEndpoint } from '../services/notificationService.js';
import { assert, sha256 } from '../services/terminologyService.js';
import { audit } from '../services/auditService.js';

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get('/notifications', roles('nurse'), async (req, res) => {
  const rows = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json(rows);
});

notificationRouter.post(
  '/notifications/:id/read',
  roles('nurse'),
  async (req, res) => {
    await Notification.updateOne(
      { _id: z.string().max(80).parse(req.params.id), userId: req.user._id },
      { $set: { readAt: new Date().toISOString() } }
    );
    res.json({ ok: true });
  }
);

notificationRouter.post(
  '/push/subscriptions',
  roles('nurse'),
  async (req, res) => {
    assert(
      pushEnabled,
      'PUSH_DISABLED',
      'Configure VAPID credentials to enable browser push.',
      409
    );
    const b = z
      .object({
        endpoint: z.url().max(2000),
        expirationTime: z.number().nullable().optional(),
        keys: z
          .object({
            p256dh: z.string().regex(/^[A-Za-z0-9_=-]+$/).max(200),
            auth: z.string().regex(/^[A-Za-z0-9_=-]+$/).max(100)
          })
          .strict()
      })
      .strict()
      .parse(req.body);
    checkPushEndpoint(b.endpoint);
    assert(
      (await PushSubscription.countDocuments({ userId: req.user._id })) < 3,
      'PUSH_LIMIT',
      'At most three devices are supported.',
      409
    );
    await PushSubscription.updateOne(
      { _id: sha256(b.endpoint) },
      { $set: { userId: req.user._id, subscription: b } },
      { upsert: true }
    );
    await audit({ actor: req.user._id, action: 'PUSH_SUBSCRIBED' });
    res.json({ ok: true });
  }
);
