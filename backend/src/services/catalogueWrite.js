import mongoose from 'mongoose';
import CatalogState from '../models/CatalogState.js';
import AuditLog, { hashEntry } from '../models/AuditLog.js';
export async function catalogueWrite(operation) {
  return mongoose.connection.transaction(async (session) => {
    // Every mutation locks the same head before reading dependencies. This prevents
    // concurrent graph edits and deletes from passing checks against stale snapshots.
    const head = await CatalogState.findOneAndUpdate(
      { _id: 'catalogue' },
      { $inc: { sequence: 1 } },
      { new: true, session },
    );
    if (!head) throw new Error('Catalogue state has not been initialized.');
    const { result, audit } = await operation(session);
    const entry = {
      ...audit,
      sequence: head.sequence,
      previous_hash: head.hash,
      occurred_at: new Date(),
    };
    entry.current_hash = hashEntry(entry);
    await AuditLog.create([entry], { session });
    head.hash = entry.current_hash;
    await head.save({ session });
    return result;
  });
}
