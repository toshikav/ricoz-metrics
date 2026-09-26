import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    metric_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    metric_name: { type: String, required: true },
    version: { type: Number, required: true },
    change_type: String,
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    changes_summary: String,
    changed_fields: [String],
    changed_by: { type: String, required: true },
    is_breaking: { type: Boolean, default: false },
    breaking_reason: String,
  },
  { timestamps: true, minimize: false },
);
schema.index({ metric_id: 1, version: 1 }, { unique: true });
schema.index({ is_breaking: 1, createdAt: -1 });
export default mongoose.model('MetricVersion', schema);
