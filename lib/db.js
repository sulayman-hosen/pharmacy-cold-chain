import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmacy_cold_chain';

let isConnected = false;

export async function connectDb() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    isConnected = true;
  } catch (err) {
    console.warn('[lib/db] Mongoose connection warning:', err.message);
  }
}

const Schema = mongoose.Schema;

const indentSchema = new Schema({
  _id: String,
  prescriptionId: String,
  nurseId: String,
  nurseName: String,
  floor: String,
  room: String,
  bed: String,
  patientRef: String,
  requestedName: String,
  rxcui: String,
  status: String,
  dispatch: Schema.Types.Mixed,
  orderHash: String,
  createdAt: String,
  updatedAt: String
}, { collection: 'indents', versionKey: false });

const auditSchema = new Schema({
  seq: Number,
  previousHash: String,
  hash: String,
  event: Schema.Types.Mixed
}, { collection: 'audits', versionKey: false });

export const DispatchRecord = mongoose.models.DispatchRecord || mongoose.model('DispatchRecord', indentSchema);
export const AuditEventLog = mongoose.models.AuditEventLog || mongoose.model('AuditEventLog', auditSchema);
export const Indent = mongoose.models.Indent || mongoose.model('Indent', indentSchema);
export const Audit = mongoose.models.Audit || mongoose.model('Audit', auditSchema);
