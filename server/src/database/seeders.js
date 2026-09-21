import { User, DemoResource } from './models.js';
import { hashPassword, assert } from '../services/terminologyService.js';
import { demoResources } from '../fixtures.js';
import { config } from '../config/env.js';

export async function seed() {
  assert(
    config.NODE_ENV !== 'production',
    'SEED_DISABLED',
    'Demo seeding is disabled in production.',
    403
  );
  for (const [username, name] of [
    ['nurse', 'Jamie · Floor nurse'],
    ['pharmacist', 'Sam · Pharmacist'],
    ['auditor', 'Robin · Auditor']
  ]) {
    const password = process.env[`DEMO_${username.toUpperCase()}_PASSWORD`];
    assert(
      password?.length >= 12 && !password.includes('GENERATE_WITH'),
      'PASSWORD_REQUIRED',
      'Run npm run setup or set DEMO_*_PASSWORD values of 12+ characters.'
    );
    await User.updateOne(
      { _id: `demo-${username}` },
      {
        $setOnInsert: {
          username,
          name,
          role: username,
          floors: ['ipd-3'],
          active: true
        },
        $set: { passwordHash: hashPassword(password) }
      },
      { upsert: true }
    );
  }
  for (const resource of demoResources())
    await DemoResource.updateOne(
      { _id: `${resource.resourceType}/${resource.id}` },
      { $setOnInsert: { resource } },
      { upsert: true }
    );
}
