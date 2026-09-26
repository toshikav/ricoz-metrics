import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
export function canonical(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value.toHexString) return JSON.stringify(value.toHexString());
  if (value instanceof Map) return canonical(Object.fromEntries(value));
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
      .join(',') +
    '}'
  );
}
export function hashEntry(entry) {
  const {
    sequence,
    event_type,
    entity_type,
    entity_id,
    entity_name,
    actor,
    changes,
    summary,
    previous_hash,
    occurred_at,
  } = entry;
  return createHash('sha256')
    .update(
      canonical({
        sequence,
        event_type,
        entity_type,
        entity_id,
        entity_name,
        actor,
        changes,
        summary,
        previous_hash,
        occurred_at,
      }),
    )
    .digest('hex');
}
const schema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true, unique: true },
    event_type: String,
    entity_type: String,
    entity_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    entity_name: String,
    actor: { type: String, required: true },
    changes: mongoose.Schema.Types.Mixed,
    summary: String,
    previous_hash: String,
    current_hash: String,
    occurred_at: Date,
  },
  { timestamps: true, minimize: false },
);
schema.index({ entity_id: 1, sequence: -1 });
schema.statics.verifyChain = async function () {
  return mongoose.connection.transaction(
    async (session) => {
      const logs = await this.find().sort({ sequence: 1 }).session(session).lean();
      let previous = '0',
        sequence = 0;
      for (const log of logs) {
        if (
          log.sequence !== ++sequence ||
          log.previous_hash !== previous ||
          hashEntry(log) !== log.current_hash
        )
          return {
            valid: false,
            brokenAt: log._id,
            message: 'Audit entry content, sequence or predecessor does not match.',
          };
        previous = log.current_hash;
      }
      const head = await mongoose
        .model('CatalogState')
        .findById('catalogue')
        .session(session)
        .lean();
      if (head && (head.sequence !== sequence || head.hash !== previous))
        return { valid: false, message: 'Audit chain does not match its stored head.' };
      return { valid: true, count: logs.length, message: 'Audit entries and chain head verified.' };
    },
    { readConcern: { level: 'snapshot' } },
  );
};
export default mongoose.model('AuditLog', schema);
