// Isolated UI review server. No credentials, backend access or production writes.
// Start `pnpm dev`, then `node tests/ui-preview.mjs`; open localhost:4174.
// ?ui=empty / ?ui=login / ?ui=error exercise onboarding and session states.
import http from 'node:http';

const member = (id, name, avatar, color) => ({ id, name, initial: name[0], avatar, color, handle: `@${id}`, bio: '一起把日常过得有意思。', wechat: 'ui-test-only', address: `fixture-${id}`, circleIds: ['garden', 'kitchen', 'workshop'] });
const members = [member('test-a', '小禾', 'leaf', 'green'), member('test-b', '阿陶', 'cap', 'coral'), member('test-c', '圆圆', 'custom2:cream:round:curl:cocoa:smile:round:smile:none', 'blue')];
const settings = { allowNegativeBalance: true, requireConfirmation: true, allowRejectCorrect: true, references: [{ name: '一小时协作', value: '约 5 叶子', note: '双方商量就好' }, { name: '一顿家常饭', value: '约 3 叶子', note: '' }], rules: ['可以问，也可以拒绝。', '额度只记录互助，不兑换现金。'] };
const circles = ['街角小花园', '一起吃饭', '周末修理铺'].map((name, i) => ({ id: ['garden', 'kitchen', 'workshop'][i], name, short: ['n3', 'c1', 't1'][i], color: ['green', 'pink', 'blue'][i], currency: '叶子', members: 3, tagline: '从一件小事开始，认识身边的人。', joining: 'approval', settings, ownerId: 'test-a', isMember: true, memberIds: members.map(m => m.id) }));
const listings = ['offer', 'need'].map((type, i) => ({ id: `listing-${i}`, memberId: members[i].id, type, title: i ? '想找一位伙伴，帮忙看看活动文案' : '周末一起修好那盏舍不得扔的台灯', detail: i ? '周四晚在线上聊半小时，也欢迎一起交流想法。' : '这周末有空，可以帮忙修小家电。带上你的好奇心，我们一起拆开看看。', circleIds: ['garden'], visibility: 'cross-circle', location: '街角公共客厅', time: '本周六下午', reference: '双方协商', tags: ['一起动手', '邻里互助'], status: 'active', createdAt: '2026-10-02' }));
const transactions = ['pending', 'confirmed', 'corrected', 'rejected'].map((status, i) => ({ id: `record-${i}`, circleId: 'garden', providerId: 'test-b', receiverId: 'test-a', createdById: 'test-b', amount: 5, title: '一起整理公共花园', story: '种下几株薄荷，也聊了聊最近的生活。', happenedAt: '2026-10-02', recordedAt: '2026-10-02', visibility: 'public', status, tags: ['花园'], pendingCorrection: i === 2 ? { amount: 6, title: '整理花园', story: '补充时间', proposedById: 'test-b' } : null, redacted: false }));
const db = { members, circles, accounts: circles.map((c, i) => ({ memberId: 'test-a', circleId: c.id, balance: [12, -3, 8][i], given: 20, received: 8 })), listings, transactions, goodCards: [{ id: 'card-1', fromMemberId: 'test-b', toMemberId: 'test-a', story: '谢谢你在下雨前帮忙收好了大家晾着的衣服。小事，也值得被记得。', date: '2026-10-02', visibility: 'cross-circle', circleId: 'garden' }], activity: [{ id: 1, source: 'listing', sourceId: 'listing-0' }, { id: 2, source: 'listing', sourceId: 'listing-1' }, { id: 3, source: 'transaction', sourceId: 'record-0' }, { id: 4, source: 'card', sourceId: 'card-1' }], joinRequests: [{ circleId: 'garden', member: member('test-d', '新朋友', 'bob', 'pink'), note: '想一起种花', requestedAt: '2026-10-02' }], pendingCircles: [], notifications: [{ id: 'notice-1', kind: 'record_confirmation_requested', actorId: 'test-b', amount: 5, note: '', circleId: 'garden', recordId: 'record-0', text: '有一笔互助等待确认', read: false, createdAt: '2026-10-02' }], unreadNotifications: 1, settings: { publicCards: true, publicListings: true, keepHiddenPrivate: true }, session: { authenticated: true }, currentMemberId: 'test-a' };
const emptyDb = { ...db, circles: [], accounts: [], listings: [], transactions: [], goodCards: [], activity: [], notifications: [], joinRequests: [], unreadNotifications: 0 };
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const mode = new URL(req.headers.referer || 'http://localhost').searchParams.get('ui');
    let status = 200;
    let result = {};
    if (req.url === '/api/bootstrap') {
      result = mode === 'empty' ? emptyDb : mode === 'login' ? { ...emptyDb, session: { authenticated: false } } : db;
      if (mode === 'error') { status = 502; result = { error: 'UI 测试：服务暂不可用' }; }
    } else if (req.url === '/api/circles' && req.method === 'GET') result = { circles: [{ ...circles[0], id: 'new-circle', name: '城市散步小队', pending: false }] };
    else if (req.url === '/api/profile' && req.method === 'PUT') {
      let body = ''; for await (const chunk of req) body += chunk;
      Object.assign(members[0], JSON.parse(body));
    } else if (req.url === '/api/auth/test-users') result = { enabled: false, users: [] };
    else if (req.method !== 'GET') { status = 409; result = { error: 'UI 测试环境：此操作未写入后端。' }; }
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(result)); return;
  }
  const upstream = http.request({ hostname: '::1', port: 3000, path: req.url, method: req.method, headers: { ...req.headers, host: 'localhost:3000' } }, incoming => {
    res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502); res.end('Start pnpm dev on port 3000 first.'); });
  req.pipe(upstream);
});
server.listen(4174, '::1', () => console.log('Isolated UI fixtures: http://localhost:4174 (no backend writes)'));


