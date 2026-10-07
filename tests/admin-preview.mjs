// Explicitly isolated UI contract fixture. No calls to the real backend.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const circle = { id: 'fixture-circle', name: '初始积分演示圈', currency: '叶子' };
const members = [
  { account_id: 'fixture-a', display_name: '小夏', username: 'summer', balance: 10, opening_balance: null, opening_balance_initialized: false },
  { account_id: 'fixture-b', display_name: '小林', username: 'forest', balance: -10, opening_balance: null, opening_balance_initialized: false },
  { account_id: 'fixture-c', display_name: '小雨', username: 'rain', balance: 0, opening_balance: null, opening_balance_initialized: false },
];
const previews = new Map(); const batches = new Map();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4399');
  const reply = (data, status = 200) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); };
  let body = ''; for await (const chunk of req) body += chunk;
  let input; try { input = JSON.parse(body || '{}'); } catch { return reply({ error: 'Invalid JSON' }, 400); }
  if (url.pathname === '/api/admin/session' && req.method === 'POST') {
    if (input.password !== 'fixture-only') return reply({ error: 'Wrong fixture password' }, 401);
    return reply({ access_token: 'admin-ui-fixture-only', expires_in: 900, admin: { name: '演示管理员（虚构数据）' } });
  }
  if (req.headers.authorization !== 'Bearer admin-ui-fixture-only') return reply({ error: 'Unauthorized fixture session' }, 401);
  if (url.pathname === '/api/admin/session') return reply(req.method === 'DELETE' ? { ok: true } : { authenticated: true, admin: { name: '演示管理员（虚构数据）' } });
  if (url.pathname === '/api/admin/circles') return reply({ circles: url.searchParams.get('q') && !circle.name.includes(url.searchParams.get('q')) ? [] : [circle], next_cursor: null });
  const base = `/api/admin/circles/${circle.id}`;
  if (url.pathname === `${base}/members`) return reply({ members, next_cursor: null });
  if (url.pathname === `${base}/opening-balance-imports/preview` && req.method === 'POST') {
    if (!Array.isArray(input.entries) || !input.entries.length || new Set(input.entries.map(e => e.account_id)).size !== input.entries.length) return reply({ error: 'Invalid entries' }, 422);
    for (const entry of input.entries) {
      const member = members.find(m => m.account_id === entry.account_id);
      if (!member || member.opening_balance_initialized || !Number.isSafeInteger(entry.opening_balance)) return reply({ error: 'Member cannot be initialized' }, 422);
    }
    const preview = { preview_id: randomUUID(), expires_at: new Date(Date.now() + 600000).toISOString(), total: input.entries.reduce((sum, e) => sum + e.opening_balance, 0), entries: input.entries.map(e => { const member = members.find(m => m.account_id === e.account_id); return { ...e, display_name: member.display_name, current_balance: member.balance, resulting_balance: member.balance + e.opening_balance }; }) };
    previews.set(preview.preview_id, { preview, input }); return reply(preview);
  }
  const match = url.pathname.match(/\/opening-balance-imports\/([^/]+)\/confirm$/);
  if (match && req.method === 'POST') {
    const saved = previews.get(match[1]);
    if (!saved || saved.input.idempotency_key !== input.idempotency_key) return reply({ error: 'Unknown preview' }, 422);
    const previous = [...batches.values()].find(b => b.preview_id === match[1]);
    if (previous) return reply({ batch: previous });
    if (Date.parse(saved.preview.expires_at) < Date.now() || saved.preview.entries.some(e => { const member = members.find(m => m.account_id === e.account_id); return member.opening_balance_initialized || member.balance !== e.current_balance; })) return reply({ error: 'Stale preview' }, 409);
    for (const entry of saved.preview.entries) Object.assign(members.find(m => m.account_id === entry.account_id), { balance: entry.resulting_balance, opening_balance: entry.opening_balance, opening_balance_initialized: true });
    const batch = { batch_id: randomUUID(), preview_id: match[1], idempotency_key: input.idempotency_key, status: 'completed', source: saved.input.source, created_at: new Date().toISOString(), total: saved.preview.total, entries: saved.preview.entries };
    batches.set(batch.batch_id, batch);
    // Optional fault injection: commit in memory, then lose the HTTP response.
    // Query/retry must recover the same batch rather than initialize twice.
    if (process.env.ADMIN_PREVIEW_DROP_CONFIRM === 'true') { req.socket.destroy(); return; }
    return reply({ batch });
  }
  if (url.pathname === `${base}/opening-balance-imports`) return reply({ batches: [...batches.values()].filter(b => !url.searchParams.get('preview_id') || b.preview_id === url.searchParams.get('preview_id')), next_cursor: null });
  return reply({ error: 'Fixture endpoint not found' }, 404);
});
server.listen(4399, '127.0.0.1', () => console.log('Admin UI fixture: 127.0.0.1:4399; password fixture-only; all balances are in memory.'));
