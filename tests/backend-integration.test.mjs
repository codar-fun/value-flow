import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const loadCode = code => import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(code)).toString('base64'));
const { relay } = await loadCode(await readFile(new URL('../app/lib/relay.ts', import.meta.url), 'utf8'));
const { requestOrigin } = await loadCode(await readFile(new URL('../app/lib/origin.ts', import.meta.url), 'utf8'));
let calls = [], token = 'fixture-token', upstream = () => Response.json({ id: 'one' });
globalThis.__integration = { relay, requestOrigin, withLoop: async (_request, fn) => fn(token, async (path, options = {}) => {
  calls.push({ path, method: options.method || 'GET', body: options.body instanceof FormData ? options.body : options.body && JSON.parse(options.body) });
  return upstream();
}) };
async function route(path) {
  const source = (await readFile(new URL('../app/' + path, import.meta.url), 'utf8')).replace(/^import .* from "@\/app\/lib\/(loop|relay|origin)";$/gm, (_, name) => `const { ${name === 'loop' ? 'withLoop' : name === 'origin' ? 'requestOrigin' : 'relay'} } = globalThis.__integration;`).replace('"@/app/lib/content-search"', JSON.stringify(new URL('../app/lib/content-search.ts', import.meta.url).href));
  return loadCode(source);
}
const composer = await route('api/records/route.ts');
const revisions = await route('api/records/[id]/revisions/route.ts');
const resolve = await route('api/records/[id]/revisions/[revisionId]/route.ts');
const invitePreview = await route('api/invitations/[token]/preview/route.ts');
const shares = await route('api/shares/route.ts');
const upload = await route('api/listing-images/route.ts');
const imageRead = await route('api/listing-images/[id]/route.ts');
const join = await route('api/circles/[id]/join/route.ts');
const request = body => new Request('http://localhost:3000/api/test', { method: 'POST', body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: 'r/one', revisionId: 'v/one', token: 'invite/one' }) };

test('three images and chosen tags reach the listing write, while invalid attachments are rejected', async () => {
  upstream = () => Response.json({ id: 'one' });
  await composer.POST(request({ intent: 'need', description: '想去苏州找住宿', circleIds: ['c'], tags: ['住宿', '地点:苏州'], imageIds: ['image-1', 'image-2', 'image-3'] }));
  assert.deepEqual(calls.at(-1).body.tags, ['住宿', '地点:苏州']);
  assert.deepEqual(calls.at(-1).body.image_ids, ['image-1', 'image-2', 'image-3']);
  const before = calls.length;
  assert.equal((await composer.POST(request({ intent: 'offer', circleIds: ['c'], description: '内容', imageIds: ['a', 'b', 'c', 'd'] }))).status, 400);
  assert.equal((await composer.POST(request({ intent: 'offer', circleIds: ['c'], description: '内容', tags: [1] }))).status, 400);
  assert.equal(calls.length, before);
});
test('private image upload retains multipart bytes and reports an unavailable backend clearly', async () => {
  const form = () => { const data = new FormData(); data.append('file', new File(['fixture-image-bytes'], 'one.png', { type: 'image/png' })); data.append('upload_key', 'same-key'); return data; };
  upstream = () => Response.json({}, { status: 404 });
  let response = await upload.POST(new Request('http://localhost/api/listing-images', { method: 'POST', body: form() }));
  assert.equal(response.status, 404); assert.match((await response.json()).error, /尚未接通/);
  upstream = () => Response.json({ id: 'image-one' });
  response = await upload.POST(new Request('http://localhost/api/listing-images', { method: 'POST', body: form() }));
  assert.equal(response.status, 201); assert.equal(await calls.at(-1).body.get('file').text(), 'fixture-image-bytes');
  token = null; const before = calls.length;
  assert.equal((await imageRead.GET(new Request('http://localhost/api/listing-images/image-one'), params)).status, 401); assert.equal(calls.length, before); token = 'fixture-token';
  upstream = () => new Response('image-bytes', { headers: { 'content-type': 'image/png' } });
  response = await imageRead.GET(new Request('http://localhost/api/listing-images/image-one'), params);
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(await response.text(), 'image-bytes');
  upstream = () => Response.json({ id: 'one' });
});
test('shared entry requires explicit backend support and submits an approval request, never a direct join', async () => {
  upstream = () => Response.json({ can_apply: true });
  const body = { sharedPost: 'listing:one' };
  const before = calls.length;
  assert.equal((await join.POST(request(body), params)).status, 501); assert.equal(calls.length, before + 1); assert.equal(calls.at(-1).method, 'GET');
  upstream = () => calls.at(-1).method === 'GET' ? Response.json({ shared_entry_supported: true, can_apply: true }) : Response.json({ status: 'pending' });
  assert.equal((await join.POST(request(body), params)).status, 200);
  assert.equal(calls.at(-1).body.join_mode, 'approval'); assert.equal(calls.at(-1).body.shared_post, 'listing:one');
  upstream = () => calls.at(-1).method === 'GET' ? Response.json({ shared_entry_supported: true, can_apply: true }) : Response.json({ status: 'active' });
  assert.equal((await join.POST(request(body), params)).status, 502);
  upstream = () => Response.json({ id: 'one' });
});

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
