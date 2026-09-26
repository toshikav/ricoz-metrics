import { parseSQL, extractMetricDependencies } from './sqlParser.service.js';
export function detectBreakingChanges(oldSQL, newSQL) {
  const before = parseSQL(oldSQL),
    after = parseSQL(newSQL);
  if (!before.valid || !after.valid)
    return { canAnalyze: false, error: 'One or both queries are invalid SELECT statements.' };
  const breakingChanges = [];
  const add = (type, description, severity = 'HIGH') =>
    breakingChanges.push({
      type,
      description,
      severity,
      impact: 'Review downstream results before certification.',
    });
  for (const [field, label] of [
    ['tables', 'Tables'],
    ['columns', 'Columns'],
    ['functions', 'Functions'],
  ]) {
    if (JSON.stringify([...before[field]].sort()) !== JSON.stringify([...after[field]].sort()))
      add(
        field.toUpperCase() + '_CHANGED',
        label +
          ' changed from [' +
          before[field].join(', ') +
          '] to [' +
          after[field].join(', ') +
          '].',
      );
  }
  if (
    JSON.stringify(extractMetricDependencies(oldSQL).sort()) !==
    JSON.stringify(extractMetricDependencies(newSQL).sort())
  )
    add('DEPENDENCIES_CHANGED', 'Referenced metrics changed.');
  // AST comparison catches changed literals, predicates, aliases, denominators and join conditions.
  if (JSON.stringify(before.ast) !== JSON.stringify(after.ast))
    add(
      'CALCULATION_CHANGED',
      'The query structure or expressions changed. Treat this as potentially breaking.',
      'CRITICAL',
    );
  const isBreaking = breakingChanges.length > 0;
  return {
    canAnalyze: true,
    isBreaking,
    severity: breakingChanges.some((c) => c.severity === 'CRITICAL')
      ? 'CRITICAL'
      : isBreaking
        ? 'HIGH'
        : 'LOW',
    breakingChanges,
    nonBreakingChanges: [],
    warnings: [],
    totalChanges: breakingChanges.length,
    recommendation: isBreaking
      ? 'Review the definition and downstream metrics before certifying a replacement.'
      : 'No structural change detected. This is a static comparison, not a proof of equivalent results.',
  };
}
export const generateChangeSummary = (a) =>
  a.canAnalyze
    ? (a.isBreaking
        ? 'Potentially breaking changes detected.'
        : 'No structural changes detected.') +
      '\n' +
      a.breakingChanges.map((c) => c.description).join('\n') +
      '\n' +
      a.recommendation
    : a.error;
