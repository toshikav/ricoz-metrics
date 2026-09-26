import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { initializeDatabase } from '../src/config/database.js';
import { Metric, MetricVersion, AuditLog } from '../src/models/index.js';
let mongo;
before(
  async () => {
    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: '7.0.24' },
    });
    await mongoose.connect(mongo.getUri());
    await initializeDatabase();
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
const body = (name, sql = 'SELECT SUM(amount) AS total FROM orders', deps = []) => ({
  name,
  display_name: name,
  description: 'A documented metric definition',
  metric_type: deps.length ? 'COMPOSITE' : 'BASE',
  domain: 'Finance',
  operational_tier: 'MEDIUM',
  calculation_logic: { sql_template: sql, dependencies: deps, parameters: {}, aggregation: 'sum' },
  state: 'DRAFT',
  created_by: 'owner@example.com',
  steward: 'steward@example.com',
  tags: [],
});
const create = async (b) => {
  const r = await request(app).post('/api/v1/metrics').send(b);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data;
};
const update = (m, b) =>
  request(app)
    .put('/api/v1/metrics/' + m._id)
    .send({
      ...b,
      updated_by: 'editor@example.com',
      expected_version: m.version,
      changes_summary: 'Reviewed definition change',
    });
test('validates shape, nested payload, ID, filters, pagination and preserves details', async () => {
  for (const b of [
    {},
    { name: 'oops' },
    { calculation_logic: null },
    { ...body('invalid'), version: 99 },
  ]) {
    const r = await request(app).post('/api/v1/metrics').send(b);
    assert.equal(r.status, 400);
    assert.ok(r.body.error.details.errors.length);
  }
  for (const path of [
    '/api/v1/metrics/not-an-id',
    '/api/v1/metrics?page=-1',
    '/api/v1/metrics?limit=0',
    '/api/v1/metrics?limit=1000',
    '/api/v1/metrics?domain[$ne]=a',
  ])
    assert.equal((await request(app).get(path)).status, 400, path);
  assert.equal(
    (await request(app).post('/api/v1/analysis/validate-metric').send({})).body.data.valid,
    false,
  );
});
test('create/update history is atomic, creation state guarded, and same-state edits succeed', async () => {
  assert.equal(
    (
      await request(app)
        .post('/api/v1/metrics')
        .send({ ...body('premature'), state: 'CERTIFIED' })
    ).status,
    400,
  );
  const m = await create(body('atomic'));
  const r = await update(m, { description: 'Changed business description', state: 'DRAFT' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.version, 2);
  assert.equal(await MetricVersion.countDocuments({ metric_id: m._id }), 2);
  assert.equal(await AuditLog.countDocuments({ entity_id: m._id }), 2);
  assert.equal((await update(m, { description: 'Stale update' })).status, 409);
  const count = await MetricVersion.countDocuments({ metric_id: m._id });
  assert.equal((await update(r.body.data, { created_by: 'someone@example.com' })).status, 400);
  assert.equal(await MetricVersion.countDocuments({ metric_id: m._id }), count);
});
test('simultaneous saves allow one winner and preserve the chain', async () => {
  const m = await create(body('concurrency'));
  const results = await Promise.all([
    update(m, { description: 'Concurrent first' }),
    update(m, { description: 'Concurrent second' }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(await MetricVersion.countDocuments({ metric_id: m._id }), 2);
  assert.equal((await AuditLog.verifyChain()).valid, true);
});
test('missing actor never leaves a partial update', async () => {
  const m = await create(body('actor'));
  const r = await request(app)
    .put('/api/v1/metrics/' + m._id)
    .send({ description: 'Bad save', expected_version: 1, changes_summary: 'Missing actor' });
  assert.equal(r.status, 400);
  assert.equal((await Metric.findById(m._id)).version, 1);
});
test('an audit write failure rolls back the metric and its version', async () => {
  const original = AuditLog.create;
  AuditLog.create = async () => {
    throw new Error('Injected audit failure');
  };
  try {
    const r = await request(app).post('/api/v1/metrics').send(body('rollback'));
    assert.equal(r.status, 500);
    assert.equal(await Metric.countDocuments({ name: 'rollback' }), 0);
    assert.equal(await MetricVersion.countDocuments({ metric_name: 'rollback' }), 0);
  } finally {
    AuditLog.create = original;
  }
  assert.equal((await AuditLog.verifyChain()).valid, true);
});
test('simultaneous graph changes cannot introduce a cycle', async () => {
  const a = await create(body('race_a')),
    b = await create(body('race_b'));
  const r = await Promise.all([
    update(a, {
      metric_type: 'COMPOSITE',
      calculation_logic: { sql_template: 'SELECT ${race_b}', dependencies: ['race_b'] },
    }),
    update(b, {
      metric_type: 'COMPOSITE',
      calculation_logic: { sql_template: 'SELECT ${race_a}', dependencies: ['race_a'] },
    }),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [200, 400]);
});
test('dependency consistency, deep cycles, transitive impact, rename and delete guards', async () => {
  const a = await create(body('graph_a'));
  const b = await create(body('graph_b', 'SELECT ${graph_a} * 2 AS value', ['graph_a']));
  const c = await create(body('graph_c', 'SELECT ${graph_b} + 1 AS value', ['graph_b']));
  assert.equal(
    (
      await update(a, {
        metric_type: 'COMPOSITE',
        calculation_logic: { sql_template: 'SELECT ${graph_c}', dependencies: ['graph_c'] },
      })
    ).status,
    400,
  );
  assert.equal((await update(a, { name: 'renamed_a' })).status, 400);
  assert.equal(
    (
      await update(b, {
        calculation_logic: { sql_template: 'SELECT ${missing}', dependencies: ['missing'] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post('/api/v1/metrics')
        .send(body('mismatch', 'SELECT ${graph_a}', []))
    ).status,
    400,
  );
  const impact = await request(app).get('/api/v1/analysis/metrics/' + a._id + '/impact');
  assert.equal(impact.body.data.impactAnalysis.totalAffected, 2);
  assert.equal(impact.body.data.downstream.find((m) => m.name === 'graph_c').depth, 2);
  const denied = await request(app)
    .delete('/api/v1/metrics/' + a._id)
    .send({ deleted_by: 'owner@example.com', expected_version: 1 });
  assert.equal(denied.status, 409);
  assert.ok(denied.body.error.details.dependents.length);
  const tree = await request(app).get('/api/v1/analysis/metrics/' + c._id + '/dependencies');
  assert.equal(tree.body.data.children[0].children[0].name, 'graph_a');
});
test('certification freezes logic; lifecycle and deletion are enforced', async () => {
  let m = await create(body('lifecycle'));
  assert.equal((await update(m, { state: 'CERTIFIED' })).status, 400);
  m = (await update(m, { state: 'IN_REVIEW' })).body.data;
  let r = await update(m, { state: 'CERTIFIED' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  m = r.body.data;
  assert.ok(m.last_certified_at);
  assert.equal(
    (await update(m, { calculation_logic: { sql_template: 'SELECT COUNT(*) FROM orders' } }))
      .status,
    400,
  );
  r = await update(m, { description: 'Clarified certified metadata' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  m = r.body.data;
  assert.equal(
    (
      await request(app)
        .delete('/api/v1/metrics/' + m._id)
        .send({ deleted_by: 'owner@example.com', expected_version: m.version })
    ).status,
    409,
  );
  m = (await update(m, { state: 'DEPRECATED' })).body.data;
  r = await request(app)
    .delete('/api/v1/metrics/' + m._id)
    .send({ deleted_by: 'owner@example.com', expected_version: m.version });
  assert.equal(r.status, 200);
  assert.ok((await request(app).get('/api/v1/metrics/' + m._id + '/audit')).body.total >= 4);
  assert.equal((await request(app).get('/api/v1/metrics/' + m._id)).status, 404);
});
test('breaking history survives later metadata edits; aggregates cover all records', async () => {
  let m = await create(body('breaking'));
  m = (
    await update(m, {
      calculation_logic: { sql_template: 'SELECT AVG(amount) AS total FROM orders' },
    })
  ).body.data;
  await update(m, { description: 'Metadata after breaking change' });
  const changes = await request(app).get('/api/v1/analysis/breaking-changes');
  assert.ok(changes.body.data.some((c) => c.metric.name === 'breaking' && c.latestVersion === 2));
  const summary = await request(app).get('/api/v1/metrics/summary');
  assert.equal(summary.body.data.total, await Metric.countDocuments());
  const search = await request(app).get('/api/v1/metrics?search=graph_&limit=1');
  assert.equal(search.body.total, 3);
  assert.equal(search.body.data.length, 1);
  assert.equal((await request(app).get('/api/health')).body.status, 'OK');
});
test('audit verification detects content tampering and tail deletion', async () => {
  assert.equal((await AuditLog.verifyChain()).valid, true);
  const log = await AuditLog.findOne().sort({ sequence: 1 }).lean();
  await AuditLog.collection.updateOne({ _id: log._id }, { $set: { summary: 'tampered' } });
  assert.equal((await AuditLog.verifyChain()).valid, false);
  await AuditLog.collection.updateOne({ _id: log._id }, { $set: { summary: log.summary } });
  assert.equal((await AuditLog.verifyChain()).valid, true);
  const tail = await AuditLog.findOne().sort({ sequence: -1 }).lean();
  await AuditLog.collection.deleteOne({ _id: tail._id });
  assert.equal((await AuditLog.verifyChain()).valid, false);
  await AuditLog.collection.insertOne(tail);
});
