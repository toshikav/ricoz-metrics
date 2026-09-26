import { Metric } from '../models/index.js';
import { extractMetricDependencies } from './sqlParser.service.js';
export async function loadGraph(session = null) {
  const rows = await Metric.find().session(session).lean();
  return new Map(rows.map((m) => [m.name, m]));
}
export function findCycle(graph, start) {
  const finished = new Set();
  function visit(name, path) {
    if (path.includes(name)) return [...path.slice(path.indexOf(name)), name];
    if (finished.has(name)) return null;
    const metric = graph.get(name);
    for (const dep of extractMetricDependencies(metric?.calculation_logic?.sql_template)) {
      const cycle = visit(dep, [...path, name]);
      if (cycle) return cycle;
    }
    finished.add(name);
    return null;
  }
  return visit(start, []);
}
export async function buildDependencyTree(name) {
  const graph = await loadGraph();
  let budget = 500;
  function build(current, path = []) {
    const depth = path.length,
      metric = graph.get(current);
    if (path.includes(current)) return { name: current, circular: true, depth };
    if (depth > 30 || budget-- <= 0)
      return { name: current, depth, error: 'Graph display limit reached' };
    if (!metric) return { name: current, exists: false, depth };
    const dependencies = extractMetricDependencies(metric.calculation_logic.sql_template);
    return {
      name: current,
      id: metric._id,
      metric_type: metric.metric_type,
      state: metric.state,
      exists: true,
      dependencies,
      children: dependencies.map((dep) => build(dep, [...path, current])),
      depth,
    };
  }
  return build(name);
}
export async function getDownstreamMetrics(name) {
  const graph = await loadGraph(),
    visited = new Set([name]),
    queue = [{ name, depth: 0 }],
    downstream = [];
  while (queue.length) {
    const current = queue.shift();
    for (const metric of graph.values()) {
      if (
        !visited.has(metric.name) &&
        extractMetricDependencies(metric.calculation_logic.sql_template).includes(current.name)
      ) {
        visited.add(metric.name);
        const depth = current.depth + 1;
        queue.push({ name: metric.name, depth });
        downstream.push({
          id: metric._id,
          name: metric.name,
          display_name: metric.display_name,
          metric_type: metric.metric_type,
          state: metric.state,
          operational_tier: metric.operational_tier,
          depth,
        });
      }
    }
  }
  return downstream;
}
export async function detectCircularDependencies(name) {
  const path = findCycle(await loadGraph(), name);
  return { hasCircular: !!path, path: path || [] };
}
export async function calculateImpactScore(name, supplied) {
  const downstream = supplied || (await getDownstreamMetrics(name));
  const certifiedAffected = downstream.filter((m) => m.state === 'CERTIFIED').length;
  const criticalAffected = downstream.filter((m) => m.operational_tier === 'CRITICAL').length;
  const impactScore = Math.min(
    100,
    downstream.length * 10 + certifiedAffected * 20 + criticalAffected * 30,
  );
  return {
    impactScore,
    totalAffected: downstream.length,
    certifiedAffected,
    criticalAffected,
    affectedMetrics: downstream,
    riskLevel: impactScore < 30 ? 'LOW' : impactScore < 60 ? 'MEDIUM' : 'HIGH',
  };
}
