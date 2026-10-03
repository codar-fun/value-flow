// Isolated UI review server. No credentials, backend access or production writes.
// Start `pnpm dev`, then `node tests/ui-preview.mjs`; open localhost:4174.
// ?ui=empty / ?ui=login / ?ui=error exercise onboarding and session states.
import http from 'node:http';

const member = (id, name, avatar, color) => ({ id, name, initial: name[0], avatar, color, handle: `@${id}`, bio: '一起把日常过得有意思。', wechat: 'ui-test-only', address: `fixture-${id}`, circleIds: ['garden', 'kitchen', 'workshop'] });
const members = [member('test-a', '小禾', 'buddy3:sprout:smile:green:cream', 'green'), member('test-b', '阿陶', 'buddy3:cap:smile:coral:-', 'coral'), member('test-c', '圆圆', 'buddy3:humanGirlShort:smile:cocoa:-', 'blue')];
members[1].circleIds = ['garden', 'kitchen'];
members[1].discoverableCircleIds = ['new-circle'];
members[2].circleIds = ['workshop'];
const settings = { allowNegativeBalance: true, requireConfirmation: true, allowRejectCorrect: true, references: [{ name: '一小时协作', value: '约 5 叶子', note: '双方商量就好' }, { name: '一顿家常饭', value: '约 3 叶子', note: '' }], rules: ['可以问，也可以拒绝。', '社区货币只记录互助，不兑换现金。'] };
const circles = ['街角小花园', '一起吃饭', '周末修理铺'].map((name, i) => ({ id: ['garden', 'kitchen', 'workshop'][i], name, short: ['n3', 'c1', 't1'][i], color: ['green', 'pink', 'blue'][i], currency: '叶子', members: 3, tagline: '从一件小事开始，认识身边的人。', joining: 'approval', settings, ownerId: 'test-a', isMember: true, memberIds: members.filter(m => m.circleIds.includes(['garden', 'kitchen', 'workshop'][i])).map(m => m.id) }));
const listings = ['offer', 'need'].map((type, i) => ({ id: `listing-${i}`, memberId: members[i].id, type, title: i ? '想找一位伙伴，帮忙看看活动文案' : '周末一起修好那盏舍不得扔的台灯', detail: i ? '周四晚在线上聊半小时，也欢迎一起交流想法。' : '这周末有空，可以帮忙修小家电。带上你的好奇心，我们一起拆开看看。', circleIds: ['garden'], visibility: 'cross-circle', location: '街角公共客厅', time: '本周六下午', reference: i ? '3 叶子' : '5 叶子', tags: [], status: 'active', createdAt: '2026-10-02' }));
listings.push({ id: 'listing-2', memberId: 'test-b', type: 'offer', title: '周末一起做饭', detail: '可以一起准备一顿简单的晚餐。', circleIds: ['kitchen'], visibility: 'circle', location: '社区厨房', time: '周末', reference: '', tags: [], status: 'active', createdAt: '2026-10-02' });
const transactions = [
  { id: 'record-0', status: 'pending', amount: 5, title: '帮忙修好浇水管', story: '阿陶帮小禾修好了公共花园的浇水管。', pendingCorrection: null },
  { id: 'record-1', status: 'confirmed', amount: 3, title: '帮忙把花盆搬到窗边', story: '阿陶帮小禾把花盆搬到窗边，还分享了几株香草。', pendingCorrection: null },
  { id: 'record-2', status: 'confirmed', amount: 5, title: '帮忙修好落地灯', story: '阿陶帮小禾修好了公共客厅的落地灯。', pendingCorrection: { amount: 6, title: '帮忙修好落地灯', story: '补上更换零件的时间。', proposedById: 'test-b' } },
  { id: 'record-3', status: 'rejected', amount: 2, title: '一起搬运社区书箱', story: '原记录信息有误，双方确认后撤销。', pendingCorrection: null },
].map((record) => ({ circleId: 'garden', providerId: 'test-b', receiverId: 'test-a', createdById: 'test-b', happenedAt: '2026-10-02', recordedAt: '2026-10-02', visibility: 'public', tags: [], redacted: false, ...record }));
transactions.push({ id: 'record-4', circleId: 'kitchen', providerId: 'test-b', receiverId: 'test-a', createdById: 'test-a', happenedAt: '2026-10-02', recordedAt: '2026-10-02', visibility: 'public', tags: [], redacted: false, status: 'confirmed', amount: 3, title: '一起准备晚餐', story: '阿陶教我做了一道家常菜。', pendingCorrection: null });
const notifications = [
  { id: 'notice-1', kind: 'record_confirmation_requested', actorId: 'test-b', amount: 5, note: '帮忙修好浇水管', circleId: 'garden', recordId: 'record-0', text: '有一笔互助等待确认', read: false, createdAt: '2026-10-02' },
  { id: 'notice-2', kind: 'correction_proposed', actorId: 'test-b', amount: 6, note: '', circleId: 'garden', recordId: 'record-2', text: '有一条更正提议等待处理', read: false, createdAt: '2026-10-02' },
  { id: 'notice-3', kind: 'record_rejected', actorId: 'test-b', amount: 2, note: '一起搬运社区书箱', circleId: 'garden', recordId: 'record-3', text: '这条记录已经撤销', read: true, createdAt: '2026-10-02' },
];
const db = { members, circles, accounts: [...circles.map((c, i) => ({ memberId: 'test-a', circleId: c.id, balance: [12, -3, 8][i], given: 20, received: 8 })), { memberId: 'test-b', circleId: 'garden', balance: 2, given: 12, received: 10 }, { memberId: 'test-b', circleId: 'kitchen', balance: 3, given: 6, received: 3 }], listings, transactions, goodCards: [{ id: 'card-1', fromMemberId: 'test-b', toMemberId: 'test-a', story: '谢谢你在下雨前帮忙收好了大家晾着的衣服。小事，也值得被记得。', date: '2026-10-02', visibility: 'cross-circle', circleId: 'garden' }], activity: [{ id: 1, source: 'listing', sourceId: 'listing-0' }, { id: 2, source: 'listing', sourceId: 'listing-1' }, { id: 3, source: 'transaction', sourceId: 'record-0' }, { id: 4, source: 'card', sourceId: 'card-1' }, { id: 5, source: 'listing', sourceId: 'listing-2' }, { id: 6, source: 'transaction', sourceId: 'record-4' }], joinRequests: [{ circleId: 'garden', member: member('test-d', '新朋友', 'buddy3:bob:smile:pink:-', 'pink'), note: '想一起种花', requestedAt: '2026-10-02' }], pendingCircles: [], notifications, unreadNotifications: notifications.filter((notification) => !notification.read).length, settings: { publicCards: true, publicListings: true, keepHiddenPrivate: true }, session: { authenticated: true }, currentMemberId: 'test-a' };
const discoverableCircle = { id: 'new-circle', name: '城市散步小队', short: 'n3', color: 'green', currency: '叶子', members: 8, tagline: '沿着街道慢慢走，认识生活在附近的人。', description: '我们每月约一次散步，也一起记录沿途发现的小店、植物和邻里故事。', rules: ['先了解活动安排，再决定是否加入。', '参加与分享都出于自愿。'], joining: 'approval', pending: false };
const emptyDb = { ...db, circles: [], accounts: [], listings: [], transactions: [], goodCards: [], activity: [], notifications: [], joinRequests: [], unreadNotifications: 0 };
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const mode = new URL(req.headers.referer || 'http://localhost').searchParams.get('ui');
    let status = 200;
    let result = {};
    if (req.url === '/api/bootstrap') {
      result = mode === 'empty' ? emptyDb : mode === 'login' ? { ...emptyDb, session: { authenticated: false } } : db;
      if (mode === 'error') { status = 502; result = { error: 'UI 测试：服务暂不可用' }; }
    } else if (req.url === '/api/circles' && req.method === 'GET') result = { circles: [discoverableCircle] };
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


