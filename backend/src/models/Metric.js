import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    display_name: { type: String, required: true },
    description: { type: String, required: true },
    metric_type: { type: String, enum: ['BASE', 'COMPOSITE', 'RATIO'], required: true },
    domain: { type: String, required: true },
    operational_tier: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
    calculation_logic: {
      sql_template: { type: String, required: true },
      dependencies: [String],
      parameters: { type: Map, of: String },
      aggregation: String,
    },
    state: {
      type: String,
      enum: ['DRAFT', 'IN_REVIEW', 'CERTIFIED', 'DEPRECATED', 'ARCHIVED'],
      default: 'DRAFT',
    },
    created_by: { type: String, required: true },
    steward: String,
    tags: [String],
    version: { type: Number, default: 1 },
    last_certified_at: Date,
    last_modified_by: String,
  },
  { timestamps: true, minimize: false },
);
schema.index({ domain: 1, state: 1, updatedAt: -1 });
schema.index({ 'calculation_logic.dependencies': 1 });
export default mongoose.model('Metric', schema);
