import { z } from 'zod';
import { Metric, MetricVersion } from '../models/index.js';
import { validateSQL } from '../services/sqlParser.service.js';
import {
  buildDependencyTree,
  getDownstreamMetrics,
  detectCircularDependencies,
  calculateImpactScore,
} from '../services/dependencyGraph.service.js';
import {
  detectBreakingChanges,
  generateChangeSummary,
} from '../services/breakingChange.service.js';
import { validateMetric } from '../services/metricValidator.service.js';
import { parse, listSchema, metricSchema, fail } from '../validation.js';
import { route, requireMetric } from './metricController.js';
const sql = z.string().min(1).max(20000);
export const validateSQLEndpoint = route(async (req, res) => {
  const body = parse(z.strictObject({ sql }), req.body);
  const result = validateSQL(body.sql);
  res.json({ success: true, data: { ...result, metadata: result.metadata } });
});
export const compareSQLQueries = route(async (req, res) => {
  const body = parse(z.strictObject({ oldSQL: sql, newSQL: sql }), req.body);
  const analysis = detectBreakingChanges(body.oldSQL, body.newSQL);
  res.json({ success: true, data: { analysis, summary: generateChangeSummary(analysis) } });
});
export const validateMetricEndpoint = route(async (req, res) => {
  const { metric_id, ...input } = req.body || {};
  if (metric_id && !/^[a-f0-9]{24}$/i.test(metric_id)) throw fail('Invalid metric ID.');
  const existing = metric_id ? await requireMetric(metric_id) : null;
  res.json({ success: true, data: await validateMetric(input, { existing }) });
});
export const getMetricDependencies = route(async (req, res) => {
  const m = await requireMetric(req.params.id);
  res.json({ success: true, data: await buildDependencyTree(m.name) });
});
export const getMetricImpact = route(async (req, res) => {
  const m = await requireMetric(req.params.id),
    downstream = await getDownstreamMetrics(m.name);
  res.json({
    success: true,
    data: {
      metric: { name: m.name, display_name: m.display_name, state: m.state },
      downstream,
      impactAnalysis: await calculateImpactScore(m.name, downstream),
    },
  });
});
export const checkCircularDependencies = route(async (req, res) => {
  const m = await requireMetric(req.params.id);
  res.json({ success: true, data: await detectCircularDependencies(m.name) });
});
export const getAllBreakingChanges = route(async (req, res) => {
  const { page, limit } = parse(listSchema.pick({ page: true, limit: true }), req.query);
  const query = { is_breaking: true };
  const [versions, total] = await Promise.all([
    MetricVersion.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    MetricVersion.countDocuments(query),
  ]);
  const existing = new Set(
    (
      await Metric.find({ _id: { $in: versions.map((v) => v.metric_id) } })
        .select('_id')
        .lean()
    ).map((m) => String(m._id)),
  );
  res.json({
    success: true,
    count: versions.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: versions.map((v) => ({
      metric: { id: v.metric_id, name: v.metric_name, display_name: v.snapshot.display_name },
      is_deleted: !existing.has(String(v.metric_id)),
      latestVersion: v.version,
      createdAt: v.createdAt,
      changed_by: v.changed_by,
      summary: v.changes_summary,
      analysis: {
        canAnalyze: true,
        isBreaking: true,
        severity: 'HIGH',
        recommendation: v.breaking_reason,
        changed_fields: v.changed_fields,
      },
    })),
  });
});
