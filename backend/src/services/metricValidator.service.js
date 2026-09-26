import { metricSchema, transitions } from '../validation.js';
import { validateSQL, extractMetricDependencies } from './sqlParser.service.js';
import { loadGraph, findCycle } from './dependencyGraph.service.js';
import { canonical } from '../models/AuditLog.js';
export async function validateMetric(input, { existing = null, session = null } = {}) {
  const shape = metricSchema.safeParse(input);
  if (!shape.success)
    return {
      valid: false,
      errors: shape.error.issues.map((i) => i.path.join('.') + ': ' + i.message),
      warnings: [],
      dependencies: [],
    };
  const data = shape.data,
    sql = validateSQL(data.calculation_logic.sql_template);
  const errors = [...sql.errors],
    warnings = [...sql.warnings];
  const dependencies = extractMetricDependencies(data.calculation_logic.sql_template);
  const graph = await loadGraph(session);
  const duplicate = graph.get(data.name);
  if (duplicate && String(duplicate._id) !== String(existing?._id))
    errors.push('A metric with this name already exists.');
  if (
    JSON.stringify([...data.calculation_logic.dependencies].sort()) !==
    JSON.stringify([...dependencies].sort())
  )
    errors.push('Dependencies must exactly match the metric placeholders in SQL.');
  if (data.metric_type === 'BASE' && dependencies.length)
    errors.push('BASE metrics cannot reference other metrics.');
  if (data.metric_type === 'COMPOSITE' && !dependencies.length)
    warnings.push('COMPOSITE metrics usually reference other metrics.');
  if (data.metric_type === 'RATIO' && dependencies.length !== 2)
    warnings.push('RATIO metrics usually reference a numerator and denominator.');
  for (const dep of dependencies) {
    const metric = graph.get(dep);
    if (!metric) errors.push("Dependency '" + dep + "' does not exist.");
    else {
      if (['ARCHIVED', 'DEPRECATED'].includes(metric.state))
        warnings.push("Dependency '" + dep + "' is " + metric.state.toLowerCase() + '.');
      if (data.state === 'CERTIFIED' && metric.state !== 'CERTIFIED')
        errors.push("Certify dependency '" + dep + "' before certifying this metric.");
      if (data.operational_tier === 'CRITICAL' && metric.operational_tier !== 'CRITICAL')
        warnings.push("Critical metric references non-critical dependency '" + dep + "'.");
    }
  }
  if (existing) {
    if (data.created_by !== existing.created_by)
      errors.push('The original creator cannot be changed.');
    if (data.state !== existing.state && !transitions[existing.state]?.includes(data.state))
      errors.push('Invalid state transition: ' + existing.state + ' → ' + data.state);
    const downstream = [...graph.values()].filter((m) =>
      extractMetricDependencies(m.calculation_logic.sql_template).includes(existing.name),
    );
    if (data.name !== existing.name && downstream.length)
      errors.push('Cannot rename a metric referenced by other metrics.');
    if (
      data.state === 'ARCHIVED' &&
      existing.state !== 'ARCHIVED' &&
      downstream.some((m) => m.state !== 'ARCHIVED')
    )
      errors.push('Archive active downstream metrics first.');
    if (existing.state === 'ARCHIVED') errors.push('Archived metrics are read-only.');
    if (existing.state === 'CERTIFIED') {
      warnings.push('Certified definition: review metadata changes with the steward.');
      if (
        data.name !== existing.name ||
        data.metric_type !== existing.metric_type ||
        canonical(data.calculation_logic) !== canonical(existing.calculation_logic)
      )
        errors.push(
          'Certified calculation logic is frozen. Create a replacement metric and deprecate the old definition.',
        );
    }
    graph.delete(existing.name);
  } else if (data.state !== 'DRAFT') errors.push('New metrics must start in DRAFT.');
  if (data.state === 'CERTIFIED' && !data.steward)
    errors.push('A steward is required for certification.');
  graph.set(data.name, data);
  const cycle = findCycle(graph, data.name);
  if (cycle) errors.push('Circular dependency: ' + cycle.join(' → '));
  return { valid: !errors.length, errors, warnings, dependencies, sqlMetadata: sql.metadata };
}
