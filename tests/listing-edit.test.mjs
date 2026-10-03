import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = (await readFile(new URL('../app/api/listings/[id]/route.ts', import.meta.url), 'utf8')).replace('import { withLoop } from "@/app/lib/loop";', `
export const calls = [];
const withLoop = async (request, callback) => callback('fixture-token', async (path, options) => {
  calls.push({ path, body: JSON.parse(options.body) });
  return Response.json({ ok: true });
});`);
const { PATCH, calls } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const send = body => PATCH(new Request('http://localhost/api/listings/one', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'one' }) });

test('owner listing edits preserve the full text and selected visibility', async () => {
  const detail = '可以一起修理小家电。\n欢迎带上想研究的物件。';
  assert.equal((await send({ detail, reference: '5 叶子', visibility: 'cross-circle', circleIds: ['garden'] })).status, 200);
  assert.equal(calls.at(-1).path, '/listings/one');
  assert.deepEqual(calls.at(-1).body, {
    title: '可以一起修理小家电。', detail, reference: '5 叶子', visibility: 'cross-circle', circle_ids: ['garden'],
  });
});

test('invalid listing edits never reach the backend', async () => {
  const before = calls.length;
  assert.equal((await send({ detail: ' ', visibility: 'circle', circleIds: ['garden'] })).status, 400);
  assert.equal((await send({ detail: '内容', visibility: 'private', circleIds: ['garden'] })).status, 400);
  assert.equal((await send({ detail: '内容', visibility: 'circle', circleIds: [] })).status, 400);
  assert.equal(calls.length, before);
});

test('status updates keep their existing contract', async () => {
  assert.equal((await send({ status: 'paused' })).status, 200);
  assert.deepEqual(calls.at(-1).body, { status: 'paused' });
});
