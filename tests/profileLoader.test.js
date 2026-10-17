const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const loader = require('../engine/profileLoader');
const app = require('../server');

const starter = () => JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'config', 'profiles', 'ganesh-visarjan.json'), 'utf8'));

beforeEach(() => loader._reset());

test('starter Ganesh profile is valid', () => {
  assert.deepStrictEqual(loader.validateProfile(starter()), []);
});

test('invalid profile is rejected with useful errors', () => {
  const bad = starter();
  bad.thresholds = { amber: 0.9, red: 0.7 };
  bad.sites[0].capacity = -5;
  const errors = loader.validateProfile(bad);
  assert.ok(errors.some((e) => e.includes('thresholds')));
  assert.ok(errors.some((e) => e.includes('capacity')));
});

test('visitOrder must reference known sites', () => {
  const bad = starter();
  bad.rules.visitOrder = ['lalbaug', 'nowhere'];
  assert.ok(loader.validateProfile(bad).some((e) => e.includes('nowhere')));
});

test('a profile can be added at runtime and activated (no restart)', () => {
  loader.addProfile(starter());
  const second = starter();
  second.id = 'test-festival';
  loader.addProfile(second, { activate: true });
  assert.strictEqual(loader.getActiveProfile().id, 'test-festival');
  assert.strictEqual(loader.listProfiles().length, 2);
});

test('addProfile throws ProfileError for bad input', () => {
  assert.throws(() => loader.addProfile({ id: 'x' }), loader.ProfileError);
});

test('API: health and profile upload work', async () => {
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.strictEqual(health.status, 'ok');

    const p = starter();
    p.id = 'uploaded-fest';
    const res = await fetch(`${base}/api/profiles?activate=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    assert.strictEqual(res.status, 201);

    const bad = await fetch(`${base}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'broken' }),
    });
    assert.strictEqual(bad.status, 400);
  } finally {
    server.close();
  }
});
