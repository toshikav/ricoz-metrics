import { z } from 'zod';
import { Metric, MetricVersion, AuditLog } from '../models/index.js';
import { validateMetric } from '../services/metricValidator.service.js';
import { detectBreakingChanges } from '../services/breakingChange.service.js';
import { extractMetricDependencies } from '../services/sqlParser.service.js';
import { catalogueWrite } from '../services/catalogueWrite.js';
import { canonical } from '../models/AuditLog.js';
import { parse, fail, metricSchema, updateSchema, listSchema, email } from '../validation.js';
export const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
export async function requireMetric(id, session = null) {
  const metric = await Metric.findById(id).session(session).lean({ flattenMaps: true });
  if (!metric) throw fail('Metric not found.', 404);
  // Lean maps are plain objects; only catalogue fields are passed to validation.
  return metric;
}
export function definition(metric) {
  return Object.fromEntries(Object.keys(metricSchema.shape).map((key) => [key, metric[key]]));
}
function checked(validation) {
  if (!validation.valid)
    throw fail('Metric validation failed.', 400, {
      errors: validation.errors,
      warnings: validation.warnings,
    });
}
export const getAllMetrics = route(async (req, res) => {
  const { page, limit, search, ...filters } = parse(listSchema, req.query);
  const query = { ...filters };
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = ['name', 'display_name', 'description', 'tags'].map((field) => ({
      [field]: { $regex: escaped, $options: 'i' },
    }));
  }
  const [data, total] = await Promise.all([
    Metric.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Metric.countDocuments(query),
  ]);
  res.json({
    success: true,
    count: data.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data,
  });
});
export const getMetricById = route(async (req, res) =>
  res.json({ success: true, data: await requireMetric(req.params.id) }),
);
export const getSummary = route(async (req, res) => {
  const [summary] = await Metric.aggregate([
    {
      $facet: {
        total: [{ $count: 'count' }],
        byState: [{ $group: { _id: '$state', count: { $sum: 1 } } }],
        byType: [{ $group: { _id: '$metric_type', count: { $sum: 1 } } }],
        byTier: [{ $group: { _id: '$operational_tier', count: { $sum: 1 } } }],
        domains: [
          { $group: { _id: '$domain', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
        ],
      },
    },
  ]);
  res.json({ success: true, data: { ...summary, total: summary.total[0]?.count || 0 } });
});
export const createMetric = route(async (req, res) => {
  const input = parse(metricSchema, req.body);
  const result = await catalogueWrite(async (session) => {
    const validation = await validateMetric(input, { session });
    checked(validation);
    const [metric] = await Metric.create([input], { session });
    const snapshot = metric.toObject({ flattenMaps: true });
    await MetricVersion.create(
      [
        {
          metric_id: metric._id,
          metric_name: metric.name,
          version: 1,
          change_type: 'CREATED',
          snapshot,
          changes_summary: 'Initial definition',
          changed_by: input.created_by,
        },
      ],
      { session },
    );
    return {
      result: {
        success: true,
        message: 'Metric created.',
        data: snapshot,
        validation: { warnings: validation.warnings },
      },
      audit: {
        event_type: 'CREATE',
        entity_type: 'METRIC',
        entity_id: metric._id,
        entity_name: metric.name,
        actor: input.created_by,
        changes: { before: null, after: snapshot },
        summary: 'Created ' + metric.display_name,
      },
    };
  });
  res.status(201).json(result);
});
export const updateMetric = route(async (req, res) => {
  const { updated_by, expected_version, changes_summary, ...updates } = parse(
    updateSchema,
    req.body,
  );
  const result = await catalogueWrite(async (session) => {
    const before = await requireMetric(req.params.id, session);
    if (expected_version !== before.version)
      throw fail('This metric changed since you opened it. Reload before saving.', 409);
    const input = parse(metricSchema, {
      ...definition(before),
      ...updates,
      calculation_logic: { ...before.calculation_logic, ...updates.calculation_logic },
    });
    const validation = await validateMetric(input, { existing: before, session });
    checked(validation);
    const changed_fields = Object.keys(input).filter(
      (k) => canonical(input[k]) !== canonical(before[k]),
    );
    if (!changed_fields.length) throw fail('No changes to save.');
    const analysis = detectBreakingChanges(
      before.calculation_logic.sql_template,
      input.calculation_logic.sql_template,
    );
    const isBreaking =
      !!analysis.isBreaking ||
      changed_fields.includes('metric_type') ||
      changed_fields.includes('name') ||
      input.calculation_logic.aggregation !== before.calculation_logic.aggregation ||
      canonical(input.calculation_logic.parameters) !==
        canonical(before.calculation_logic.parameters);
    const after = await Metric.findOneAndUpdate(
      { _id: before._id, version: before.version },
      {
        $set: {
          ...input,
          version: before.version + 1,
          last_modified_by: updated_by,
          ...(input.state === 'CERTIFIED' && before.state !== 'CERTIFIED'
            ? { last_certified_at: new Date() }
            : {}),
        },
      },
      { new: true, session, runValidators: true },
    ).lean();
    if (!after) throw fail('Concurrent update. Reload and try again.', 409);
    await MetricVersion.create(
      [
        {
          metric_id: after._id,
          metric_name: after.name,
          version: after.version,
          change_type: isBreaking ? 'BREAKING_CHANGE' : 'NON_BREAKING_CHANGE',
          snapshot: after,
          changes_summary,
          changed_fields,
          changed_by: updated_by,
          is_breaking: isBreaking,
          breaking_reason: isBreaking ? analysis.recommendation : null,
        },
      ],
      { session },
    );
    const event_type =
      input.state !== before.state && input.state === 'CERTIFIED'
        ? 'CERTIFY'
        : input.state !== before.state && input.state === 'DEPRECATED'
          ? 'DEPRECATE'
          : 'UPDATE';
    return {
      result: {
        success: true,
        message: 'Metric updated.',
        data: after,
        changeAnalysis: {
          is_breaking: isBreaking,
          changed_fields,
          breaking_changes: analysis.breakingChanges || [],
          warnings: validation.warnings,
        },
      },
      audit: {
        event_type,
        entity_type: 'METRIC',
        entity_id: after._id,
        entity_name: after.name,
        actor: updated_by,
        changes: { before, after },
        summary: changes_summary,
      },
    };
  });
  res.json(result);
});
export const deleteMetric = route(async (req, res) => {
  const { deleted_by, expected_version } = parse(
    z.strictObject({ deleted_by: email, expected_version: z.number().int().positive() }),
    req.body,
  );
  const result = await catalogueWrite(async (session) => {
    const metric = await requireMetric(req.params.id, session);
    if (expected_version !== metric.version)
      throw fail('This metric changed. Reload before deleting.', 409);
    const all = await Metric.find({ _id: { $ne: metric._id } })
      .session(session)
      .lean();
    const dependents = all.filter((m) =>
      extractMetricDependencies(m.calculation_logic.sql_template).includes(metric.name),
    );
    if (dependents.length)
      throw fail('Other metrics depend on this metric.', 409, {
        dependents: dependents.map((m) => ({
          name: m.name,
          display_name: m.display_name,
          state: m.state,
        })),
      });
    if (metric.state === 'CERTIFIED')
      throw fail('Deprecate or archive a certified metric before deletion.', 409);
    await Metric.deleteOne({ _id: metric._id }, { session });
    return {
      result: { success: true, message: 'Metric deleted. History retained.', data: {} },
      audit: {
        event_type: 'DELETE',
        entity_type: 'METRIC',
        entity_id: metric._id,
        entity_name: metric.name,
        actor: deleted_by,
        changes: { before: metric, after: null },
        summary: 'Deleted ' + metric.display_name,
      },
    };
  });
  res.json(result);
});
export const getMetricVersions = route(async (req, res) => {
  const { page, limit } = parse(listSchema.pick({ page: true, limit: true }), req.query);
  const query = { metric_id: req.params.id };
  const [data, total] = await Promise.all([
    MetricVersion.find(query)
      .sort({ version: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    MetricVersion.countDocuments(query),
  ]);
  res.json({
    success: true,
    count: data.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data,
  });
});
export const getMetricAuditLogs = route(async (req, res) => {
  const { page, limit } = parse(listSchema.pick({ page: true, limit: true }), req.query);
  const query = { entity_id: req.params.id };
  const [data, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ sequence: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);
  res.json({
    success: true,
    count: data.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data,
  });
});
