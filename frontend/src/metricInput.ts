import type { Definition, Metric } from './types';
export function dependencies(sql: string): string[] {
  const values = new Set<string>();
  const tokens =
    /'(?:''|\\.|[^'\\])*'|"(?:""|\\.|[^"\\])*"|`(?:``|[^`])*`|--[^\n]*|\/\*[\s\S]*?\*\/|\$\{([a-z0-9_]+)\}/g;
  for (const match of sql.matchAll(tokens)) if (match[1]) values.add(match[1]);
  return [...values];
}
export function definition(m: Metric): Definition {
  return {
    name: m.name,
    display_name: m.display_name,
    description: m.description,
    metric_type: m.metric_type,
    domain: m.domain,
    operational_tier: m.operational_tier,
    calculation_logic: m.calculation_logic,
    state: m.state,
    created_by: m.created_by,
    steward: m.steward || '',
    tags: m.tags,
  };
}
export function parameters(text: string): Record<string, string> {
  const parsed = JSON.parse(text);
  if (
    !parsed ||
    Array.isArray(parsed) ||
    typeof parsed !== 'object' ||
    Object.values(parsed).some((v) => typeof v !== 'string')
  )
    throw new Error('Parameters must be a JSON object containing string values.');
  return parsed;
}
