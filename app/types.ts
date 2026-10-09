import type { PartnerAvatar } from "./lib/partner-avatar";
// Domain types for the Flow Circle UI. Every field here is backed by a real
// loop-backend field (see `db/runtime.ts` for the mapping) — the only derived
// values are the two presentational enums below, which pick a CSS class.

export type AbstractAvatarVariant = "crop" | "wave" | "cap" | "bob" | "spike" | "curl";
export type AvatarSkin = "ivory" | "cream" | "apricot" | "gold";
export type AvatarFaceShape = "round" | "oval" | "soft";
export type AvatarHair = "short" | "crop" | "fringe" | "bob" | "wave" | "curl" | "center" | "shag" | "bun" | "undercut" | "long" | "longWave" | "ponytail" | "braid" | "halfUp" | "twinTail";
export type AvatarHairColor = "ink" | "cocoa" | "chestnut" | "coral" | "auburn" | "blue" | "mint" | "plum";
export type AvatarEyes = "dot" | "smile" | "wink" | "calm" | "bright" | "crescent" | "glance";
export type AvatarGlasses = "none" | "round" | "oval" | "square" | "half";
export type AvatarMouth = "smile" | "flat" | "open" | "grin" | "pout" | "tiny";
export type AvatarAccessory = "none" | "dot" | "star" | "leaf" | "flower" | "clips" | "heart" | "moon" | "sparkle";
export type LegacyFaceAvatar = `custom:${string}`;
export type FaceAvatar = `custom2:${string}`;
export type AvatarVariant = AbstractAvatarVariant | LegacyFaceAvatar | FaceAvatar | PartnerAvatar;
export type Color = "yellow" | "pink" | "blue" | "green" | "coral";

export type Member = {
  id: string;
  /** loop `display_name` (falls back to `username`) */
  name: string;
  gender?: "male" | "female" | null;
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
  /** Discoverable circles this member belongs to that the viewer has not joined. */
  discoverableCircleIds?: string[];
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
  /** whether the circle is listed in discovery; "unknown" when the server
   *  didn't say — never treated as public */
  discoverability: "public" | "invite_only" | "unknown";
  settings: CircleSettings;
  ownerId: string;
  isMember: boolean;
  memberIds: string[];
  /** server totals of records on the ledger (not just the ones I can read);
   *  null when the server didn't send them */
  stats: { posted: number; mystery: number } | null;
};

export type CircleAccount = {
  memberId: string;
  circleId: string;
  balance: number;
  given: number;
  received: number;
  /** imported starting credit; null = never initialized */
  openingBalance: number | null;
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
  updatedAt: string;
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

/** A proposed change to a posted record (since 2026-10): nothing changes until
 *  the *other* party accepts. `kind: "revoke"` withdraws the whole record. */
export type Revision = {
  id: string;
  kind: "edit" | "revoke";
  baseVersion: number;
  oldValues: Partial<Record<"amount" | "title" | "story" | "visibility", string | number>>;
  newValues: Partial<Record<"amount" | "title" | "story" | "visibility", string | number>>;
  proposedById: string;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  resolvedById: string;
  createdAt: string;
  resolvedAt: string;
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
  /** bumped by every accepted revision */
  version: number;
  /** the open proposal on this record; only its two parties receive it */
  pendingRevision: Revision | null;
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
  description?: string;
  rules?: string[];
  joining: "direct" | "approval";
  discoverability: "public" | "invite_only" | "unknown";
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
  // Set on record events (backend record_id); "" for older notifications,
  // which fall back to matching by actor and amount.
  recordId: string;
  /** set on revision events */
  revisionId: string;
  text: string;
  read: boolean;
  createdAt: string;
};
