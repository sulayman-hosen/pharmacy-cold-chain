import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { login, publicUser, cookieOptions, authenticate } from '../middleware/auth.js';
import { transaction } from '../database/models.js';
import { Session } from '../database/models.js';
import { appendAudit } from '../services/auditService.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 900000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'LOGIN_RATE_LIMIT',
      message: 'Too many sign-in attempts. Try again later.'
    }
  }
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const b = z
    .object({
      username: z.string().min(1).max(60).optional(),
      role: z.string().min(1).max(60).optional(),
      password: z.string().min(1).max(200)
    })
    .refine((data) => data.username || data.role, {
      message: 'Username or role is required'
    })
    .parse(req.body);
  const username = b.username || b.role;
  const result = await login(username, b.password);
  res
    .cookie('coldline', result.token, {
      ...cookieOptions,
      expires: result.expiresAt
    })
    .json({ user: result.user, csrf: result.csrf });
});

authRouter.get('/me', authenticate, (req, res) =>
  res.json({ user: publicUser(req.user), csrf: req.session.csrf })
);

authRouter.post('/logout', authenticate, async (req, res) => {
  await transaction(async (s) => {
    await Session.deleteOne({ _id: req.session._id }, { session: s });
    await appendAudit(s, { actor: req.user._id, action: 'LOGOUT' });
  });
  res.clearCookie('coldline', cookieOptions).json({ ok: true });
});
