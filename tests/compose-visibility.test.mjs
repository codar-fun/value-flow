import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

// Exercise the real route, replacing only the authenticated backend transport.
const source = (await readFile(new URL('../app/api/records/route.ts', import.meta.url), 'utf8')).replace('import { withLoop } from "@/app/lib/loop";', `
export const calls = [];
const withLoop = async (request, callback) => callback('fixture-token', async (path, options) => {
  calls.push({ path, body: JSON.parse(options.body) });
  return Response.json({ id: 'fixture-record' });
});`);
const { POST, calls } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const send = body => POST(new Request('http://localhost/api/records', { method: 'POST', body: JSON.stringify(body) }));
const record = { intent: 'record', circleId: 'c', providerId: 'a', receiverId: 'b', amount: 5, story: 'Only the parties should see this in mystery mode.' };

test('new ledger records default to public and preserve the mystery choice and amount', async () => {
  for (const visibility of [undefined, 'public', 'mystery']) {
    const response = await send({ ...record, visibility });
    assert.equal(response.status, 201);
    assert.equal(calls.at(-1).body.visibility, visibility ?? 'public');
    assert.equal(calls.at(-1).body.amount, 5);
    assert.equal(calls.at(-1).body.story, record.story);
  }
});
test('one description becomes the complete body while legacy title stays short', async () => {
  const description = '我们一起整理了公共花园。\n' + '后来还修好了浇水管。'.repeat(50);
  assert.equal((await send({ intent: 'record', circleId: 'c', providerId: 'a', receiverId: 'b', amount: 5, description })).status, 201);
  assert.equal(calls.at(-1).body.story, description);
  assert.ok(calls.at(-1).body.title.length <= 60);
  assert.equal((await send({ intent: 'offer', circleIds: ['c'], description })).status, 201);
  assert.equal(calls.at(-1).body.detail, description);
  assert.ok(calls.at(-1).body.title.length <= 60);
});
test('good cards always publish cross-circle', async () => {
  for (const visibility of [undefined, 'cross-circle']) {
    assert.equal((await send({ intent: 'card', toId: 'b', story: 'Thanks', visibility })).status, 201);
    assert.equal(calls.at(-1).body.visibility, 'cross-circle');
  }
});
test('obsolete privacy choices never silently become public writes', async () => {
  const count = calls.length;
  assert.equal((await send({ ...record, visibility: 'private' })).status, 400);
  assert.equal((await send({ intent: 'card', toId: 'b', story: 'Private draft', visibility: 'hidden' })).status, 400);
  assert.equal(calls.length, count);
});
