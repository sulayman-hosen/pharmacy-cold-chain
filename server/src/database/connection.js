import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { models, AuditHead } from './models.js';

export async function connectDb() {
  await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error(
      'MongoDB transactions require a replica set. Use docker compose up -d mongo or MongoDB Atlas.'
    );
  }
  await Promise.all(models.map((m) => m.init()));
  await AuditHead.updateOne(
    { _id: 'main' },
    { $setOnInsert: { seq: 0, hash: '0'.repeat(64) } },
    { upsert: true }
  );
}
