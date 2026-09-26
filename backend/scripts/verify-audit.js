import 'dotenv/config';
import mongoose from 'mongoose';
import '../src/models/CatalogState.js';
import AuditLog from '../src/models/AuditLog.js';
try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const result = await AuditLog.verifyChain();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.valid ? 0 : 1;
} catch {
  console.error(
    'Audit verification failed. Check database connectivity and replica-set configuration.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
