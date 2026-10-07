import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const contractSource = await readFile(new URL('../app/lib/admin-contract.ts', import.meta.url), 'utf8');
const contract = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(contractSource)).toString('base64'));
let enabled = 'true'; let environment = 'development'; let calls = []; let upstream;
globalThis.__adminTestEnv = key => key === 'FLOW_ADMIN_ENABLED' ? enabled : key === 'NODE_ENV' ? environment : undefined;
globalThis.__adminTestFetch = async (...args) => { calls.push(args); return upstream(...args); };
const proxySource = (await readFile(new URL('../app/lib/admin-proxy.ts', import.meta.url), 'utf8'))
  .replace('import { runtimeEnv, loopApiBase, readCookie, upstreamTimeoutMs } from "./loop";', `
const runtimeEnv = key => globalThis.__adminTestEnv(key);
const loopApiBase = () => 'https://backend.invalid/api';
const upstreamTimeoutMs = () => 1000;
const readCookie = (request, name) => request.headers.get('cookie')?.split('; ').find(p => p.startsWith(name + '='))?.slice(name.length + 1) || null;
const fetch = (...args) => globalThis.__adminTestFetch(...args);`);
const { proxyAdmin } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(proxySource)).toString('base64'));
const send = (path, method = 'GET', body, headers = {}) => proxyAdmin(new Request('http://localhost:3000/api/admin/' + path, { method, headers: { origin: 'http://localhost:3000', ...headers }, body: body ? JSON.stringify(body) : undefined }), path.split('/'));
const member = { account_id: 'a', display_name: 'A', opening_balance_initialized: false };

test('opening entries distinguish blank from zero and reject decimals and initialized accounts', () => {
  assert.deepEqual(contract.buildOpeningEntries([member, { ...member, account_id: 'b' }], { a: '0', b: '' }), [{ account_id: 'a', opening_balance: 0 }]);
  for (const amount of ['1.5', '1e3', '9007199254740992']) assert.throws(() => contract.buildOpeningEntries([member], { a: amount }));
  assert.throws(() => contract.buildOpeningEntries([{ ...member, opening_balance_initialized: true }], { a: '300' }));
});
test('preview preserves existing mutual aid and rejects mismatched accounts, totals and balances', () => {
  const entries = [{ account_id: 'a', opening_balance: 300 }];
  const preview = { preview_id: 'p', expires_at: '2030-01-01T00:00:00Z', total: 300, entries: [{ account_id: 'a', display_name: 'A', current_balance: 10, opening_balance: 300, resulting_balance: 310 }] };
  assert.equal(contract.validateOpeningPreview(preview, entries).entries[0].resulting_balance, 310);
  assert.throws(() => contract.validateOpeningPreview({ ...preview, total: 301 }, entries));
  assert.throws(() => contract.validateOpeningPreview({ ...preview, entries: [{ ...preview.entries[0], resulting_balance: 300 }] }, entries));
  assert.throws(() => contract.validateOpeningPreview({ ...preview, entries: [{ ...preview.entries[0], account_id: 'b' }] }, entries));
});
test('admin proxy is opt-in and never enabled in production', async () => {
  calls = []; enabled = undefined;
  assert.equal((await send('session')).status, 503);
  enabled = 'true'; environment = 'production';
  assert.equal((await send('session')).status, 503);
  assert.equal(calls.length, 0); environment = 'development';
});
test('completed batch must match the exact preview and draft before showing success', () => {
  const draft = { idempotency_key: 'k', entries: [{ account_id: 'a', opening_balance: 300 }] };
  const preview = { preview_id: 'p', total: 300, entries: [{ account_id: 'a', opening_balance: 300, resulting_balance: 310 }] };
  const batch = { batch_id: 'b', preview_id: 'p', idempotency_key: 'k', status: 'completed', total: 300, entries: preview.entries };
  assert.equal(contract.validateOpeningBatch(batch, preview, draft).batch_id, 'b');
  assert.throws(() => contract.validateOpeningBatch({ ...batch, idempotency_key: 'other' }, preview, draft));
  assert.throws(() => contract.validateOpeningBatch({ ...batch, entries: [{ ...preview.entries[0], resulting_balance: 300 }] }, preview, draft));
});
test('member OTP cookie cannot authorize administrator calls', async () => {
  calls = [];
  assert.equal((await send('circles', 'GET', undefined, { cookie: 'loop_at=member-token' })).status, 401);
  assert.equal(calls.length, 0);
});
test('foreign-origin writes and arbitrary proxy paths never reach backend', async () => {
  calls = [];
  assert.equal((await send('session', 'POST', { password: 'fixture-password' }, { origin: 'https://other.invalid' })).status, 403);
  assert.equal((await send('me')).status, 404);
  assert.equal(calls.length, 0);
});
test('password is checked upstream and administrator token only enters HttpOnly cookie', async () => {
  upstream = async () => Response.json({ access_token: 'fixture-admin-token', expires_in: 900, admin: { name: 'Admin', password: 'do-not-expose' } });
  const response = await send('session', 'POST', { password: 'fixture-password' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /flow_admin_at=fixture-admin-token; Path=\/api\/admin; HttpOnly; SameSite=Strict/);
  assert.deepEqual(await response.json(), { authenticated: true, admin: { name: 'Admin' } });
  assert.equal(JSON.parse(calls.at(-1)[1].body).password, 'fixture-password');
});
test('admin resources use separate bearer token and disable caching', async () => {
  upstream = async () => Response.json({ circles: [], next_cursor: null });
  const response = await send('circles', 'GET', undefined, { cookie: 'flow_admin_at=fixture-admin-token' });
  assert.equal(calls.at(-1)[0], 'https://backend.invalid/api/admin/circles');
  assert.equal(calls.at(-1)[1].headers.authorization, 'Bearer fixture-admin-token');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('backend row validation errors survive the admin proxy without losing the batch error code', async () => {
  upstream = async () => Response.json({ error: { code: 'invalid_entries', message: '整批未写入', rows: [{ index: 1, account_id: 'b', message: '成员已初始化' }] } }, { status: 422 });
  const response = await send('circles/c/opening-balance-imports/preview', 'POST', { entries: [] }, { cookie: 'flow_admin_at=fixture-admin-token' });
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: '整批未写入', code: 'invalid_entries', rows: [{ index: 1, account_id: 'b', message: '成员已初始化' }] });
});
test('unimplemented backend interfaces never look like successful admin responses', async () => {
  upstream = async () => new Response('not implemented', { status: 404 });
  const response = await send('session', 'POST', { password: 'fixture-password' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'admin_not_integrated');
});
test('lost confirm response is inconclusive and never automatically replayed', async () => {
  calls = []; upstream = async () => { throw new Error('network failure'); };
  const response = await send('circles/c/opening-balance-imports/p/confirm', 'POST', { idempotency_key: 'k' }, { cookie: 'flow_admin_at=fixture-admin-token' });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /勿另建批次/);
  assert.equal(calls.length, 1);
});
test('invalid session response does not mint a cookie; expired admin session clears only admin cookie', async () => {
  upstream = async () => Response.json({ ok: true });
  const invalid = await send('session', 'POST', { password: 'fixture-password' });
  assert.equal(invalid.status, 502); assert.equal(invalid.headers.get('set-cookie'), null);
  upstream = async () => Response.json({ error: 'expired' }, { status: 401 });
  const expired = await send('circles', 'GET', undefined, { cookie: 'flow_admin_at=fixture-admin-token; loop_at=member-token' });
  assert.match(expired.headers.get('set-cookie'), /flow_admin_at=.*Max-Age=0/);
  assert.doesNotMatch(expired.headers.get('set-cookie'), /loop_at/);
});
