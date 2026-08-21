// Adapter layer: shapes loop-backend responses into the `AppDatabase` the CC
// frontend renders from. (Replaces the former Cloudflare D1 data layer.)
//
// Every field is carried over from loop; the only invented values are `color`
// and `avatar`, which pick one of the UI's CSS variants and are derived
// deterministically from the row's id when loop has nothing to say.
import type {
  AvatarVariant,
  Circle,
  CircleReference,
  Color,
  DiscoverableCircle,
  GoodCard,
  JoinRequest,
  Listing,
  Member,
  Notification,
  Transaction,
} from "../app/types";
import { abstractAvatarFor, isAvatarVariant } from "../app/lib/avatar";

export type AppDatabase = {
  members: Member[];
  circles: Circle[];
  accounts: Array<{ memberId: string; circleId: string; balance: number; given: number; received: number }>;
  listings: Listing[];
  goodCards: GoodCard[];
  transactions: Transaction[];
  activity: Array<{ id: number; source: "listing" | "card" | "transaction"; sourceId: string }>;
  joinRequests: JoinRequest[];
  /** circles I've applied to and am still waiting on */
  pendingCircles: DiscoverableCircle[];
  notifications: Notification[];
  unreadNotifications: number;
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
  wechat_contact?: string | null;
};

type LoopSettings = {
  allow_negative_balance?: boolean;
  require_confirmation?: boolean;
  allow_reject_correct?: boolean;
  references?: { name?: string; value?: string; note?: string }[];
  rules?: string[];
};

export type LoopCircle = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  currency: string | null;
  joining: string | null;
  settings: LoopSettings;
  owner_id: string | null;
  is_member?: boolean;
  /** "active" | "pending" | null — distinguishes "applied, waiting" from
   *  "never joined", which `is_member: false` alone flattens together. */
  membership_status?: string | null;
  member_count: number;
  member_ids?: string[];
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
    created_by_id: string | null;
    pending_correction: { amount: number; title?: string; story?: string; proposed_by_id: string } | null;
    redacted?: boolean;
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
  join_requests?: { circle_id: string; account: LoopAccount; note: string | null; requested_at: string }[];
  pending_circles?: LoopCircle[];
  notifications?: LoopNotification[];
  unread_notifications?: number;
};

type LoopNotification = {
  id: string;
  kind: string;
  actor_id: string | null;
  amount: number | null;
  note: string | null;
  circle_id: string | null;
  text: string | null;
  read: boolean;
  created_at: string;
};

// ─── presentation-only derivations ──────────────────────────────────────────

const COLORS: Color[] = ["yellow", "pink", "blue", "green", "coral"];

// The hexes CC writes when creating a circle (see app/api/circles/route.ts),
// mapped back to the CSS colour name so a circle keeps the look it was made with.
const HEX_TO_COLOR: Record<string, Color> = {
  "#e8935a": "coral",
  "#7ec99a": "green",
  "#6aa7d8": "blue",
  "#d98cae": "pink",
  "#e0b750": "yellow",
};

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const colorFor = (seed: string): Color => COLORS[hash(seed) % COLORS.length];

function circleColor(c: LoopCircle): Color {
  const hex = (c.color || "").toLowerCase();
  return HEX_TO_COLOR[hex] ?? colorFor(c.id);
}

// loop's `avatar` is a free-form string. A new account has no avatar yet, so it
// receives one of eight stable abstract marks; a later face customisation is
// stored in the same field and validated before it reaches the UI.
function avatarFor(a: LoopAccount): AvatarVariant {
  return isAvatarVariant(a.avatar) ? a.avatar : abstractAvatarFor(a.id);
}

const firstChar = (s: string | null | undefined) => (s && s.length ? Array.from(s)[0] : "•");

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function toSettings(s: LoopSettings | null | undefined): Circle["settings"] {
  const raw = s || {};
  const references: CircleReference[] = (raw.references ?? []).map((r) => ({
    name: r.name ?? "",
    value: r.value ?? "",
    note: r.note ?? "",
  }));
  return {
    allowNegativeBalance: raw.allow_negative_balance === true,
    requireConfirmation: raw.require_confirmation === true,
    allowRejectCorrect: raw.allow_reject_correct === true,
    references,
    rules: raw.rules ?? [],
  };
}

export function toCircle(c: LoopCircle, memberIds: string[] = []): Circle {
  return {
    id: c.id,
    name: c.name,
    short: c.icon || firstChar(c.name),
    color: circleColor(c),
    currency: c.currency || "积分",
    members: c.member_count,
    tagline: c.description || "",
    joining: c.joining === "approval" ? "approval" : "direct",
    settings: toSettings(c.settings),
    ownerId: c.owner_id || "",
    isMember: c.is_member !== false,
    memberIds,
  };
}

/** A circle the user hasn't joined — the "discover" list carries no members. */
export function toDiscoverable(c: LoopCircle): DiscoverableCircle {
  return {
    id: c.id,
    name: c.name,
    short: c.icon || firstChar(c.name),
    color: circleColor(c),
    currency: c.currency || "积分",
    members: c.member_count,
    tagline: c.description || "",
    joining: c.joining === "approval" ? "approval" : "direct",
    pending: c.membership_status === "pending",
  };
}

// ─── loop → AppDatabase ─────────────────────────────────────────────────────

export function toAppDatabase(loop: LoopBootstrap): AppDatabase {
  // circleIds per member, derived from each circle's member_ids
  const circleIdsByMember = new Map<string, string[]>();
  for (const c of loop.circles) {
    for (const mid of c.member_ids ?? []) {
      circleIdsByMember.set(mid, [...(circleIdsByMember.get(mid) ?? []), c.id]);
    }
  }

  const toMember = (a: LoopAccount): Member => ({
    id: a.id,
    name: a.display_name || a.username || "成员",
    initial: firstChar(a.display_name || a.username),
    handle: a.handle || "",
    color: colorFor(a.id),
    avatar: avatarFor(a),
    bio: a.bio || "",
    wechat: a.wechat_contact || "",
    address: a.address || "",
    circleIds: circleIdsByMember.get(a.id) ?? [],
  });

  // Pending applicants are not active circle members yet, so loop keeps them
  // in join_requests rather than members. Their identities still need to be
  // available to notifications; otherwise the same person appears as
  // "未知成员" in one surface and with a real name in the approval queue.
  const memberAccounts = new Map<string, LoopAccount>(loop.members.map((account) => [account.id, account]));
  for (const request of loop.join_requests ?? []) {
    if (!memberAccounts.has(request.account.id)) memberAccounts.set(request.account.id, request.account);
  }
  const members: Member[] = Array.from(memberAccounts.values()).map(toMember);
  // The signed-in user may belong to no circles yet (so isn't in `members`);
  // the UI always dereferences them, so make sure they're present.
  if (!members.some((m) => m.id === loop.user.id)) members.unshift(toMember(loop.user));

  const circles: Circle[] = loop.circles.map((c) => toCircle(c, c.member_ids ?? []));

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
    visibility: c.visibility === "cross-circle" || c.visibility === "public" ? "cross-circle" : "hidden",
    circleId: c.circle_id || "",
  }));

  const transactions: Transaction[] = loop.records.map((r) => ({
    id: r.id,
    circleId: r.circle_id,
    // A redacted mystery record arrives with its parties nulled out.
    providerId: r.provider_id ?? "",
    receiverId: r.receiver_id ?? "",
    // Who logged it: only the *other* party may confirm, so the UI needs this
    // to know whether to offer the button at all.
    createdById: r.created_by_id ?? "",
    amount: r.amount,
    title: r.title || "",
    story: r.story || "",
    happenedAt: formatDate(r.happened_at || r.recorded_at),
    recordedAt: formatDate(r.recorded_at),
    visibility: (r.visibility === "private" || r.visibility === "mystery"
      ? r.visibility
      : "public") as Transaction["visibility"],
    status: r.status as Transaction["status"],
    tags: r.tags,
    pendingCorrection: r.pending_correction
      ? {
          amount: r.pending_correction.amount,
          title: r.pending_correction.title,
          story: r.pending_correction.story,
          proposedById: r.pending_correction.proposed_by_id,
        }
      : null,
    redacted: r.redacted === true,
  }));

  const joinRequests: JoinRequest[] = (loop.join_requests ?? []).map((r) => ({
    circleId: r.circle_id,
    member: toMember(r.account),
    note: r.note || "",
    requestedAt: formatDate(r.requested_at),
  }));

  const pendingCircles: DiscoverableCircle[] = (loop.pending_circles ?? []).map((c) => ({
    ...toDiscoverable(c),
    pending: true,
  }));

  const notifications: Notification[] = (loop.notifications ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    actorId: n.actor_id || "",
    amount: n.amount,
    note: n.note || "",
    circleId: n.circle_id || "",
    text: n.text || "",
    read: n.read,
    createdAt: formatDate(n.created_at),
  }));

  // Unified, recency-sorted activity feed the UI builds posts from. (loop has
  // no `activities` table — the client assembles it from the three sources.)
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
    joinRequests,
    pendingCircles,
    notifications,
    unreadNotifications: loop.unread_notifications ?? 0,
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
    joinRequests: [],
    pendingCircles: [],
    notifications: [],
    unreadNotifications: 0,
    settings: { publicCards: true, publicListings: true, keepHiddenPrivate: true },
    session: { authenticated: false },
    currentMemberId: "",
  };
}
