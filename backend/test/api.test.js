import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { initializeDatabase } from '../src/config/database.js';
import { Metric, MetricVersion, AuditLog } from '../src/models/index.js';
let mongo;
let stewardAgent;
let engineerAgent;
before(
  async () => {
    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: '7.0.24' },
    });
    await mongoose.connect(mongo.getUri());
    await initializeDatabase();
    stewardAgent = request.agent(app);
    const setup = await stewardAgent.post('/api/v1/auth/setup').send({
      email: 'steward@ricoz.test',
      password: 'steward-pass-12',
      name: 'Catalogue steward',
    });
    assert.equal(setup.status, 201, JSON.stringify(setup.body));
    const engineer = await stewardAgent.post('/api/v1/auth/users').send({
      email: 'engineer@ricoz.test',
      password: 'engineer-pass-12',
      name: 'Catalogue engineer',
      role: 'engineer',
    });
    assert.equal(engineer.status, 201, JSON.stringify(engineer.body));
    engineerAgent = request.agent(app);
    const login = await engineerAgent.post('/api/v1/auth/login').send({
      email: 'engineer@ricoz.test',
      password: 'engineer-pass-12',
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
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
  const r = await stewardAgent.post('/api/v1/metrics').send(b);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data;
};
const update = (m, b) =>
  stewardAgent
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
    const r = await stewardAgent.post('/api/v1/metrics').send(b);
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
    assert.equal((await stewardAgent.get(path)).status, 400, path);
  assert.equal(
    (await stewardAgent.post('/api/v1/analysis/validate-metric').send({})).body.data.valid,
    false,
  );
});
test('create/update history is atomic, creation state guarded, and same-state edits succeed', async () => {
  assert.equal(
    (
      await stewardAgent
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
test('an unauthenticated write is rejected and leaves the metric unchanged', async () => {
  const m = await create(body('actor'));
  const r = await request(app)
    .put('/api/v1/metrics/' + m._id)
    .send({ description: 'Bad save', expected_version: 1, changes_summary: 'Missing session' });
  assert.equal(r.status, 401);
  assert.equal((await Metric.findById(m._id)).version, 1);
  assert.equal((await request(app).get('/api/v1/metrics')).status, 401);
  const again = await request(app).post('/api/v1/auth/setup').send({
    email: 'other@ricoz.test',
    password: 'other-pass-1234',
    name: 'Second steward',
  });
  assert.equal(again.status, 409, JSON.stringify(again.body));
});
test('roles are enforced on the server', async () => {
  const consumer = request.agent(app);
  assert.equal(
    (
      await stewardAgent.post('/api/v1/auth/users').send({
        email: 'consumer@ricoz.test',
        password: 'consumer-pass-12',
        name: 'Catalogue reader',
        role: 'consumer',
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await consumer
        .post('/api/v1/auth/login')
        .send({ email: 'consumer@ricoz.test', password: 'consumer-pass-12' })
    ).status,
    200,
  );
  assert.equal((await consumer.post('/api/v1/metrics').send(body('reader_denied'))).status, 403);
  assert.equal(
    (await engineerAgent.post('/api/v1/metrics').send({ ...body('early'), state: 'CERTIFIED' }))
      .status,
    403,
  );
  const draft = await engineerAgent.post('/api/v1/metrics').send(body('engineer_draft'));
  assert.equal(draft.status, 201, JSON.stringify(draft.body));
  assert.equal(draft.body.data.created_by, 'engineer@ricoz.test');
  const reviewed = await engineerAgent.put('/api/v1/metrics/' + draft.body.data._id).send({
    state: 'IN_REVIEW',
    expected_version: 1,
    changes_summary: 'Submit for review',
  });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
  assert.equal(
    (
      await engineerAgent.put('/api/v1/metrics/' + draft.body.data._id).send({
        state: 'CERTIFIED',
        expected_version: reviewed.body.data.version,
        changes_summary: 'Engineer cannot certify',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await engineerAgent.delete('/api/v1/metrics/' + draft.body.data._id).send({
        expected_version: reviewed.body.data.version,
      })
    ).status,
    403,
  );
});
test('an audit write failure rolls back the metric and its version', async () => {
  const original = AuditLog.create;
  AuditLog.create = async () => {
    throw new Error('Injected audit failure');
  };
  try {
    const r = await stewardAgent.post('/api/v1/metrics').send(body('rollback'));
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
      await stewardAgent
        .post('/api/v1/metrics')
        .send(body('mismatch', 'SELECT ${graph_a}', []))
    ).status,
    400,
  );
  const impact = await stewardAgent.get('/api/v1/analysis/metrics/' + a._id + '/impact');
  assert.equal(impact.body.data.impactAnalysis.totalAffected, 2);
  assert.equal(impact.body.data.downstream.find((m) => m.name === 'graph_c').depth, 2);
  const denied = await stewardAgent
    .delete('/api/v1/metrics/' + a._id)
    .send({ deleted_by: 'owner@example.com', expected_version: 1 });
  assert.equal(denied.status, 409);
  assert.ok(denied.body.error.details.dependents.length);
  const tree = await stewardAgent.get('/api/v1/analysis/metrics/' + c._id + '/dependencies');
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
      await stewardAgent
        .delete('/api/v1/metrics/' + m._id)
        .send({ deleted_by: 'owner@example.com', expected_version: m.version })
    ).status,
    409,
  );
  m = (await update(m, { state: 'DEPRECATED' })).body.data;
  r = await stewardAgent
    .delete('/api/v1/metrics/' + m._id)
    .send({ deleted_by: 'owner@example.com', expected_version: m.version });
  assert.equal(r.status, 200);
  assert.ok((await stewardAgent.get('/api/v1/metrics/' + m._id + '/audit')).body.total >= 4);
  assert.equal((await stewardAgent.get('/api/v1/metrics/' + m._id)).status, 404);
});
test('breaking history survives later metadata edits; aggregates cover all records', async () => {
  let m = await create(body('breaking'));
  m = (
    await update(m, {
      calculation_logic: { sql_template: 'SELECT AVG(amount) AS total FROM orders' },
    })
  ).body.data;
  await update(m, { description: 'Metadata after breaking change' });
  const changes = await stewardAgent.get('/api/v1/analysis/breaking-changes');
  assert.ok(changes.body.data.some((c) => c.metric.name === 'breaking' && c.latestVersion === 2));
  const summary = await stewardAgent.get('/api/v1/metrics/summary');
  assert.equal(summary.body.data.total, await Metric.countDocuments());
  const search = await stewardAgent.get('/api/v1/metrics?search=graph_&limit=1');
  assert.equal(search.body.total, 3);
  assert.equal(search.body.data.length, 1);
  assert.equal((await stewardAgent.get('/api/health')).body.status, 'OK');
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
