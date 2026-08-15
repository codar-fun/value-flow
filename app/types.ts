// Domain types for the Flow Circle UI. Every field here is backed by a real
// loop-backend field (see `db/runtime.ts` for the mapping) — the only derived
// values are the two presentational enums below, which pick a CSS class.

export type AvatarVariant = "crop" | "wave" | "cap" | "bob" | "spike" | "curl" | "bun" | "leaf";
export type Color = "yellow" | "pink" | "blue" | "green" | "coral";

export type Member = {
  id: string;
  /** loop `display_name` (falls back to `username`) */
  name: string;
  /** first character of the name, for the avatar chip */
  initial: string;
  /** loop `handle`, e.g. `@ashu` */
  handle: string;
  color: Color;
  avatar: AvatarVariant;
  /** loop `bio` */
  bio: string;
  /** loop `wechat_contact` — only present for co-members */
  wechat: string;
  /** loop `address` (wallet-style id) */
  address: string;
  circleIds: string[];
};

/** A negotiation aid, e.g. 「一晚住宿 ≈ 10 泡泡」. Stored in `circle.settings`. */
export type CircleReference = { name: string; value: string; note: string };

export type CircleSettings = {
  allowNegativeBalance: boolean;
  requireConfirmation: boolean;
  allowRejectCorrect: boolean;
  references: CircleReference[];
  rules: string[];
};

export type Circle = {
  id: string;
  name: string;
  /** loop `icon` */
  short: string;
  color: Color;
  /** loop `currency` — what this circle calls its mutual-aid unit */
  currency: string;
  /** loop `member_count` */
  members: number;
  /** loop `description` */
  tagline: string;
  joining: "direct" | "approval";
  settings: CircleSettings;
  ownerId: string;
  isMember: boolean;
  memberIds: string[];
};

export type CircleAccount = {
  memberId: string;
  circleId: string;
  balance: number;
  given: number;
  received: number;
};

export type Listing = {
  id: string;
  memberId: string;
  type: "need" | "offer";
  title: string;
  detail: string;
  circleIds: string[];
  visibility: "circle" | "cross-circle";
  location: string;
  time: string;
  reference: string;
  tags: string[];
  status: "active" | "paused" | "closed";
  createdAt: string;
};

export type GoodCard = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  story: string;
  date: string;
  visibility: "cross-circle" | "hidden";
  circleId: string;
};

/** A correction one party proposed and the other has not yet resolved. */
export type PendingCorrection = {
  amount: number;
  title?: string;
  story?: string;
  proposedById: string;
};

export type Transaction = {
  id: string;
  circleId: string;
  /** empty on a redacted 神秘记录 — the server withholds the identities */
  providerId: string;
  receiverId: string;
  amount: number;
  title: string;
  story: string;
  happenedAt: string;
  recordedAt: string;
  visibility: "public" | "mystery" | "private";
  /** `pending` only occurs in circles with `requireConfirmation` on */
  status: "pending" | "confirmed" | "corrected" | "rejected";
  tags: string[];
  /** who logged it — only the other party may confirm a pending record */
  createdById: string;
  pendingCorrection: PendingCorrection | null;
  /** true when the server stripped the parties and story before sending it */
  redacted: boolean;
};

/** Someone waiting for the owner of a circle to let them in. */
export type JoinRequest = {
  circleId: string;
  member: Member;
  note: string;
  requestedAt: string;
};

/** A circle the signed-in user is *not* in yet (from `GET /api/circles`). */
export type DiscoverableCircle = {
  id: string;
  name: string;
  short: string;
  color: Color;
  currency: string;
  members: number;
  tagline: string;
  joining: "direct" | "approval";
  /** I've applied and am waiting on the owner — not joinable again. */
  pending?: boolean;
};

/** An activity notice from loop-backend. The copy is rendered client-side;
 *  loop stores only these structured fields, never display strings. */
export type Notification = {
  id: string;
  kind: string;
  actorId: string;
  amount: number | null;
  note: string;
  circleId: string;
  text: string;
  read: boolean;
  createdAt: string;
};
