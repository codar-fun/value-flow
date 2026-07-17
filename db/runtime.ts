import { demoDb, type Circle, type GoodCard, type Listing, type Member, type Transaction } from "../app/demo-data";

export type RuntimeEnv = {
  DB: D1Database;
  BUBBLE_ASSISTANT_API_URL?: string;
  BUBBLE_ASSISTANT_API_KEY?: string;
  BUBBLE_ASSISTANT_MODEL?: string;
  BUBBLE_ASSISTANT_SYSTEM_PROMPT?: string;
};

export type AppDatabase = {
  members: Member[]; circles: Circle[]; accounts: Array<{ memberId: string; circleId: string; balance: number; given: number; received: number }>;
  listings: Listing[]; goodCards: GoodCard[]; transactions: Transaction[]; activity: Array<{ id: number; source: "listing" | "card" | "transaction"; sourceId: string }>;
  settings: { publicCards: boolean; publicListings: boolean; keepHiddenPrivate: boolean };
  currentMemberId: string;
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT NOT NULL, initial TEXT NOT NULL, role TEXT NOT NULL, color TEXT NOT NULL, avatar TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', wechat TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS circles (id TEXT PRIMARY KEY, name TEXT NOT NULL, short TEXT NOT NULL, color TEXT NOT NULL, currency TEXT NOT NULL, role TEXT NOT NULL, location TEXT NOT NULL, tagline TEXT NOT NULL, intro TEXT NOT NULL, scene TEXT NOT NULL, joining TEXT NOT NULL, invitation TEXT NOT NULL, principles_json TEXT NOT NULL, rules_json TEXT NOT NULL, references_json TEXT NOT NULL, settings_json TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES members(id), created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS memberships (id TEXT PRIMARY KEY, circle_id TEXT NOT NULL REFERENCES circles(id), member_id TEXT NOT NULL REFERENCES members(id), role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'active', joined_at INTEGER NOT NULL, UNIQUE(circle_id, member_id))`,
  `CREATE INDEX IF NOT EXISTS memberships_member_idx ON memberships(member_id)`,
  `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, circle_id TEXT NOT NULL REFERENCES circles(id), member_id TEXT NOT NULL REFERENCES members(id), balance INTEGER NOT NULL DEFAULT 0, given INTEGER NOT NULL DEFAULT 0, received INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, UNIQUE(circle_id, member_id))`,
  `CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), type TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, circle_ids_json TEXT NOT NULL, visibility TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', time TEXT NOT NULL DEFAULT '', reference TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', nearby INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS good_cards (id TEXT PRIMARY KEY, from_member_id TEXT NOT NULL REFERENCES members(id), to_member_id TEXT NOT NULL REFERENCES members(id), story TEXT NOT NULL, tags_json TEXT NOT NULL, visibility TEXT NOT NULL, circle_id TEXT NOT NULL REFERENCES circles(id), created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, circle_id TEXT NOT NULL REFERENCES circles(id), provider_id TEXT NOT NULL REFERENCES members(id), receiver_id TEXT NOT NULL REFERENCES members(id), amount INTEGER NOT NULL, title TEXT NOT NULL, story TEXT NOT NULL, happened_at INTEGER NOT NULL, recorded_at INTEGER NOT NULL, visibility TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed', tags_json TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, source_id TEXT NOT NULL, circle_id TEXT NOT NULL REFERENCES circles(id), created_at INTEGER NOT NULL, UNIQUE(source, source_id))`,
  `CREATE INDEX IF NOT EXISTS activities_created_idx ON activities(created_at)`,
  `CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY, circle_id TEXT NOT NULL REFERENCES circles(id), created_by TEXT NOT NULL REFERENCES members(id), token_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active', expires_at INTEGER NOT NULL, max_uses INTEGER NOT NULL DEFAULT 1, used_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS user_settings (member_id TEXT PRIMARY KEY REFERENCES members(id), public_cards INTEGER NOT NULL DEFAULT 1, public_listings INTEGER NOT NULL DEFAULT 1, keep_hidden_private INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS assistant_messages (id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), role TEXT NOT NULL, content TEXT NOT NULL, intent TEXT, draft_json TEXT, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS assistant_member_created_idx ON assistant_messages(member_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS data_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`,
];

const demoRecordsMigrationId = "legacy-demo-records-v1";

export function runtimeEnv(): RuntimeEnv {
  const value=(globalThis as typeof globalThis & {__FLOW_CIRCLE_ENV?:RuntimeEnv}).__FLOW_CIRCLE_ENV;
  if(!value)throw new Error("运行环境尚未初始化。");
  return value;
}

export async function ensureDatabase(db = runtimeEnv().DB) {
  if (!db) throw new Error("数据库尚未绑定，请确认 Sites 的 D1 绑定名称为 DB。");
  await db.batch(schemaStatements.map((sql) => db.prepare(sql)));
  const count = await db.prepare("SELECT COUNT(*) AS count FROM circles").first<{ count: number }>();
  if ((count?.count ?? 0) > 0) {
    const now = Date.now();
    await db.prepare("INSERT OR IGNORE INTO memberships (id,circle_id,member_id,role,status,joined_at) SELECT circle_id || ':' || member_id,circle_id,member_id,CASE WHEN member_id='qiaoye' THEN 'owner' ELSE 'member' END,'active',? FROM accounts").bind(now).run();
    const migrated = await db.prepare("SELECT id FROM data_migrations WHERE id=?").bind(demoRecordsMigrationId).first<{ id: string }>();
    if (!migrated) {
      const statements: D1PreparedStatement[] = [];
      for (const item of demoDb.transactions) statements.push(db.prepare("INSERT OR IGNORE INTO transactions (id,circle_id,provider_id,receiver_id,amount,title,story,happened_at,recorded_at,visibility,status,tags_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(item.id,item.circleId,item.providerId,item.receiverId,item.amount,item.title,item.story,now,now,item.visibility,item.status,JSON.stringify(item.tags)));
      for (const item of demoDb.activity) {
        const circleId = item.source === "listing" ? demoDb.listings.find((x) => x.id === item.sourceId)?.circleIds[0] : item.source === "card" ? demoDb.goodCards.find((x) => x.id === item.sourceId)?.circleId : demoDb.transactions.find((x) => x.id === item.sourceId)?.circleId;
        statements.push(db.prepare("INSERT OR IGNORE INTO activities (source,source_id,circle_id,created_at) VALUES (?,?,?,?)").bind(item.source,item.sourceId,circleId ?? "qiao",now - item.id * 1000));
      }
      statements.push(db.prepare("INSERT INTO data_migrations (id,applied_at) VALUES (?,?)").bind(demoRecordsMigrationId,now));
      await db.batch(statements);
    }
    return;
  }

  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  for (const member of demoDb.members) statements.push(db.prepare("INSERT OR IGNORE INTO members (id,email,name,initial,role,color,avatar,bio,wechat,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(member.id, member.id === "qiaoye" ? "demo@flow-circle.local" : null, member.name, member.initial, member.role, member.color, member.avatar, member.bio, member.wechat, now));
  for (const circle of demoDb.circles) {
    statements.push(db.prepare("INSERT OR IGNORE INTO circles (id,name,short,color,currency,role,location,tagline,intro,scene,joining,invitation,principles_json,rules_json,references_json,settings_json,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(circle.id,circle.name,circle.short,circle.color,circle.currency,circle.role,circle.location,circle.tagline,circle.intro,circle.scene,circle.joining,circle.invitation,JSON.stringify(circle.principles),JSON.stringify(circle.rules),JSON.stringify(circle.references),"{}","qiaoye",now));
    for (const memberId of circle.memberIds) statements.push(db.prepare("INSERT OR IGNORE INTO memberships (id,circle_id,member_id,role,status,joined_at) VALUES (?,?,?,?,?,?)").bind(`${circle.id}:${memberId}`,circle.id,memberId,memberId === "qiaoye" ? "owner" : "member","active",now));
  }
  for (const account of demoDb.accounts) {
    statements.push(db.prepare("INSERT OR IGNORE INTO memberships (id,circle_id,member_id,role,status,joined_at) VALUES (?,?,?,?,?,?)").bind(`${account.circleId}:${account.memberId}`,account.circleId,account.memberId,account.memberId === "qiaoye" ? "owner" : "member","active",now));
    statements.push(db.prepare("INSERT OR IGNORE INTO accounts (id,circle_id,member_id,balance,given,received,updated_at) VALUES (?,?,?,?,?,?,?)").bind(`${account.circleId}:${account.memberId}`,account.circleId,account.memberId,account.balance,account.given,account.received,now));
  }
  for (const item of demoDb.listings) statements.push(db.prepare("INSERT OR IGNORE INTO listings (id,member_id,type,title,detail,circle_ids_json,visibility,location,time,reference,tags_json,status,nearby,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(item.id,item.memberId,item.type,item.title,item.detail,JSON.stringify(item.circleIds),item.visibility,item.location,item.time,item.reference,JSON.stringify(item.tags),item.status,item.nearby ? 1 : 0,now - Number(item.id.length) * 1000));
  for (const item of demoDb.goodCards) statements.push(db.prepare("INSERT OR IGNORE INTO good_cards (id,from_member_id,to_member_id,story,tags_json,visibility,circle_id,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(item.id,item.fromMemberId,item.toMemberId,item.story,JSON.stringify(item.tags),item.visibility,item.circleId,now - Number(item.id.length) * 1000));
  for (const item of demoDb.transactions) statements.push(db.prepare("INSERT OR IGNORE INTO transactions (id,circle_id,provider_id,receiver_id,amount,title,story,happened_at,recorded_at,visibility,status,tags_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(item.id,item.circleId,item.providerId,item.receiverId,item.amount,item.title,item.story,now,now,item.visibility,item.status,JSON.stringify(item.tags)));
  for (const item of demoDb.activity) { const circleId = item.source === "listing" ? demoDb.listings.find((x) => x.id === item.sourceId)?.circleIds[0] : item.source === "card" ? demoDb.goodCards.find((x) => x.id === item.sourceId)?.circleId : demoDb.transactions.find((x) => x.id === item.sourceId)?.circleId; statements.push(db.prepare("INSERT OR IGNORE INTO activities (id,source,source_id,circle_id,created_at) VALUES (?,?,?,?,?)").bind(item.id,item.source,item.sourceId,circleId ?? "qiao",now - item.id * 1000)); }
  statements.push(db.prepare("INSERT OR IGNORE INTO user_settings (member_id,public_cards,public_listings,keep_hidden_private,updated_at) VALUES ('qiaoye',1,1,1,?)").bind(now));
  statements.push(db.prepare("INSERT OR IGNORE INTO data_migrations (id,applied_at) VALUES (?,?)").bind(demoRecordsMigrationId,now));
  for (let index = 0; index < statements.length; index += 75) await db.batch(statements.slice(index, index + 75));
}

function parse<T>(value: string): T { return JSON.parse(value) as T; }
function displayDate(value: number) { return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(value)).replace("/", " 月 ").replace(/$/, " 日"); }

export async function resolveCurrentMember(request: Request, db = runtimeEnv().DB) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) return "qiaoye";
  const existing = await db.prepare("SELECT id FROM members WHERE email = ?").bind(email).first<{ id: string }>();
  if (existing) return existing.id;
  const demoOwner = await db.prepare("SELECT email FROM members WHERE id='qiaoye'").first<{email:string|null}>();
  if (demoOwner?.email === "demo@flow-circle.local") {
    const encodedName=request.headers.get("oai-authenticated-user-full-name"); let name="俏也";
    if(encodedName&&request.headers.get("oai-authenticated-user-full-name-encoding")==="percent-encoded-utf-8"){try{name=decodeURIComponent(encodedName);}catch{}}
    await db.prepare("UPDATE members SET email=?,name=?,initial=? WHERE id='qiaoye'").bind(email,name,name.slice(0,1)).run(); return "qiaoye";
  }
  const id = `u-${crypto.randomUUID()}`; const encodedName = request.headers.get("oai-authenticated-user-full-name");
  let name = email.split("@")[0];
  if (encodedName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") { try { name = decodeURIComponent(encodedName); } catch {} }
  await db.prepare("INSERT INTO members (id,email,name,initial,role,color,avatar,bio,wechat,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id,email,name,name.slice(0,1),"新朋友","yellow","crop","刚刚来到流动圈。","",Date.now()).run();
  await db.prepare("INSERT INTO user_settings (member_id,public_cards,public_listings,keep_hidden_private,updated_at) VALUES (?,1,1,1,?)").bind(id,Date.now()).run();
  return id;
}

export async function loadBootstrap(request: Request): Promise<AppDatabase> {
  const db = runtimeEnv().DB; await ensureDatabase(db); const currentMemberId = await resolveCurrentMember(request, db);
  const [memberRows,circleRows,membershipRows,accountRows,listingRows,cardRows,transactionRows,activityRows,settings] = await Promise.all([
    db.prepare("SELECT * FROM members ORDER BY created_at").all<Record<string, unknown>>(), db.prepare("SELECT * FROM circles ORDER BY created_at").all<Record<string, unknown>>(),
    db.prepare("SELECT circle_id,member_id FROM memberships WHERE status='active'").all<{circle_id:string;member_id:string}>(), db.prepare("SELECT * FROM accounts").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM listings ORDER BY created_at DESC").all<Record<string, unknown>>(), db.prepare("SELECT * FROM good_cards ORDER BY created_at DESC").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM transactions ORDER BY recorded_at DESC").all<Record<string, unknown>>(), db.prepare("SELECT id,source,source_id FROM activities ORDER BY created_at DESC").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM user_settings WHERE member_id=?").bind(currentMemberId).first<Record<string, unknown>>(),
  ]);
  const circleIdsByMember = new Map<string,string[]>(); const memberIdsByCircle = new Map<string,string[]>();
  for (const row of membershipRows.results) { circleIdsByMember.set(row.member_id,[...(circleIdsByMember.get(row.member_id) ?? []),row.circle_id]); memberIdsByCircle.set(row.circle_id,[...(memberIdsByCircle.get(row.circle_id) ?? []),row.member_id]); }
  const currentCircleIds=circleIdsByMember.get(currentMemberId) ?? [];
  const members = memberRows.results.filter((r)=>String(r.id)===currentMemberId||(circleIdsByMember.get(String(r.id))??[]).some((circleId)=>currentCircleIds.includes(circleId))).map((r) => ({ id:String(r.id),name:String(r.name),initial:String(r.initial),role:String(r.role),color:r.color as Member["color"],avatar:r.avatar as Member["avatar"],bio:String(r.bio),wechat:String(r.wechat),circleIds:circleIdsByMember.get(String(r.id)) ?? [] }));
  const circles = circleRows.results.filter((r)=>currentCircleIds.includes(String(r.id))).map((r) => ({ id:String(r.id),name:String(r.name),short:String(r.short),color:r.color as Circle["color"],currency:String(r.currency),members:(memberIdsByCircle.get(String(r.id)) ?? []).length,role:String(r.role),location:String(r.location),tagline:String(r.tagline),intro:String(r.intro),scene:String(r.scene),joining:String(r.joining),invitation:String(r.invitation),principles:parse<string[]>(String(r.principles_json)),rules:parse<string[]>(String(r.rules_json)),references:parse<Circle["references"]>(String(r.references_json)),memberIds:memberIdsByCircle.get(String(r.id)) ?? [] }));
  const accounts = accountRows.results.filter((r)=>currentCircleIds.includes(String(r.circle_id))).map((r) => ({memberId:String(r.member_id),circleId:String(r.circle_id),balance:Number(r.balance),given:Number(r.given),received:Number(r.received)}));
  const listings = listingRows.results.map((r) => ({id:String(r.id),memberId:String(r.member_id),type:r.type as Listing["type"],title:String(r.title),detail:String(r.detail),circleIds:parse<string[]>(String(r.circle_ids_json)),visibility:r.visibility as Listing["visibility"],location:String(r.location),time:String(r.time),reference:String(r.reference),tags:parse<string[]>(String(r.tags_json)),status:r.status as Listing["status"],createdAt:displayDate(Number(r.created_at)),nearby:Boolean(r.nearby)})).filter((item)=>item.visibility==="cross-circle"||item.circleIds.some((circleId)=>currentCircleIds.includes(circleId)));
  const goodCards = cardRows.results.map((r) => ({id:String(r.id),fromMemberId:String(r.from_member_id),toMemberId:String(r.to_member_id),story:String(r.story),date:displayDate(Number(r.created_at)),tags:parse<string[]>(String(r.tags_json)),visibility:r.visibility as GoodCard["visibility"],circleId:String(r.circle_id)})).filter((item)=>item.visibility==="cross-circle"||currentCircleIds.includes(item.circleId));
  const transactions = transactionRows.results.map((r) => ({id:String(r.id),circleId:String(r.circle_id),providerId:String(r.provider_id),receiverId:String(r.receiver_id),amount:Number(r.amount),title:String(r.title),story:String(r.story),happenedAt:displayDate(Number(r.happened_at)),recordedAt:displayDate(Number(r.recorded_at)),visibility:r.visibility as Transaction["visibility"],status:r.status as Transaction["status"],tags:parse<string[]>(String(r.tags_json))})).filter((item)=>currentCircleIds.includes(item.circleId)&&(item.visibility!=="private"||item.providerId===currentMemberId||item.receiverId===currentMemberId));
  const visibleSources=new Set([...listings.map((item)=>`listing:${item.id}`),...goodCards.map((item)=>`card:${item.id}`),...transactions.filter((item)=>item.status!=="rejected").map((item)=>`transaction:${item.id}`)]);
  return { members,circles,accounts,listings,goodCards,transactions,activity:activityRows.results.filter((r)=>visibleSources.has(`${r.source}:${r.source_id}`)).map((r) => ({id:Number(r.id),source:r.source as "listing"|"card"|"transaction",sourceId:String(r.source_id)})),settings:{publicCards:Boolean(settings?.public_cards ?? 1),publicListings:Boolean(settings?.public_listings ?? 1),keepHiddenPrivate:Boolean(settings?.keep_hidden_private ?? 1)},currentMemberId };
}

export function json(data: unknown, init?: ResponseInit) { return Response.json(data, { ...init, headers: { "cache-control": "no-store", ...init?.headers } }); }
export async function bodyJson<T>(request: Request): Promise<T> { const type=request.headers.get("content-type") ?? ""; if(!type.includes("application/json")) throw new Error("请求必须使用 JSON。"); return request.json() as Promise<T>; }
export function id(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
