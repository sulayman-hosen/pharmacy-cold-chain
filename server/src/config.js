import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
dotenv.config({path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true});
const env = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/cold_chain?replicaSet=rs0&directConnection=true'),
  INTEGRATION_MODE: z.enum(['demo','live']).default('demo'),
  FHIR_BASE_URL: z.url().default('http://127.0.0.1:8080/fhir'),
  FHIR_BEARER_TOKEN: z.string().default(''),
  APP_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:4000,http://127.0.0.1:4000'),
  ALLOW_LOCAL_HTTP: z.enum(['true','false']).default('true'),
  AUDIT_HMAC_KEY: z.string().min(40, 'Run npm run setup to create a strong audit key.'),
  SESSION_HOURS: z.coerce.number().positive().max(24).default(8),
  HL7_SENDING_APP: z.string().default('PHARMACY'),
  HL7_SENDING_FACILITY: z.string().default('DEMO-HOSPITAL'),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.invalid'),
  VAPID_PUBLIC_KEY: z.string().default(''), VAPID_PRIVATE_KEY: z.string().default(''),
  PUSH_ALLOWED_HOSTS: z.string().default('fcm.googleapis.com,updates.push.services.mozilla.com,web.push.apple.com')
}).parse(process.env);
export const config = {...env, origins: env.APP_ORIGINS.split(',').map(s=>s.trim())};
if (config.NODE_ENV === 'production' && config.INTEGRATION_MODE !== 'live') throw new Error('Production requires live integrations.');
if (config.NODE_ENV === 'production' && config.origins.some(s=>!s.startsWith('https://'))) throw new Error('Production origins require HTTPS.');
if (config.INTEGRATION_MODE === 'live') {
  const u = new URL(config.FHIR_BASE_URL);
  const local = ['localhost','127.0.0.1','hapi'].includes(u.hostname);
  if (u.username || u.password || u.search || u.hash || (u.protocol !== 'https:' && !(local && config.ALLOW_LOCAL_HTTP === 'true'))) throw new Error('Use HTTPS for FHIR; local HTTP needs ALLOW_LOCAL_HTTP=true.');
}
