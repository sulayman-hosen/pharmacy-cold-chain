import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { config } from './config/env.js';
import { AppError } from './services/terminologyService.js';
import { mongoose } from './database/models.js';
import { audit } from './services/auditService.js';

import { authRouter } from './routes/authRoutes.js';
import { configRouter } from './routes/configRoutes.js';
import { indentRouter } from './routes/indentRoutes.js';
import { hl7Router } from './routes/hl7Routes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { auditRouter } from './routes/auditRoutes.js';
import { integrationRouter } from './routes/integrationRoutes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null
        }
      }
    })
  );
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    req.requestId = randomUUID();
    res.set('Cache-Control', 'no-store');
    res.set('X-Request-ID', req.requestId);
    const requestOrigin = req.get('Origin');
    if (requestOrigin) {
      const host = req.get('host');
      const isSameOrigin =
        requestOrigin === `${req.protocol}://${host}` ||
        requestOrigin === `https://${host}` ||
        requestOrigin === `http://${host}`;
      if (!isSameOrigin && !config.origins.includes(requestOrigin)) {
        throw new AppError(403, 'ORIGIN_DENIED', 'This origin is not allowed.');
      }
    }
    next();
  });
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMIT',
          message: 'Too many requests. Try again shortly.'
        }
      }
    })
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(
    express.text({ type: ['text/plain', 'application/hl7-v2'], limit: '64kb' })
  );

  app.get('/api/health', (req, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable' })
  );

  // Mount modular route handlers
  app.use('/api/auth', authRouter);
  app.use('/api/config', configRouter);
  app.use('/api', indentRouter);
  app.use('/api', hl7Router);
  app.use('/api', notificationRouter);
  app.use('/api', auditRouter);
  app.use('/api', integrationRouter);

  app.use('/api', (req, res) =>
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } })
  );

  const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (req, res) => res.sendFile(dist + 'index.html'));
  }

  app.use(async (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status =
      error.name === 'ZodError'
        ? 400
        : error.type === 'entity.too.large'
        ? 413
        : error instanceof SyntaxError
        ? 400
        : error.status ?? 500;
    const code =
      error.name === 'ZodError'
        ? 'INVALID_INPUT'
        : error.type === 'entity.too.large'
        ? 'BODY_TOO_LARGE'
        : error instanceof SyntaxError
        ? 'INVALID_JSON'
        : typeof error.code === 'string'
        ? error.code
        : 'INTERNAL_ERROR';
    const message =
      error instanceof AppError
        ? error.message
        : status === 400
        ? 'Check the form fields and request format.'
        : status === 413
        ? 'Request body is too large.'
        : 'The request could not be completed.';
    if (req.user) {
      try {
        await audit({ actor: req.user._id, action: 'REQUEST_REJECTED', outcome: '4' });
      } catch {
        return res
          .status(503)
          .json({
            error: {
              code: 'AUDIT_UNAVAILABLE',
              message: 'The audit service is unavailable. Retry later.'
            }
          });
      }
    }
    if (status >= 500) console.error(JSON.stringify({ code, requestId: req.requestId }));
    res.status(status).json({ error: { code, message, requestId: req.requestId } });
  });

  return app;
}
