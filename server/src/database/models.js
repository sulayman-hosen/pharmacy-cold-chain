import mongoose from 'mongoose';

const { Schema } = mongoose;

function model(name, fields, options = {}) {
  return mongoose.model(
    name,
    new Schema(
      { _id: { type: String, required: true }, ...fields },
      { versionKey: false, ...options }
    )
  );
}

export const User = model('User', {
  username: { type: String, unique: true },
  name: String,
  passwordHash: String,
  role: String,
  floors: [String],
  active: Boolean
});

export const Session = model('Session', {
  userId: String,
  csrf: String,
  expiresAt: { type: Date, index: { expires: 0 } }
});

export const Indent = model('Indent', {
  prescriptionId: String,
  nurseId: String,
  nurseName: String,
  floor: String,
  room: String,
  bed: String,
  patientRef: String,
  encounterRef: String,
  requestedName: String,
  rxcui: String,
  dose: Number,
  unit: String,
  route: String,
  orderHash: String,
  order: Schema.Types.Mixed,
  validation: Schema.Types.Mixed,
  status: { type: String, index: true },
  packed: Schema.Types.Mixed,
  dispatch: Schema.Types.Mixed,
  createdAt: String,
  updatedAt: String
});

export const Receipt = model('Receipt', {
  digest: String,
  indentId: String,
  createdAt: String
});

export const AuditHead = model('AuditHead', {
  seq: Number,
  hash: String
});

export const Audit = model('Audit', {
  seq: { type: Number, unique: true },
  previousHash: String,
  hash: String,
  event: Schema.Types.Mixed
});

export const Outbox = model('Outbox', {
  kind: String,
  resource: Schema.Types.Mixed,
  indentId: String,
  userId: String,
  payload: Schema.Types.Mixed,
  status: { type: String, index: true },
  attempts: Number,
  nextAttempt: Date,
  leaseUntil: Date,
  leaseToken: String,
  lastError: String,
  createdAt: String
});

export const Notification = model('Notification', {
  userId: { type: String, index: true },
  payload: Schema.Types.Mixed,
  createdAt: String,
  readAt: String
});

export const PushSubscription = model('PushSubscription', {
  userId: String,
  subscription: Schema.Types.Mixed
});

export const DemoResource = model('DemoResource', {
  resource: Schema.Types.Mixed
});

export const models = [
  User,
  Session,
  Indent,
  Receipt,
  AuditHead,
  Audit,
  Outbox,
  Notification,
  PushSubscription,
  DemoResource
];

export async function transaction(fn) {
  return mongoose.connection.transaction(fn, {
    readPreference: 'primary',
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' }
  });
}

export { mongoose };
