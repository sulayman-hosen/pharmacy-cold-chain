import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { temporaryMongo } from '../scripts/temporary-mongo.js';

process.env.NODE_ENV = 'test';
process.env.INTEGRATION_MODE = 'demo';
process.env.AUDIT_HMAC_KEY =
  'integration-test-signing-key-only-1234567890';
for (const role of ['NURSE', 'PHARMACIST', 'AUDITOR'])
  process.env[`DEMO_${role}_PASSWORD`] = 'TestOnly-Strong-Password123!';

let stop,
  app,
  db,
  workflow,
  worker,
  audit,
  hl7,
  seed,
  userN,
  userP,
  nurse,
  pharmacist,
  nurseCsrf,
  pharmacistCsrf;

before(async () => {
  const temp = await temporaryMongo();
  stop = temp.stop;
  process.env.MONGO_URI = temp.mongo.getUri('coldchain_test');
  db = await import('../src/database/models.js');
  const conn = await import('../src/database/connection.js');
  await conn.connectDb();
  ({ seed } = await import('../src/database/seeders.js'));
  await seed();
  const { createApp } = await import('../src/app.js');
  app = createApp();
  workflow = await import('../src/services/workflowService.js');
  worker = await import('../src/services/workerService.js');
  audit = await import('../src/services/auditService.js');
  hl7 = await import('../src/services/hl7Service.js');
  userN = await db.User.findById('demo-nurse').lean();
  userP = await db.User.findById('demo-pharmacist').lean();
  nurse = request.agent(app);
  pharmacist = request.agent(app);
  let r = await nurse
    .post('/api/auth/login')
    .send({ username: 'nurse', password: process.env.DEMO_NURSE_PASSWORD });
  assert.equal(r.status, 200);
  nurseCsrf = r.body.csrf;
  r = await pharmacist
    .post('/api/auth/login')
    .send({ username: 'pharmacist', password: process.env.DEMO_PHARMACIST_PASSWORD });
  assert.equal(r.status, 200);
  pharmacistCsrf = r.body.csrf;
}, { timeout: 120000 });

after(async () => {
  await db?.mongoose.disconnect();
  if (stop) await stop();
});

const input = (prescriptionId = 'demo-order-01', dose = 10) => ({
  prescriptionId,
  requestedName: 'insulin glargine 100 UNT/ML Injectable Solution',
  dose,
  unit: '[iU]',
  route: '34206005'
});

test('Authentication, role restrictions, CSRF and origin checks are enforced', async () => {
  assert.equal((await request(app).get('/api/indents')).status, 401);
  assert.equal((await nurse.post('/api/indents').send(input())).status, 403);
  assert.equal(
    (
      await pharmacist
        .post('/api/indents')
        .set('X-CSRF-Token', pharmacistCsrf)
        .send(input())
    ).status,
    403
  );
  assert.equal((await nurse.get('/api/audit')).status, 403);
  assert.equal(
    (
      await nurse
        .get('/api/indents')
        .set('Origin', 'https://attacker.invalid')
    ).status,
    403
  );
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'nurse', password: process.env.DEMO_NURSE_PASSWORD });
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  assert.match(login.headers['set-cookie'][0], /SameSite=Strict/);
});

test('Wrong drug, dose and route are rejected without an indent', async () => {
  for (const override of [
    { dose: 11 },
    { requestedName: 'insulin' },
    { unit: 'mg' },
    { route: '26643006' }
  ]) {
    const r = await nurse
      .post('/api/indents')
      .set('X-CSRF-Token', nurseCsrf)
      .send({ ...input(), ...override });
    assert.equal(r.status, 422, r.text);
  }
  assert.equal(await db.Indent.countDocuments(), 0);
});

test('Out-of-floor access and stopped prescriptions fail closed', async () => {
  const { readOrder } = await import('../src/services/fhirService.js');
  await assert.rejects(
    readOrder('demo-order-01', { ...userN, floors: ['another-floor'] }),
    (e) => e.status === 403
  );
  await db.DemoResource.updateOne(
    { _id: 'MedicationRequest/demo-order-01' },
    { $set: { 'resource.status': 'stopped' } }
  );
  await assert.rejects(
    workflow.createIndent(input(), userN),
    (e) => e.code === 'ORDER_INACTIVE'
  );
  await db.DemoResource.updateOne(
    { _id: 'MedicationRequest/demo-order-01' },
    { $set: { 'resource.status': 'active' } }
  );
});

test('Whole workflow: read → request → approve → pack → HL7 → FHIR → nurse alert → receive', async () => {
  const read = await nurse.get('/api/prescriptions/demo-order-01');
  assert.equal(read.status, 200);
  assert.equal(read.body.dose, 10);
  let r = await nurse
    .post('/api/indents')
    .set('X-CSRF-Token', nurseCsrf)
    .send(input());
  assert.equal(r.status, 201, r.text);
  const id = r.body._id;
  assert.equal(
    (
      await nurse
        .post('/api/indents')
        .set('X-CSRF-Token', nurseCsrf)
        .send(input())
    ).status,
    409
  );
  assert.equal(
    (
      await nurse
        .post(`/api/indents/${id}/validate`)
        .set('X-CSRF-Token', nurseCsrf)
        .send({})
    ).status,
    403
  );
  r = await pharmacist
    .post(`/api/indents/${id}/validate`)
    .set('X-CSRF-Token', pharmacistCsrf)
    .send({});
  assert.equal(r.status, 200, r.text);
  const pack = {
    temperature: 4,
    lot: 'TEST-LOT',
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  };
  assert.equal(
    (
      await pharmacist
        .post(`/api/indents/${id}/pack`)
        .set('X-CSRF-Token', pharmacistCsrf)
        .send({ ...pack, temperature: 12 })
    ).status,
    422
  );
  r = await pharmacist
    .post(`/api/indents/${id}/pack`)
    .set('X-CSRF-Token', pharmacistCsrf)
    .send(pack);
  assert.equal(r.status, 200, r.text);
  let i = await db.Indent.findById(id).lean();
  const message = hl7.sampleMessage(i);
  await assert.rejects(
    workflow.dispatch(message.replace('demo-patient-01', 'demo-patient-02'), userP),
    (e) => e.code === 'HL7_PATIENT_ORDER_MISMATCH'
  );
  await assert.rejects(
    workflow.dispatch(message.replace('|10||', '|11||'), userP),
    (e) => e.code === 'HL7_MEDICATION_MISMATCH'
  );
  const post = () =>
    pharmacist
      .post('/api/hl7/dispatch')
      .set('X-CSRF-Token', pharmacistCsrf)
      .send({ message });
  const parallel = await Promise.all([post(), post()]);
  assert.ok(
    parallel.every((r) => [200, 202].includes(r.status)),
    JSON.stringify(parallel.map((r) => r.body))
  );
  assert.equal(await db.Receipt.countDocuments(), 1);
  assert.equal(await db.Outbox.countDocuments({ kind: 'dispense' }), 1);
  assert.equal(await db.Notification.countDocuments(), 0);
  const changed = await pharmacist
    .post('/api/hl7/dispatch')
    .set('X-CSRF-Token', pharmacistCsrf)
    .send({ message: message.replace('|C-07|', '|C-12|') });
  assert.equal(changed.status, 409);
  await worker.drainOutbox(100);
  i = await db.Indent.findById(id).lean();
  assert.equal(i.status, 'dispatched');
  const fhir = await db.DemoResource.findById(`MedicationDispense/cc-${id}`).lean();
  assert.equal(fhir.resource.subject.reference, 'Patient/demo-patient-01');
  assert.equal(
    fhir.resource.authorizingPrescription[0].reference,
    'MedicationRequest/demo-order-01'
  );
  const inbox = await nurse.get('/api/notifications');
  assert.equal(inbox.body.length, 1);
  const body = JSON.stringify(inbox.body[0].payload);
  assert.match(body, /Courier 07/);
  for (const phi of ['patient', 'insulin', 'demo-order', 'ipd-3', id])
    assert.ok(!body.includes(phi));
  r = await nurse
    .post(`/api/indents/${id}/receive`)
    .set('X-CSRF-Token', nurseCsrf)
    .send({});
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'received');
  assert.equal((await post()).status, 200);
  await worker.drainOutbox(100);
  assert.equal(await db.Notification.countDocuments(), 1);
  assert.equal((await audit.verifyAudit()).valid, true);
});

test('Changed prescription after approval blocks packing', async () => {
  const i = await workflow.createIndent(input('demo-order-02', 12), userN);
  await workflow.transition(i._id, userP, 'validate');
  await db.DemoResource.updateOne(
    { _id: 'MedicationRequest/demo-order-02' },
    { $set: { 'resource.meta.versionId': '2' } }
  );
  await assert.rejects(
    workflow.transition(i._id, userP, 'pack', {
      temperature: 4,
      lot: 'A',
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    }),
    (e) => e.code === 'ORDER_CHANGED'
  );
  await workflow.transition(i._id, userN, 'cancel');
});

test('FHIR outage holds notification; persistent queue retries without duplicates', async () => {
  const i = await workflow.createIndent(input('demo-order-02', 12), userN);
  await workflow.transition(i._id, userP, 'validate');
  await workflow.transition(i._id, userP, 'pack', {
    temperature: 4,
    lot: 'RETRY-LOT',
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  });
  await workflow.dispatch(
    hl7.sampleMessage(await db.Indent.findById(i._id).lean()),
    userP
  );
  const { config } = await import('../src/config/env.js');
  const originalFetch = globalThis.fetch;
  config.INTEGRATION_MODE = 'live';
  globalThis.fetch = async () => {
    throw new Error('simulated network outage');
  };
  try {
    await worker.drainOutbox(100);
  } finally {
    globalThis.fetch = originalFetch;
    config.INTEGRATION_MODE = 'demo';
  }
  assert.equal((await db.Indent.findById(i._id)).status, 'dispatch-pending');
  assert.equal(await db.Notification.countDocuments({ _id: `delivery-${i._id}` }), 0);
  const job = await db.Outbox.findById(`dispense-${i._id}`);
  assert.equal(job.status, 'pending');
  assert.equal(job.lastError, 'UPSTREAM_UNAVAILABLE');
  await db.Outbox.updateMany({ status: 'pending' }, { $set: { nextAttempt: new Date(0) } });
  await worker.drainOutbox(100);
  assert.equal((await db.Indent.findById(i._id)).status, 'dispatched');
  assert.equal(await db.Notification.countDocuments({ _id: `delivery-${i._id}` }), 1);
  await worker.drainOutbox(100);
  assert.equal(await db.Notification.countDocuments({ _id: `delivery-${i._id}` }), 1);
});

test('A second nurse cannot read or change another nurse’s indent', async () => {
  const i = await db.Indent.findOne({ status: 'dispatched' }).lean();
  const another = { ...userN, _id: 'another-nurse' };
  await assert.rejects(
    workflow.getIndent(i._id, another),
    (e) => e.status === 404
  );
  await assert.rejects(
    workflow.transition(i._id, another, 'receive'),
    (e) => e.status === 404
  );
});

test('Audit mutation is detected using the actual MongoDB records', async () => {
  const row = await db.Audit.findOne().lean();
  await db.Audit.updateOne({ _id: row._id }, { $set: { 'event.outcome': '8' } });
  assert.equal((await audit.verifyAudit()).valid, false);
  await db.Audit.updateOne({ _id: row._id }, { $set: { event: row.event } });
  assert.equal((await audit.verifyAudit()).valid, true);
});

test('Logout invalidates the stored session', async () => {
  assert.equal(
    (
      await nurse
        .post('/api/auth/logout')
        .set('X-CSRF-Token', nurseCsrf)
        .send({})
    ).status,
    200
  );
  assert.equal((await nurse.get('/api/indents')).status, 401);
});
