// Adapter layer: shapes loop-backend responses into the `AppDatabase` the CC
// frontend already expects. (Replaces the former Cloudflare D1 data layer.)
import type {
  AvatarVariant,
  Circle,
  Color,
  GoodCard,
  Listing,
  Member,
  Transaction,
} from "../app/demo-data";

export type AppDatabase = {
  members: Member[];
  circles: Circle[];
  accounts: Array<{ memberId: string; circleId: string; balance: number; given: number; received: number }>;
  listings: Listing[];
  goodCards: GoodCard[];
  transactions: Transaction[];
  activity: Array<{ id: number; source: "listing" | "card" | "transaction"; sourceId: string }>;
  settings: { publicCards: boolean; publicListings: boolean; keepHiddenPrivate: boolean };
  session: { authenticated: boolean };
  currentMemberId: string;
};

// ─── request helpers (kept from the old runtime) ────────────────────────────

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "cache-control": "no-store", ...init?.headers } });
}

export async function bodyJson<T>(request: Request): Promise<T> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("请求必须使用 JSON。");
  return request.json() as Promise<T>;
}

export function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

// ─── loop-backend payload shapes ────────────────────────────────────────────

type LoopAccount = {
  id: string;
  username: string | null;
  handle: string | null;
  display_name: string | null;
  avatar: string | null;
  bio: string | null;
  address: string | null;
};

type LoopCircle = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  currency: string | null;
  joining: string | null;
  settings: Record<string, boolean>;
  member_count: number;
  member_ids: string[];
};

export type LoopBootstrap = {
  current_member_id: string;
  user: LoopAccount;
  settings: { public_cards: boolean; public_listings: boolean; keep_hidden_private: boolean };
  members: LoopAccount[];
  circles: LoopCircle[];
  circle_accounts: { circle_id: string; account_id: string; balance: number; given: number; received: number }[];
  records: {
    id: string;
    circle_id: string;
    provider_id: string;
    receiver_id: string;
    amount: number;
    title: string | null;
    story: string | null;
    visibility: string;
    status: string;
    tags: string[];
    happened_at: string | null;
    recorded_at: string;
  }[];
  listings: {
    id: string;
    member_id: string;
    type: "need" | "offer";
    title: string;
    detail: string;
    circle_ids: string[];
    visibility: string;
    location: string;
    time: string;
    reference: string;
    tags: string[];
    status: "active" | "paused" | "closed";
    created_at: string;
  }[];
  good_cards: {
    id: string;
    from_id: string;
    to_id: string;
    story: string | null;
    circle_id: string | null;
    visibility: string;
    created_at: string;
  }[];
};

// ─── deterministic display fillers (loop has no color/avatar enums) ─────────

const COLORS: Color[] = ["yellow", "pink", "blue", "green", "coral"];
const AVATARS: AvatarVariant[] = ["crop", "wave", "cap", "bob", "spike", "curl", "bun", "leaf"];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const colorFor = (seed: string): Color => COLORS[hash(seed) % COLORS.length];
const avatarFor = (seed: string): AvatarVariant => AVATARS[hash(seed) % AVATARS.length];
const firstChar = (s: string | null | undefined) => (s && s.length ? Array.from(s)[0] : "•");

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

// ─── loop → AppDatabase ─────────────────────────────────────────────────────

export function toAppDatabase(loop: LoopBootstrap): AppDatabase {
  // circleIds per member, derived from each circle's member_ids
  const circleIdsByMember = new Map<string, string[]>();
  for (const c of loop.circles) {
    for (const mid of c.member_ids) {
      circleIdsByMember.set(mid, [...(circleIdsByMember.get(mid) ?? []), c.id]);
    }
  }

  const toMember = (a: LoopAccount): Member => ({
    id: a.id,
    name: a.display_name || a.username || "成员",
    initial: firstChar(a.display_name || a.username),
    role: "",
    color: colorFor(a.id),
    avatar: avatarFor(a.id),
    bio: a.bio || "",
    wechat: "",
    circleIds: circleIdsByMember.get(a.id) ?? [],
  });

  const members: Member[] = loop.members.map(toMember);
  // The signed-in user may belong to no circles yet (so isn't in `members`);
  // the UI always dereferences them, so make sure they're present.
  if (!members.some((m) => m.id === loop.user.id)) members.unshift(toMember(loop.user));

  const circles: Circle[] = loop.circles.map((c) => ({
    id: c.id,
    name: c.name,
    short: c.icon || firstChar(c.name),
    color: colorFor(c.id),
    currency: c.currency || "积分",
    members: c.member_count,
    role: "",
    location: "",
    tagline: c.description || "",
    intro: c.description || "",
    scene: "",
    joining: c.joining === "approval" ? "受邀后需管理员审批" : "受邀后可直接加入",
    invitation: "邀请链接 7 天有效、单次使用。",
    principles: [],
    rules: [],
    references: [],
    memberIds: c.member_ids,
  }));

  const accounts = loop.circle_accounts.map((a) => ({
    memberId: a.account_id,
    circleId: a.circle_id,
    balance: a.balance,
    given: a.given,
    received: a.received,
  }));

  const listings: Listing[] = loop.listings.map((l) => ({
    id: l.id,
    memberId: l.member_id,
    type: l.type,
    title: l.title,
    detail: l.detail,
    circleIds: l.circle_ids,
    visibility: l.visibility === "public" ? "cross-circle" : (l.visibility as Listing["visibility"]),
    location: l.location,
    time: l.time,
    reference: l.reference,
    tags: l.tags,
    status: l.status,
    createdAt: formatDate(l.created_at),
  }));

  const goodCards: GoodCard[] = loop.good_cards.map((c) => ({
    id: c.id,
    fromMemberId: c.from_id,
    toMemberId: c.to_id,
    story: c.story || "",
    date: formatDate(c.created_at),
    tags: [],
    visibility: c.visibility === "cross-circle" || c.visibility === "public" ? "cross-circle" : "hidden",
    circleId: c.circle_id || "",
  }));

  const transactions: Transaction[] = loop.records.map((r) => ({
    id: r.id,
    circleId: r.circle_id,
    providerId: r.provider_id,
    receiverId: r.receiver_id,
    amount: r.amount,
    title: r.title || "",
    story: r.story || "",
    happenedAt: formatDate(r.happened_at || r.recorded_at),
    recordedAt: formatDate(r.recorded_at),
    // CC's Transaction.status has no "pending"; treat it as confirmed for display.
    visibility: r.visibility === "private" ? "private" : "public",
    status: r.status === "pending" ? "confirmed" : (r.status as Transaction["status"]),
    tags: r.tags,
  }));

  // Unified, recency-sorted activity feed the UI builds posts from.
  const activity = [
    ...loop.records.map((r) => ({ source: "transaction" as const, sourceId: r.id, ts: r.recorded_at })),
    ...loop.listings.map((l) => ({ source: "listing" as const, sourceId: l.id, ts: l.created_at })),
    ...loop.good_cards.map((c) => ({ source: "card" as const, sourceId: c.id, ts: c.created_at })),
  ]
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .map((a, i) => ({ id: i + 1, source: a.source, sourceId: a.sourceId }));

  return {
    members,
    circles,
    accounts,
    listings,
    goodCards,
    transactions,
    activity,
    settings: {
      publicCards: loop.settings.public_cards,
      publicListings: loop.settings.public_listings,
      keepHiddenPrivate: loop.settings.keep_hidden_private,
    },
    session: { authenticated: true },
    currentMemberId: loop.current_member_id,
  };
}

// The logged-out world: an empty shell so the UI can render a sign-in prompt.
export function anonymousDatabase(): AppDatabase {
  return {
    members: [],
    circles: [],
    accounts: [],
    listings: [],
    goodCards: [],
    transactions: [],
    activity: [],
    settings: { publicCards: true, publicListings: true, keepHiddenPrivate: true },
    session: { authenticated: false },
    currentMemberId: "",
  };
}
