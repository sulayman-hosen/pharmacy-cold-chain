import { Router } from 'express';
import { z } from 'zod';
import { authenticate, roles } from '../middleware/auth.js';
import { dispatch } from '../services/workflowService.js';

export const hl7Router = Router();

hl7Router.post('/hl7/dispatch', authenticate, roles('pharmacist'), async (req, res) => {
  const raw = z
    .string()
    .min(1)
    .max(65536)
    .parse(typeof req.body === 'string' ? req.body : req.body?.message);
  const result = await dispatch(raw, req.user);
  res.status(result.duplicate ? 200 : 202).json(result);
});
