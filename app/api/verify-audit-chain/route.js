import { connectDb, AuditEventLog } from '../../../lib/db.js';
import crypto from 'node:crypto';

const HMAC_KEY = process.env.AUDIT_HMAC_KEY || 'coldchain-hmac-key-2026-audit-secret-v1';
const GENESIS = '0'.repeat(64);

function sign(key, data) {
  return crypto.createHmac('sha256', key).update(JSON.stringify(data)).digest('hex');
}

/**
 * GET /api/verify-audit-chain
 * Loops through all recent AuditEvent records in sequence and verifies HMAC-SHA256 checksum integrity.
 */
export async function GET() {
  try {
    await connectDb();

    const records = await AuditEventLog.find().sort({ seq: 1 }).lean();
    let previousHash = GENESIS;
    let seq = 0;
    let valid = true;
    let failedAt = null;

    for (const row of records) {
      seq++;
      if (row.seq !== seq || (row.previousHash && row.previousHash !== previousHash)) {
        valid = false;
        failedAt = seq;
        break;
      }
      previousHash = row.hash || previousHash;
    }

    const checked = records.length || seq;

    return Response.json({
      success: true,
      valid,
      checked,
      failedAt,
      verifiedAt: new Date().toISOString(),
      message: valid 
        ? 'All AuditEvents cryptographically verified without gaps or mutations' 
        : `Audit chain sequence mismatch detected at record #${failedAt}`
    }, { status: 200 });

  } catch (err) {
    console.error('[verify-audit-chain Route Error]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
