import { randomUUID } from 'node:crypto';
import { Outbox, Indent, Notification, transaction } from '../database/models.js';
import { writeResource } from './fhirService.js';
import { appendAudit } from './auditService.js';
import { sendPush, pushEnabled } from './notificationService.js';

let busy = false;

export async function drainOutbox(limit = 12) {
  if (busy) return;
  busy = true;
  try {
    for (let n = 0; n < limit; n++) {
      const now = new Date(),
        token = randomUUID();
      const job = await Outbox.findOneAndUpdate(
        {
          $or: [
            { status: 'pending', nextAttempt: { $lte: now } },
            { status: 'working', leaseUntil: { $lte: now } }
          ]
        },
        {
          $set: {
            status: 'working',
            leaseUntil: new Date(Date.now() + 120000),
            leaseToken: token
          },
          $inc: { attempts: 1 }
        },
        { sort: { createdAt: 1 }, new: true }
      ).lean();
      if (!job) break;
      try {
        if (job.kind === 'push') await sendPush(job.userId, job.payload);
        else await writeResource(job.resource);
        await transaction(async (s) => {
          const claimed = await Outbox.updateOne(
            { _id: job._id, status: 'working', leaseToken: token },
            { $set: { status: 'done', lastError: '' }, $unset: { leaseUntil: 1, leaseToken: 1 } },
            { session: s }
          );
          if (!claimed.modifiedCount) return;
          if (job.kind === 'dispense') {
            await Indent.updateOne(
              { _id: job.indentId, status: 'dispatch-pending' },
              { $set: { status: 'dispatched', updatedAt: new Date().toISOString() } },
              { session: s }
            );
            const notificationId = `delivery-${job.indentId}`;
            await Notification.updateOne(
              { _id: notificationId },
              {
                $setOnInsert: {
                  userId: job.userId,
                  payload: job.payload,
                  createdAt: new Date().toISOString()
                }
              },
              { session: s, upsert: true }
            );
            if (pushEnabled)
              await Outbox.updateOne(
                { _id: `push-${job.indentId}` },
                {
                  $setOnInsert: {
                    kind: 'push',
                    userId: job.userId,
                    payload: job.payload,
                    status: 'pending',
                    attempts: 0,
                    nextAttempt: new Date(),
                    createdAt: new Date().toISOString()
                  }
                },
                { session: s, upsert: true }
              );
            await appendAudit(s, { action: 'FHIR_CHART_UPDATED', entityId: job.indentId });
            await appendAudit(s, { action: 'NOTIFICATION_QUEUED', entityId: job.indentId });
          }
          if (job.kind === 'push') await appendAudit(s, { action: 'PUSH_SENT' });
        });
      } catch (error) {
        const dead = job.attempts >= 8;
        await Outbox.updateOne(
          { _id: job._id, status: 'working', leaseToken: token },
          {
            $set: {
              status: dead ? 'dead' : 'pending',
              lastError: [
                'UPSTREAM_REJECTED',
                'UPSTREAM_UNAVAILABLE',
                'FHIR_WRITE_RESPONSE',
                'PUSH_ENDPOINT'
              ].includes(error.code)
                ? error.code
                : 'DELIVERY_FAILED',
              nextAttempt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** job.attempts))
            },
            $unset: { leaseUntil: 1, leaseToken: 1 }
          }
        );
      }
    }
  } finally {
    busy = false;
  }
}

export function startWorker() {
  const timer = setInterval(
    () => drainOutbox().catch(() => console.error('OUTBOX_WORKER_FAILED')),
    2000
  );
  timer.unref();
  return () => clearInterval(timer);
}
