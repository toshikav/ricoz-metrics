import dns from 'node:dns';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '8.8.4.4']);
import { Metric, MetricVersion, AuditLog } from '../models/index.js';
import CatalogState from '../models/CatalogState.js';
export async function initializeDatabase() {
  await Promise.all([Metric.init(), MetricVersion.init(), AuditLog.init(), CatalogState.init()]);
  await CatalogState.updateOne(
    { _id: 'catalogue' },
    { $setOnInsert: { sequence: 0, hash: '0' } },
    { upsert: true },
  );
}
export default async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  mongoose.set('bufferCommands', false);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid')
    throw new Error(
      'A MongoDB replica set or sharded cluster is required for transactional writes.',
    );
  await initializeDatabase();
}
