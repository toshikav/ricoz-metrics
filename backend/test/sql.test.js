import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSQL,
  validateSQL,
  extractMetricDependencies,
} from '../src/services/sqlParser.service.js';
import { detectBreakingChanges } from '../src/services/breakingChange.service.js';
test('parses table names, nested subqueries, functions and joins', () => {
  const m = parseSQL(
    'SELECT SUM(o.amount) AS revenue FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.amount > 0 GROUP BY c.id',
  );
  assert.equal(m.valid, true);
  assert.deepEqual(m.tables.sort(), ['customers', 'orders']);
  assert.equal(m.hasJoin, true);
  assert.equal(m.hasGroupBy, true);
  assert.equal(m.hasWhere, true);
  assert.ok(m.functions.includes('SUM'));
  assert.ok(
    parseSQL('SELECT COUNT(*) FROM (SELECT id FROM orders WHERE amount > 0) x').tables.includes(
      'orders',
    ),
  );
});
test('metric placeholders work without mistaking strings or comments for dependencies', () => {
  const sql = "SELECT ${revenue} / NULLIF(${orders}, 0), '${ignored}' /* ${comment} */";
  assert.equal(validateSQL(sql).valid, true);
  assert.deepEqual(extractMetricDependencies(sql), ['revenue', 'orders']);
});
test('invalid, multiple and destructive statements are refused', () => {
  for (const sql of [
    null,
    42,
    '',
    'DELETE FROM orders',
    'SELECT 1; SELECT 2',
    'SELECT FROM',
    'SELECT 1; DROP TABLE orders',
  ])
    assert.equal(validateSQL(sql).valid, false, String(sql));
});
test('comparison catches changed predicates, denominator, aliases and join conditions', () => {
  for (const [a, b] of [
    [
      'SELECT SUM(amount) FROM orders WHERE amount > 1',
      'SELECT SUM(amount) FROM orders WHERE amount > 2',
    ],
    ['SELECT a / b FROM orders', 'SELECT a / c FROM orders'],
    ['SELECT amount AS revenue FROM orders', 'SELECT amount AS sales FROM orders'],
    [
      'SELECT o.a FROM orders o JOIN costs c ON o.id = c.id',
      'SELECT o.a FROM orders o JOIN costs c ON o.id = c.order_id',
    ],
  ])
    assert.equal(detectBreakingChanges(a, b).isBreaking, true);
  assert.equal(
    detectBreakingChanges('SELECT SUM(amount) FROM orders', 'SELECT  SUM(amount)  FROM orders')
      .isBreaking,
    false,
  );
});
test('SELECT star emits a warning', () =>
  assert.ok(validateSQL('SELECT * FROM orders').warnings.some((w) => w.includes('SELECT *'))));
