import { Router } from 'express';
import { config } from '../config/env.js';
import { catalog, couriers } from '../fixtures.js';
import { pushEnabled } from '../services/notificationService.js';
import { authenticate } from '../middleware/auth.js';

export const configRouter = Router();

configRouter.get('/', authenticate, (req, res) =>
  res.json({
    integrationMode: config.INTEGRATION_MODE,
    fhirVersion: '4.0.1',
    catalog,
    couriers,
    pushEnabled,
    vapidPublicKey: pushEnabled ? config.VAPID_PUBLIC_KEY : null
  })
);
