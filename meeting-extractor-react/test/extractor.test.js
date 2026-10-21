const test = require('node:test'), assert = require('node:assert');
const { ground, extract, ruleBased, validate, parseJson } = require('../extractor');
const server = require('../server');
const NOTES = `Weekly sync
- Priya will finalize the API spec by 2026-10-15
- Decided to go with Postgres for storage
- Ravi to fix login bug asap
- Someone should update the docs
Risk: vendor might slip delivery
Waiting on legal approval
Who owns the demo env?`;
test('rule-based finds owners, dates, never invents', () => {
  const r = ruleBased(NOTES);
  assert.equal(r.source, 'rule-based');
  assert.equal(r.actions.find((a) => a.owner === 'Priya').dueDate, '2026-10-15');
  const rv = r.actions.find((a) => a.owner === 'Ravi');
  assert.equal(rv.dueDate, null); assert.equal(rv.priority, 'high');
  assert.equal(r.decisions.length, 1); assert.equal(r.risks.length, 1);
  assert.equal(r.dependencies.length, 1); assert.equal(r.questions.length, 1);
});
test('validate drops bad dates/priorities/blank owners', () => {
  const r = validate({ actions: [{ task: 'x', dueDate: 'next friday', priority: 'urgent', owner: ' ' }] }, 'ai');
  assert.equal(r.actions[0].dueDate, null); assert.equal(r.actions[0].priority, null); assert.equal(r.actions[0].owner, null);
});
test('parseJson handles fenced output', () => assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 }));
test('AI path used with mocked provider', async () => {
  const f = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"s","actions":[{"task":"t","owner":null}]}' } }] }) });
  const r = await extract(NOTES, { AI_BASE_URL: 'http://x', AI_API_KEY: 'k', AI_MODEL: 'm' }, f);
  assert.equal(r.source, 'ai'); assert.equal(r.warning, null);
});
test('falls back with warning when AI fails or is unconfigured', async () => {
  const r = await extract(NOTES, {});
  assert.equal(r.source, 'rule-based'); assert.match(r.warning, /NOT AI/);
  const r2 = await extract(NOTES, { AI_BASE_URL: 'http://x', AI_API_KEY: 'k', AI_MODEL: 'm' }, async () => ({ ok: false, status: 500 }));
  assert.equal(r2.source, 'rule-based');
});
test('API validates input and extracts', async () => {
  await new Promise((r) => server.listen(0, r));
  const u = `http://localhost:${server.address().port}/api/extract`;
  assert.equal((await fetch(u, { method: 'POST', body: JSON.stringify({ notes: 'hi' }) })).status, 400);
  const ok = await fetch(u, { method: 'POST', body: JSON.stringify({ notes: NOTES }) });
  assert.equal(ok.status, 200); assert.ok((await ok.json()).actions.length >= 2);
  server.close();
});
test('ground drops owners/dates not present in notes', () => {
  const r = ground({ actions: [{ task: 't', owner: 'Zed', dueDate: '2030-01-01' }, { task: 'u', owner: 'Priya', dueDate: '2026-10-15' }] }, NOTES);
  assert.equal(r.actions[0].owner, null); assert.equal(r.actions[0].dueDate, null);
  assert.equal(r.actions[1].owner, 'Priya'); assert.equal(r.actions[1].dueDate, '2026-10-15');
});
test('server survives malformed URL', async () => {
  await new Promise((r) => server.listen(0, r));
  const res = await fetch(`http://localhost:${server.address().port}/%E0%A4%A`);
  assert.equal(res.status, 400); server.close();
});
