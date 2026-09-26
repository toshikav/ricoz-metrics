import pkg from 'node-sql-parser';
const parser = new pkg.Parser();
// Quoted strings and comments are excluded from placeholder recognition.
export function templateTokens(sql) {
  const dependencies = new Set();
  const pattern =
    /'(?:''|\\.|[^'\\])*'|"(?:""|\\.|[^"\\])*"|`(?:``|[^`])*`|--[^\n]*|\/\*[\s\S]*?\*\/|\$\{([a-z0-9_]+)\}/g;
  const normalized = sql.replace(pattern, (token, name) => {
    if (!name) return token;
    dependencies.add(name);
    return '`__metric_' + name + '`';
  });
  return { normalized, dependencies: [...dependencies] };
}
export const extractMetricDependencies = (sql) =>
  typeof sql === 'string' ? templateTokens(sql).dependencies : [];
export function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node))
    if (value && typeof value === 'object') walk(value, visit);
}
export function parseSQL(sql) {
  try {
    if (typeof sql !== 'string' || !sql.trim() || sql.length > 20000)
      throw new Error('SQL must contain 1–20,000 characters.');
    const { normalized } = templateTokens(sql);
    const raw = parser.astify(normalized, { database: 'MySQL' });
    if (Array.isArray(raw) && raw.length !== 1)
      throw new Error('Exactly one SELECT statement is supported.');
    const ast = Array.isArray(raw) ? raw[0] : raw;
    if (ast?.type !== 'select') throw new Error('Only SELECT statements are supported.');
    const tables = new Set(),
      columns = new Set(),
      functions = new Set();
    let hasWhere = false,
      hasGroupBy = false,
      hasJoin = false;
    walk(ast, (node) => {
      if (typeof node.table === 'string' && !node.type && !node.table.startsWith('__metric_'))
        tables.add(node.db ? node.db + '.' + node.table : node.table);
      if (node.type === 'column_ref') columns.add(node.column);
      if (node.type === 'aggr_func' || node.type === 'function') {
        const name =
          typeof node.name === 'string'
            ? node.name
            : node.name?.name?.map((n) => n.value).join('.');
        if (name) functions.add(name.toUpperCase());
      }
      hasWhere ||= !!node.where;
      hasGroupBy ||= !!node.groupby;
      hasJoin ||= !!node.join;
      if (node.into?.position || node.locking_read)
        throw new Error('SELECT output and locking clauses are not supported.');
    });
    return {
      valid: true,
      tables: [...tables],
      columns: [...columns],
      functions: [...functions],
      hasWhere,
      hasGroupBy,
      hasJoin,
      ast,
      dialect: 'MySQL',
    };
  } catch (error) {
    return { valid: false, error: error.message, errorType: 'SYNTAX_ERROR' };
  }
}
export function validateSQL(sql) {
  const metadata = parseSQL(sql);
  if (!metadata.valid)
    return { valid: false, errors: [metadata.error], warnings: [], metadata: null };
  const warnings = [];
  if (!metadata.hasWhere && metadata.tables.length)
    warnings.push('This query has no WHERE clause; confirm the intended scope.');
  if (metadata.columns.includes('*')) warnings.push('Prefer explicit columns over SELECT *.');
  return { valid: true, errors: [], warnings, metadata };
}
