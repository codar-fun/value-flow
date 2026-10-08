import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const loadCode = code => import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(code)).toString('base64'));
const { relay } = await loadCode(await readFile(new URL('../app/lib/relay.ts', import.meta.url), 'utf8'));
const { requestOrigin } = await loadCode(await readFile(new URL('../app/lib/origin.ts', import.meta.url), 'utf8'));
let calls = [], token = 'fixture-token', upstream = () => Response.json({ id: 'one' });
globalThis.__integration = { relay, requestOrigin, withLoop: async (_request, fn) => fn(token, async (path, options = {}) => {
  calls.push({ path, method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
  return upstream();
}) };
async function route(path) {
  const source = (await readFile(new URL('../app/' + path, import.meta.url), 'utf8')).replace(/^import .* from "@\/app\/lib\/(loop|relay|origin)";$/gm, (_, name) => `const { ${name === 'loop' ? 'withLoop' : name === 'origin' ? 'requestOrigin' : 'relay'} } = globalThis.__integration;`);
  return loadCode(source);
}
const composer = await route('api/records/route.ts');
const revisions = await route('api/records/[id]/revisions/route.ts');
const resolve = await route('api/records/[id]/revisions/[revisionId]/route.ts');
const invitePreview = await route('api/invitations/[token]/preview/route.ts');
const shares = await route('api/shares/route.ts');
const request = body => new Request('http://localhost:3000/api/test', { method: 'POST', body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: 'r/one', revisionId: 'v/one', token: 'invite/one' }) };

test('current composer and delivered body fields both preserve multiline text and emoji', async () => {
  const text = '帮忙修好了灯 💡\n第二行完整保留。';
  for (const field of ['description', 'story']) {
    await composer.POST(request({ intent: 'record', circleId: 'c', providerId: 'a', receiverId: 'b', amount: 4, [field]: text, idempotencyKey: 'draft-key' }));
    assert.equal(calls.at(-1).body.story, text);
    assert.equal(calls.at(-1).body.idempotency_key, 'draft-key');
  }
  for (const field of ['description', 'detail']) {
    await composer.POST(request({ intent: 'offer', circleIds: ['c'], [field]: text }));
    assert.equal(calls.at(-1).body.detail, text);
    assert.equal('time' in calls.at(-1).body, false);
    assert.equal('location' in calls.at(-1).body, false);
  }
});
test('revoke and text-only edit use revision proposals with the base version', async () => {
  await revisions.POST(request({ kind: 'edit', baseVersion: 2, story: '仅修改正文\n🌱', visibility: 'mystery' }), params);
  assert.deepEqual(calls.at(-1), { path: '/records/r%2Fone/revisions', method: 'POST', body: { kind: 'edit', base_version: 2, story: '仅修改正文\n🌱', visibility: 'mystery' } });
  await revisions.POST(request({ kind: 'revoke', baseVersion: 3 }), params);
  assert.deepEqual(calls.at(-1).body, { kind: 'revoke', base_version: 3 });
  assert.equal(calls.at(-1).path, '/records/r%2Fone/revisions');
});
test('revision resolution retains permission and version-conflict errors', async () => {
  for (const status of [403, 409]) {
    upstream = () => Response.json({ error: { code: 'version_conflict', message: '记录已变更' } }, { status });
    const response = await resolve.POST(request({ action: 'accept' }), params);
    assert.equal(response.status, status);
    assert.equal(calls.at(-1).path, '/records/r%2Fone/revisions/v%2Fone/resolve');
    assert.equal((await response.json()).error, '记录已变更');
  }
  upstream = () => Response.json({ id: 'one' });
});
test('anonymous invitation preview never accepts and normalizes invalid-link copy with no-store', async () => {
  token = null;
  upstream = () => Response.json({ error: { code: 'invalid_invite', message: '邀请已失效或已被使用' } }, { status: 410 });
  const response = await invitePreview.GET(new Request('http://localhost/api/test'), params);
  assert.equal(calls.at(-1).method, 'GET');
  assert.equal(calls.at(-1).path, '/invitations/invite%2Fone/preview');
  assert.equal(response.status, 410);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).error, '邀请不可用，请重新获取。');
  token = 'fixture-token';
});
test('public share maps targetId and uses the external HTTPS origin for copy and QR', async () => {
  upstream = () => Response.json({ token: 'share-one', path: '/s/share-one' }, { status: 201 });
  const response = await shares.POST(new Request('http://internal:3000/api/shares', { method: 'POST', headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'flow.example' }, body: JSON.stringify({ kind: 'listing', targetId: 'listing-one' }) }));
  assert.equal(response.status, 201);
  assert.deepEqual(calls.at(-1).body, { kind: 'listing', target_id: 'listing-one' });
  assert.equal((await response.json()).url, 'https://flow.example/s/share-one');
});
