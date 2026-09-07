"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import type { AbstractAvatarVariant, AvatarEyes, AvatarGlasses, AvatarHair, AvatarHairColor, AvatarMouth, AvatarSkin, AvatarVariant, Circle, Color, DiscoverableCircle, JoinRequest, Member, Transaction } from "./types";
import { ABSTRACT_AVATARS, AVATAR_EYES, AVATAR_GLASSES, AVATAR_HAIRS, AVATAR_HAIR_COLORS, AVATAR_MOUTHS, AVATAR_SKINS, CURATED_FACE_PRESETS, DEFAULT_FACE_CONFIG, abstractAvatarFor, encodeFaceAvatar, parseFaceAvatar, type FaceConfig } from "./lib/avatar";
import { FaceAvatarArtwork } from "./components/face-avatar";
import { AbstractAvatarArtwork } from "./components/abstract-avatar";
import type { AppDatabase } from "../db/runtime";
import type { ComposeInput } from "./api/records/route";

type View = "feed" | "discover" | "circle" | "me" | "about" | "create";
type ComposerType = "record" | "need" | "offer" | "card";
type FeedFilter = "all" | "trade" | "need" | "offer" | "card";
type DiscoverFilter = "all" | "need" | "offer" | "circles";
type ProfileTab = "cards" | "listings" | "transactions";
type NotificationDestination = "members" | "transactions" | "cards" | "circle";
type Overlay = "share" | "postShare" | "profile" | "rules" | "members" | "invite" | "feedFilter" | "post" | "settings" | "circleSettings" | "editProfile" | "notifications" | null;
type TransactionDialog = { kind: "correct" | "reject"; transaction: Transaction; currency: string };

type Post = {
  /** stable across refetches: "<source>:<sourceId>", never the array index */
  id: string;
  kind: "offer" | "need" | "trade" | "mystery" | "card";
  badge: string;
  person: string;
  caption: string;
  memberId?: string;
  avatar: string;
  avatarVariant: AvatarVariant;
  color: Color;
  text: string;
  meta: string;
  chips: string[];
  /** every circle this entry is visible in — a listing can span several */
  circleIds: string[];
  source: "listing" | "card" | "transaction";
  sourceId: string;
};

// Empty world until the loop-backend session loads — no demo/default user.
const initialDb: AppDatabase = { members: [], circles: [], accounts: [], listings: [], goodCards: [], transactions: [], activity: [], joinRequests: [], pendingCircles: [], notifications: [], unreadNotifications: 0, settings: { publicCards: true, publicListings: true, keepHiddenPrivate: true }, session: { authenticated: false }, currentMemberId: "" };
const EMPTY_SETTINGS: Circle["settings"] = { allowNegativeBalance: false, requireConfirmation: false, allowRejectCorrect: false, references: [], rules: [] };
const EMPTY_CIRCLE: Circle = { id: "", name: "", short: "•", color: "green", currency: "积分", members: 0, tagline: "", joining: "direct", settings: EMPTY_SETTINGS, ownerId: "", isMember: false, memberIds: [] };
let activeDb = initialDb;
let members = activeDb.members;
let circles = activeDb.circles;

const AVATAR_PART_LABELS = {
  skin: { ivory: "象牙白", cream: "米白", apricot: "暖杏", gold: "暖黄" } as Record<AvatarSkin, string>,
  hair: { short: "侧分短发", crop: "短碎发", fringe: "齐刘海", bob: "齐耳短发", wave: "自然波浪", curl: "轻卷发", center: "中分短发", shag: "层次短发", bun: "丸子头", undercut: "渐层短发", long: "长直发", longWave: "长波浪", ponytail: "高马尾", braid: "侧编发", halfUp: "半扎长发", twinTail: "双马尾" } as Record<AvatarHair, string>,
  hairColor: { ink: "墨黑", cocoa: "深棕", chestnut: "栗棕", coral: "珊瑚", auburn: "赤茶", blue: "湖蓝", mint: "薄荷", plum: "灰紫" } as Record<AvatarHairColor, string>,
  eyes: { dot: "圆眼", smile: "笑眼", wink: "眨眼", calm: "平静", bright: "亮眼", crescent: "月牙眼", glance: "侧看" } as Record<AvatarEyes, string>,
  glasses: { none: "不戴", round: "小圆框", oval: "椭圆框", square: "圆角方框", half: "轻半框" } as Record<AvatarGlasses, string>,
  mouth: { smile: "微笑", flat: "平静", open: "开口笑", grin: "露齿笑", pout: "嘟嘴", tiny: "浅笑" } as Record<AvatarMouth, string>,
};
type AvatarPart = "hair" | "eyes" | "glasses" | "mouth" | "color";

type CircleIconKey = "n1" | "n2" | "n3" | "n4" | "t1" | "t2" | "t3" | "t4" | "r1" | "r2" | "r3" | "r4" | "c1" | "c2" | "c3" | "c4";
const CIRCLE_ICON_GROUPS: { label: string; note: string; keys: CircleIconKey[] }[] = [
  { label: "自然", note: "叶、河流、种子与山", keys: ["n1", "n2", "n3", "n4"] },
  { label: "科技", note: "电路、信号、节点与轨道", keys: ["t1", "t2", "t3", "t4"] },
  { label: "旅行", note: "路径、方向、营地与船", keys: ["r1", "r2", "r3", "r4"] },
  { label: "文化", note: "书、舞台、音乐与编织", keys: ["c1", "c2", "c3", "c4"] },
];
const CIRCLE_ICON_LABELS: Record<CircleIconKey, string> = {
  n1: "叶片", n2: "河流", n3: "种子", n4: "山野",
  t1: "电路", t2: "信号", t3: "节点", t4: "轨道",
  r1: "路径", r2: "方向", r3: "营地", r4: "远航",
  c1: "共读", c2: "舞台", c3: "音乐", c4: "编织",
};
const CIRCLE_ICON_KEYS = CIRCLE_ICON_GROUPS.flatMap((group) => group.keys);

// New circles store a compact two-character icon key in loop's existing icon
// field. Legacy circles keep their old value in the backend but map to a
// stable pictogram here, so no letter/initial leaks back into the UI.
function circleIconFor(value: string, seed: string): CircleIconKey {
  if ((CIRCLE_ICON_KEYS as string[]).includes(value)) return value as CircleIconKey;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CIRCLE_ICON_KEYS[h % CIRCLE_ICON_KEYS.length];
}

// A stand-in for an id we can't resolve. Falling back to `members[0]` used to
// put a real person's name (usually the signed-in user's) on someone else's
// record — silently wrong is worse than visibly unknown.
const UNKNOWN_MEMBER: Member = { id: "", name: "未知成员", initial: "•", handle: "", color: "blue", avatar: "crop", bio: "", wechat: "", address: "", circleIds: [] };

function memberById(id?: string) {
  return members.find((member) => member.id === id) ?? UNKNOWN_MEMBER;
}

// UNKNOWN_MEMBER has no id, so nothing can be opened for them — don't offer.
const isKnown = (member: Member) => member.id !== "";

function circleById(id?: string): Circle | undefined {
  return circles.find((circle) => circle.id === id);
}

function accountFor(memberId: string, circleId: string) {
  return activeDb.accounts.find((account) => account.memberId === memberId && account.circleId === circleId) ?? { memberId, circleId, balance: 0, given: 0, received: 0 };
}

function buildPosts(): Post[] {
  const result: Post[] = [];
  for (const activity of activeDb.activity) {
    const postId = `${activity.source}:${activity.sourceId}`;
    if (activity.source === "listing") {
      const listing = activeDb.listings.find((item) => item.id === activity.sourceId);
      const member = activeDb.members.find((item) => item.id === listing?.memberId);
      // Paused/closed listings stay in the author's own archive but must leave
      // the feed — otherwise people keep answering a withdrawn offer.
      if (!listing || !member || listing.status !== "active") continue;
      const names = listing.circleIds.map((id) => circleById(id)?.name).filter(Boolean);
      const scope = listing.visibility === "cross-circle" ? "跨圈公开" : names.join("、");
      result.push({ id: postId, kind: listing.type, badge: listing.type === "need" ? "我想要" : "我可以给", person: member.name, caption: member.handle, memberId: member.id, avatar: member.initial, avatarVariant: member.avatar, color: listing.type === "need" ? "pink" : "green", text: listing.detail || listing.title, meta: [scope, listing.location].filter(Boolean).join(" · "), chips: listing.tags, circleIds: listing.circleIds, source: activity.source, sourceId: listing.id });
      continue;
    }
    if (activity.source === "card") {
      const card = activeDb.goodCards.find((item) => item.id === activity.sourceId);
      const from = activeDb.members.find((item) => item.id === card?.fromMemberId);
      const to = activeDb.members.find((item) => item.id === card?.toMemberId);
      if (!card || !from || !to) continue;
      result.push({ id: postId, kind: "card", badge: "好人卡", person: `${from.name} → ${to.name}`, caption: card.visibility === "cross-circle" ? "跨圈公开" : "已隐藏", memberId: to.id, avatar: to.initial, avatarVariant: to.avatar, color: "coral", text: card.story, meta: `${card.date} · 被好好看见`, chips: [], circleIds: card.circleId ? [card.circleId] : [], source: activity.source, sourceId: card.id });
      continue;
    }
    const transaction = activeDb.transactions.find((item) => item.id === activity.sourceId);
    const circle = activeDb.circles.find((item) => item.id === transaction?.circleId);
    if (!transaction || !circle) continue;
    // The server strips the parties and the story from a 神秘记录 before it
    // reaches anyone who wasn't involved, so there is nobody to look up.
    const hidden = transaction.redacted;
    const provider = activeDb.members.find((item) => item.id === transaction.providerId);
    const receiver = activeDb.members.find((item) => item.id === transaction.receiverId);
    if (!hidden && (!provider || !receiver)) continue;
    const pending = transaction.status === "pending";
    result.push({ id: postId, kind: hidden ? "mystery" : "trade", badge: hidden ? "神秘记录" : pending ? "待确认" : "互助完成", person: hidden ? "圈里发生了一次互助" : `${provider!.name} → ${receiver!.name}`, caption: hidden ? "身份与故事已隐藏" : pending ? "等待另一方确认" : transaction.visibility === "private" ? "仅当事人" : transaction.visibility === "mystery" ? "神秘记录 · 只有你们看得到" : "圈内公开", memberId: hidden ? undefined : provider!.id, avatar: hidden ? "?" : provider!.initial, avatarVariant: hidden ? "crop" : provider!.avatar, color: hidden ? "blue" : "yellow", text: hidden ? "参与者和故事选择了隐藏。" : transaction.story || transaction.title, meta: `${circle.name} · ${transaction.amount} ${circle.currency}`, chips: transaction.tags, circleIds: [circle.id], source: activity.source, sourceId: transaction.id });
  }
  return result;
}

let posts = buildPosts();

const intents: { id: ComposerType; label: string; color: Color; icon: string }[] = [
  { id: "record", label: "记一笔", color: "yellow", icon: "记" },
  { id: "need", label: "我想要", color: "pink", icon: "要" },
  { id: "offer", label: "我可以给", color: "green", icon: "给" },
  { id: "card", label: "好人卡", color: "blue", icon: "心" },
];

function Character({ member, text, color = "yellow", variant = "crop", small = false }: { member?: Member; text?: string; color?: Color; variant?: AvatarVariant; small?: boolean }) {
  const active = member ?? { initial: text ?? "友", color, avatar: variant };
  const symbolOnly = !member && Boolean(text);
  const face = parseFaceAvatar(active.avatar);
  const avatarClasses = face
    ? `avatar-custom avatar-skin-${face.skin} avatar-shape-${face.shape} avatar-hair-${face.hair} avatar-hair-color-${face.hairColor} avatar-eyes-${face.eyes} avatar-glasses-${face.glasses} avatar-mouth-${face.mouth}`
    : `avatar-abstract face-${active.avatar}`;
  return <span className={`character character-${active.color} ${avatarClasses} ${symbolOnly ? "character-symbol" : ""} ${small ? "character-small" : ""}`} aria-hidden="true">{symbolOnly
    ? <b className="character-mark">{active.initial}</b>
    : face
      ? <FaceAvatarArtwork config={face}/>
      : <AbstractAvatarArtwork variant={active.avatar as AbstractAvatarVariant}/>}</span>;
}

function CircleGlyph({ icon, seed, size = "regular" }: { icon: string; seed: string; size?: "tiny" | "small" | "regular" | "large" }) {
  const key = circleIconFor(icon, seed);
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <span className={`circle-glyph circle-glyph-${key[0]} circle-glyph-${size}`} aria-hidden="true"><svg viewBox="0 0 48 48" {...common}>
    {key === "n1" && <><path fill="var(--green)" d="M11 31C12 16 23 10 37 9c-1 14-8 27-23 28z"/><path d="M14 35c7-8 12-13 21-22M20 28l-1-8M26 22l7 1"/></>}
    {key === "n2" && <><circle cx="35" cy="13" r="5" fill="var(--yellow)"/><path d="M7 18c8-6 14 6 22 0s11-3 13-1M6 27c8-6 14 6 22 0s11-3 14-1M8 36c7-5 13 4 20 0s10-3 13-1" stroke="var(--blue)"/></>}
    {key === "n3" && <><ellipse cx="24" cy="33" rx="7" ry="9" fill="var(--coral)"/><path d="M24 25c-2-9-8-12-14-10 1 7 5 11 14 10ZM24 25c2-9 8-12 14-10-1 7-5 11-14 10Z" fill="var(--green)"/><path d="M24 25v9"/></>}
    {key === "n4" && <><circle cx="34" cy="13" r="5" fill="var(--yellow)"/><path d="m7 37 12-17 7 8 5-6 10 15" fill="var(--green)"/><path d="m16 25 3-5 4 5" fill="var(--blue)"/></>}
    {key === "t1" && <><path d="M10 38V25h9V12M19 25h10v9h9M29 25V12h9"/><circle cx="19" cy="9" r="3" fill="var(--yellow)"/><circle cx="38" cy="9" r="3" fill="var(--blue)"/><circle cx="38" cy="37" r="3" fill="var(--coral)"/><circle cx="10" cy="40" r="3" fill="var(--green)"/></>}
    {key === "t2" && <><circle cx="24" cy="25" r="4" fill="var(--coral)"/><path d="M16 18a10 10 0 0 0 0 14M32 18a10 10 0 0 1 0 14M11 13a17 17 0 0 0 0 24M37 13a17 17 0 0 1 0 24" stroke="var(--blue)"/></>}
    {key === "t3" && <><rect x="8" y="9" width="9" height="9" rx="2" fill="var(--yellow)"/><rect x="31" y="9" width="9" height="9" rx="2" fill="var(--blue)"/><rect x="19.5" y="30" width="9" height="9" rx="2" fill="var(--green)"/><path d="M17 13.5h14M12.5 18v8l11.5 4M35.5 18v8L24 30"/></>}
    {key === "t4" && <><path d="M14 29 25 14l9 7-11 15z" fill="var(--paper-strong)"/><path d="m28 16 4-6M16 32l-4 5M31 31c7-1 10-4 10-7M17 18c-7 1-10 4-10 7"/><circle cx="36" cy="37" r="3" fill="var(--yellow)"/></>}
    {key === "r1" && <><path d="M9 39c1-9 18-6 16-15S37 17 39 9" stroke="var(--coral)"/><circle cx="9" cy="39" r="3" fill="var(--yellow)"/><circle cx="39" cy="9" r="3" fill="var(--green)"/><path d="m31 10 8-3 2 8"/></>}
    {key === "r2" && <><circle cx="24" cy="24" r="14" fill="var(--paper-strong)"/><path d="m29 17-3 10-9 4 4-10z" fill="var(--coral)"/><circle cx="24" cy="24" r="2" fill="var(--yellow)"/></>}
    {key === "r3" && <><path d="m8 37 15-21 16 21z" fill="var(--coral)"/><path d="m23 16 4 21M14 37l10-13 9 13"/><path d="M34 19v-8M34 11h7l-3 4 3 4h-7" fill="var(--green)"/></>}
    {key === "r4" && <><path d="m10 27 6 10h20l5-10z" fill="var(--blue)"/><path d="M24 12v15M24 13l11 9H24" fill="var(--yellow)"/><path d="M7 41c5-4 9 4 14 0s9 4 14 0 7 0 8 0"/></>}
    {key === "c1" && <><path d="M7 13c7-3 12-1 17 3v23c-5-4-10-6-17-3z" fill="var(--paper-strong)"/><path d="M41 13c-7-3-12-1-17 3v23c5-4 10-6 17-3z" fill="var(--blue)"/><path d="M24 16v23"/></>}
    {key === "c2" && <><path d="M8 10h32v7H8z" fill="var(--yellow)"/><path d="M10 17c8 2 8 13 3 22M38 17c-8 2-8 13-3 22" fill="var(--coral)"/><path d="M18 17c2 7 2 15-1 22M30 17c-2 7-2 15 1 22"/></>}
    {key === "c3" && <><path d="M20 10v24c-5-2-10 0-10 4s8 5 12 0c1-2 1-4 1-7V17l15-4v16c-5-2-10 0-10 4s8 5 12 0c1-2 1-4 1-7V8z" fill="var(--yellow)"/><path d="m23 17 18-5"/></>}
    {key === "c4" && <><path d="M11 10v28M19 10v28M29 10v28M37 10v28M10 13h28M10 21h28M10 31h28M10 39h28"/><path d="m9 16 8-7 22 22-8 8z" fill="var(--green)"/><path d="m31 9 8 8-22 22-8-8z" fill="var(--coral)"/></>}
  </svg></span>;
}

function BrandGlyph({ large = false }: { large?: boolean }) {
  return <span className={`brand-glyph ${large ? "brand-glyph-large" : ""}`} aria-hidden="true"><svg viewBox="0 0 48 48">
    <path d="M15 6h18c6 0 9 3 9 9v18c0 6-3 9-9 9H15c-6 0-9-3-9-9V15c0-6 3-9 9-9Z" fill="var(--paper-strong)"/>
    <path d="M15 6h18c6 0 9 3 9 9v3c-5-2-10-1-13 3-2 3-3 5-5 5-3 0-4-4-7-5-3-2-7-1-11 1v-7c0-6 3-9 9-9Z" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M42 18v15c0 6-3 9-9 9h-8c1-5-2-8-2-12 0-3 3-5 6-9 3-4 8-5 13-3Z" fill="var(--green)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M25 42H15c-6 0-9-3-9-9v-2c5 1 9-1 12-5 2-2 4-2 6 0-1 5 2 8 1 16Z" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M15 6h18c6 0 9 3 9 9v18c0 6-3 9-9 9H15c-6 0-9-3-9-9V15c0-6 3-9 9-9Z" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round"/>
  </svg></span>;
}

function NotificationIcon() {
  return <span className="notification-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 22h14c-2-2-2-4-2-8a5 5 0 0 0-10 0c0 4 0 6-2 8Z" fill="var(--yellow)"/><path d="M14 8V6h4v2M14 25c1 2 3 2 4 0"/><circle cx="16" cy="24" r="2" fill="var(--coral)"/></svg></span>;
}

function NavIcon({ kind }: { kind: "feed" | "discover" | "record" | "circle" | "me" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <span className={`nav-icon nav-icon-${kind}`} aria-hidden="true"><svg viewBox="0 0 24 24" {...common}>
    {kind === "feed" && <><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/><path d="M10 20v-5h4v5"/></>}
    {kind === "discover" && <><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/></>}
    {kind === "record" && <path d="M12 7.5v9M7.5 12h9"/>}
    {kind === "circle" && <><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><circle cx="12" cy="16" r="3"/><path d="M10.5 10.8 11 13M13.5 10.8 13 13"/></>}
    {kind === "me" && <><rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M7 16c.8-1.5 3.2-1.5 4 0M14 10h3M14 14h3"/></>}
  </svg></span>;
}

function QrCode({ value, className = "qr-code" }: { value: string; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    if (!value) return () => { active = false; };
    QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: "#111111", light: "#ffffff" } })
      .then((next) => { if (active) setSrc(next); })
      .catch(() => { if (active) setSrc(""); });
    return () => { active = false; };
  }, [value]);
  return <div className={className} aria-label="二维码">{src ? <img src={src} alt="扫码打开链接"/> : <span>正在生成二维码…</span>}</div>;
}

function isLocalUrl(value: string): boolean {
  try { return ["localhost", "127.0.0.1", "::1"].includes(new URL(value).hostname); }
  catch { return false; }
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 60) || "流动圈分享图";
}

async function savePosterImage(element: HTMLElement | null, filename: string): Promise<void> {
  if (!element) throw new Error("分享图还没有准备好");
  await document.fonts?.ready;
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (!image.complete) await new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
    try { await image.decode(); } catch { /* The loaded pixels can still be captured. */ }
  }));
  const dataUrl = await toPng(element, { cacheBust: true, pixelRatio: 2, backgroundColor: "#fffaf2" });
  const link = document.createElement("a");
  link.download = `${safeFilename(filename)}.png`;
  link.href = dataUrl;
  link.click();
}

function Pill({ children, color = "cream" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill pill-${color}`}>{children}</span>;
}

function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="section-title"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<b>→</b></button>}</div>;
}

function LoginGate({ onDone }: { onDone: () => Promise<void> }) {
  const [testUsers, setTestUsers] = useState<Array<{ key: string; label: string }>>([]);
  const [step, setStep] = useState<"email" | "code" | "profile">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/test-users", { cache: "no-store" })
      .then(async (res) => (res.ok ? await res.json() as { users?: Array<{ key: string; label: string }> } : null))
      .then((data) => { if (active && data?.users) setTestUsers(data.users); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function post(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "操作失败");
    return data as Record<string, unknown>;
  }

  async function requestCode() {
    if (!email.trim()) return setError("请填写邮箱");
    setBusy(true); setError("");
    try { await post("/api/auth/request", { email: email.trim() }); setStep("code"); }
    catch (e) { setError(e instanceof Error ? e.message : "发送失败"); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!code.trim()) return setError("请填写验证码");
    setBusy(true); setError("");
    try {
      const data = await post("/api/auth/verify", { email: email.trim(), code: code.trim() });
      if (data.needs_profile) { setStep("profile"); setBusy(false); return; }
      await onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "验证失败"); setBusy(false); }
  }

  async function finishProfile() {
    if (!username.trim()) return setError("请填写用户名");
    setBusy(true); setError("");
    try { await post("/api/auth/profile", { username: username.trim() }); await onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "保存失败"); setBusy(false); }
  }

  async function testLogin(user: string) {
    setBusy(true); setError("");
    try { await post("/api/auth/test-login", { user }); await onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "本地测试登录失败"); setBusy(false); }
  }

  return <main className="join-page"><section className="join-card">
    <div className="join-brand"><BrandGlyph/><span>FLOW CIRCLE · 登录流动圈</span></div>
    <h1>{step === "profile" ? "给自己取个名字" : "用邮箱验证码登录"}</h1>
    <p>{step === "email" ? "输入邮箱，我们会发送一次性验证码。" : step === "code" ? `验证码已发送到 ${email}` : "这个名字会显示在圈子里。"}</p>
    {error && <p className="account-error">{error}</p>}
    {step === "email" && <>
      <div className="account-form"><label><span>邮箱</span><input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"/></label></div>
      <button className="primary-button" onClick={requestCode} disabled={busy}>{busy ? "发送中…" : "发送验证码"}</button>
    </>}
    {step === "code" && <>
      <div className="account-form"><label><span>验证码</span><input inputMode="numeric" placeholder="6 位验证码" value={code} onChange={(e) => setCode(e.target.value)}/></label></div>
      <button className="primary-button" onClick={verify} disabled={busy}>{busy ? "验证中…" : "登录"}</button>
      <button className="text-link" onClick={() => { setStep("email"); setError(""); }}>换一个邮箱</button>
    </>}
    {step === "profile" && <>
      <div className="account-form"><label><span>用户名（英文 / 数字，3–20 位）</span><input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)}/></label></div>
      <button className="primary-button" onClick={finishProfile} disabled={busy}>{busy ? "保存中…" : "进入流动圈"}</button>
    </>}
    {testUsers.length > 0 && <div className="local-test-auth">
      <b>本地测试登录</b>
      <p>使用 loop-backend 签发的独立测试身份；仅在本地后端配置后显示。</p>
      <div className="local-test-users">{testUsers.map((user) => <button key={user.key} onClick={() => testLogin(user.key)} disabled={busy}>{user.label}</button>)}</div>
    </div>}
  </section></main>;
}

export default function Home() {
  const [db, setDb] = useState<AppDatabase>(initialDb);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("feed");
  // No seeded ids: the active circle/member/post are whatever the loaded world
  // and the user's own clicks say they are.
  const [circleId, setCircleId] = useState("");
  const [feedCircleId, setFeedCircleId] = useState("all");
  const [composer, setComposer] = useState(false);
  const [intent, setIntent] = useState<ComposerType>("record");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [profileTab, setProfileTab] = useState<ProfileTab>("cards");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>("all");
  const [openCircles, setOpenCircles] = useState<DiscoverableCircle[]>([]);
  const [toast, setToast] = useState("");
  // A failed bootstrap used to fall through to the login gate, so a 502 looked
  // exactly like being signed out and asked people to re-enter an OTP.
  const [loadFailed, setLoadFailed] = useState(false);
  const [createSession, setCreateSession] = useState(0);
  // Sheets opened from inside another sheet return there on close, instead of
  // dumping the user back to the feed.
  const [overlayReturn, setOverlayReturn] = useState<Overlay>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  activeDb = db; members = db.members; circles = db.circles; posts = buildPosts();
  const currentMemberId = db.currentMemberId;

  async function refreshData() {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    const payload = await response.json() as AppDatabase & { error?: string };
    if (!response.ok) { setLoadFailed(true); throw new Error(payload.error || "数据加载失败"); }
    setLoadFailed(false);
    setDb(payload);
    loadOpenCircles();
  }

  // Call this instead of refreshData() after a write has already succeeded. A
  // failed refetch leaves the screen stale, which the next load fixes; letting
  // it surface as a failed write is what makes people retry — and on the
  // composer path a retry writes a second ledger entry.
  async function syncAfterWrite() {
    try { await refreshData(); } catch { /* stale until the next load */ }
  }
  refreshRef.current = refreshData;

  // Circles the user could still join (loop's `GET /circles`, minus their own).
  function loadOpenCircles() {
    fetch("/api/circles", { cache: "no-store" })
      .then(async (r) => { const d = await r.json() as { circles?: DiscoverableCircle[] }; if (r.ok) setOpenCircles(d.circles ?? []); })
      .catch(() => { /* discovery is optional; the rest of the app still works */ });
  }

  async function resolveRequest(cid: string, memberId: string, action: "approve" | "decline") {
    try {
      const response = await fetch(`/api/circles/${cid}/requests/${memberId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "处理失败");
      await syncAfterWrite();
      flash(action === "approve" ? "已通过，对方成为正式成员" : "已谢绝这次申请");
    } catch (error) { flash(error instanceof Error ? error.message : "处理失败"); }
  }

  async function joinCircle(circle: DiscoverableCircle) {
    if (circle.pending) return withdrawRequest(circle);
    try {
      const response = await fetch(`/api/circles/${circle.id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "加入失败");
      await syncAfterWrite();
      flash(result.status === "pending" ? `已申请加入${circle.name}，等待圈主确认` : `已加入${circle.name}`);
    } catch (error) { flash(error instanceof Error ? error.message : "加入失败"); }
  }

  async function withdrawRequest(circle: DiscoverableCircle) {
    try {
      const response = await fetch(`/api/circles/${circle.id}/join`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "撤回失败");
      await syncAfterWrite();
      flash(`已撤回加入${circle.name}的申请`);
    } catch (error) { flash(error instanceof Error ? error.message : "撤回失败"); }
  }

  async function leaveCircle(circle: Circle): Promise<boolean> {
    try {
      const response = await fetch(`/api/circles/${circle.id}/leave`, { method: "DELETE" });
      const result = await response.json() as { status?: string; error?: string };
      // loop refuses with a reason (还欠着额度 / 要先转让圈主) — show it as-is.
      if (!response.ok) throw new Error(result.error || "退出失败");
      setOverlay(null); showAllCircles();
      await syncAfterWrite();
      flash(result.status === "archived" ? `已退出，${circle.name}没有成员了，已归档` : `已退出${circle.name}`);
      return true;
    } catch (error) { flash(error instanceof Error ? error.message : "退出失败"); return false; }
  }

  async function transferOwner(circle: Circle, memberId: string): Promise<boolean> {
    const target = memberById(memberId);
    try {
      const response = await fetch(`/api/circles/${circle.id}/owner`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "转让失败");
      await syncAfterWrite();
      flash(`已把圈主转让给 ${target.name}`);
      return true;
    } catch (error) { flash(error instanceof Error ? error.message : "转让失败"); return false; }
  }

  async function markNotificationsRead() {
    try {
      await fetch("/api/notifications/read", { method: "POST" });
      await syncAfterWrite();
    } catch { /* the badge simply stays until the next load */ }
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) { flash("退出登录失败，请重试"); return; }
    } catch { flash("退出登录失败，请检查网络"); return; }
    setView("feed"); setOverlay(null); setComposer(false);
    setCircleId(""); setFeedCircleId("all"); setSelectedMemberId(""); setSelectedPostId("");
    setOpenCircles([]); setLoadFailed(false);
    setDb(initialDb); // session.authenticated=false → the login gate takes over
  }

  useEffect(() => {
    let active=true;
    fetch("/api/bootstrap",{cache:"no-store"}).then(async (response)=>{const payload=await response.json() as AppDatabase&{error?:string};if(!response.ok)throw new Error(payload.error||"数据加载失败");if(active){setDb(payload);loadOpenCircles();}}).catch((error)=>{if(active){setLoadFailed(true);flash(error instanceof Error?error.message:"暂时无法连接数据服务");}}).finally(()=>{if(active)setLoaded(true);});
    return()=>{active=false;};
  }, []);

  // Another member may approve, confirm, correct, or publish while this tab is
  // in the background. Refresh when the user comes back, without continuous
  // polling that would create unnecessary backend traffic.
  useEffect(() => {
    if (!db.session.authenticated) return;
    let lastSync = 0;
    const syncWhenActive = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastSync < 1200) return;
      lastSync = Date.now();
      refreshRef.current().catch(() => { /* keep the last good screen */ });
    };
    window.addEventListener("focus", syncWhenActive);
    document.addEventListener("visibilitychange", syncWhenActive);
    return () => {
      window.removeEventListener("focus", syncWhenActive);
      document.removeEventListener("visibilitychange", syncWhenActive);
    };
  }, [db.session.authenticated]);

  // After signing in, auto-accept a pending invite carried as ?join=<token>
  // (from the invite landing page's "前往登录" link).
  useEffect(() => {
    if (!db.session.authenticated) return;
    const joinToken = new URLSearchParams(window.location.search).get("join");
    if (!joinToken) return;
    window.history.replaceState({}, "", "/");
    fetch(`/api/invitations/${encodeURIComponent(joinToken)}`, { method: "POST" })
      .then(async (r) => { const d = (await r.json().catch(() => ({}))) as { status?: string; error?: string }; if (r.ok) { await syncAfterWrite(); flash(d.status === "pending" ? "已申请加入，等待管理员确认" : "已加入圈子"); } else { flash(d.error || "加入失败"); } })
      .catch(() => {});
  }, [db.session.authenticated]);

  // A shared profile URL reopens the same profile sheet after the recipient
  // has an authenticated session. Profile data still comes from the normal
  // bootstrap visibility rules; the query parameter is only navigation state.
  useEffect(() => {
    if (!db.session.authenticated || overlay === "profile") return;
    const profileId = new URLSearchParams(window.location.search).get("profile");
    if (!profileId) return;
    const timer = window.setTimeout(() => {
      window.history.replaceState({}, "", "/");
      if (!db.members.some((member) => member.id === profileId)) {
        flash("这个成员档案对你不可见，或链接已经失效");
        return;
      }
      setSelectedMemberId(profileId);
      setProfileTab("cards");
      setOverlay("profile");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [db.members, db.session.authenticated, overlay]);

  const activeCircle = circles.find((item) => item.id === circleId) ?? circles[0] ?? EMPTY_CIRCLE;
  const activeAccount = accountFor(currentMemberId, activeCircle.id);
  const selectedMember = memberById(selectedMemberId);
  const selectedPost = posts.find((post) => post.id === selectedPostId);
  // Shared dynamic links follow the same rule as profiles: the URL can only
  // navigate to an item already returned by the signed-in user's bootstrap.
  useEffect(() => {
    if (!db.session.authenticated || overlay === "post") return;
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId) return;
    const timer = window.setTimeout(() => {
      window.history.replaceState({}, "", "/");
      const target = posts.find((post) => post.id === postId);
      if (!target) {
        flash("这条动态对你不可见，或已经结束");
        return;
      }
      setSelectedPostId(postId);
      setOverlay("post");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [db, db.session.authenticated, overlay]);
  // The entry can vanish under an open detail sheet (the author pauses a
  // listing, a record is rejected). Drop the overlay rather than leaving it
  // keyed open on nothing.
  useEffect(() => {
    if (overlay !== "post" || selectedPost) return;
    const timer = window.setTimeout(() => setOverlay(null), 0);
    return () => window.clearTimeout(timer);
  }, [overlay, selectedPost]);
  const isCircleOwner = activeCircle.ownerId === currentMemberId && activeCircle.id !== "";
  const feedPosts = useMemo(() => posts.filter((post) => {
    if (feedCircleId !== "all" && !post.circleIds.includes(feedCircleId)) return false;
    if (feedFilter === "all") return true;
    if (feedFilter === "trade") return post.kind === "trade" || post.kind === "mystery";
    return post.kind === feedFilter;
  }), [db, feedFilter, feedCircleId]);
  const discoverPosts = useMemo(() => posts.filter((post) => {
    if (post.kind !== "need" && post.kind !== "offer") return false;
    if (discoverFilter === "all" || discoverFilter === "circles") return true;
    return post.kind === discoverFilter;
  }), [db, discoverFilter]);

  const toastTimer = useRef(0);
  function flash(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }

  // Auth gate: wait for the first bootstrap, then require a loop-backend session.
  if (!loaded) return <main className="world-shell login-splash"><p>正在连接流动圈…</p></main>;
  if (!db.session.authenticated) {
    if (loadFailed) return <main className="world-shell login-splash"><div><p>连不上流动圈的数据服务。你没有被登出，稍后再试一次就好。</p><button className="primary-button" onClick={() => { setLoaded(false); refreshData().catch(() => {}).finally(() => setLoaded(true)); }}>重试</button></div></main>;
    return <LoginGate onDone={async () => { setLoaded(false); try { await refreshData(); } finally { setLoaded(true); } }}/>;
  }

  function openComposer(nextIntent: ComposerType = "record") {
    setIntent(nextIntent); setComposer(true);
  }

  function selectCircle(id: string, nextView: View = "feed") {
    setCircleId(id); setFeedCircleId(id); setView(nextView);
  }

  function showAllCircles() {
    setFeedCircleId("all"); setView("feed");
  }

  function openCreateCircle() {
    // Bumping the key remounts the wizard, so reopening it after a successful
    // creation starts a blank form instead of the previous success screen.
    setCreateSession((n) => n + 1);
    setView("create");
  }

  function openSubSheet(next: Overlay) {
    setOverlayReturn(overlay);
    setOverlay(next);
  }

  function closeOverlay() {
    setOverlay(overlayReturn);
    setOverlayReturn(null);
  }

  function openProfile(id?: string, tab: ProfileTab = "cards") {
    if (!id) return;
    setSelectedMemberId(id); setProfileTab(tab); setOverlay("profile");
  }

  function openPost(id: string) {
    setSelectedPostId(id); setOverlay("post");
  }

  function openPostShare(id: string) {
    setSelectedPostId(id); setOverlay("postShare");
  }

  function openNotification(destination: NotificationDestination, targetCircleId?: string) {
    if (targetCircleId && circles.some((circle) => circle.id === targetCircleId)) {
      setCircleId(targetCircleId);
      setFeedCircleId(targetCircleId);
    }
    if (destination === "members") { setView("circle"); setOverlay("members"); return; }
    if (destination === "circle") { setView("circle"); setOverlay(null); return; }
    setSelectedMemberId(currentMemberId);
    setProfileTab(destination === "cards" ? "cards" : "transactions");
    setOverlay("profile");
  }

  async function submitCompose(input: ComposeInput) {
    const response = await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "保存失败");
    // Close first: the entry is already saved, and leaving the draft up with a
    // live 确认发布 button is exactly how you get two identical ledger entries.
    setComposer(false);
    await syncAfterWrite();
    flash(input.intent === "record" ? "记录已进入圈子，对方可以修改或拒绝" : input.intent === "card" ? "好人卡已送到对方的跨圈主页" : "已经发布，可以生成分享图啦");
  }

  if (circles.length === 0 && view !== "create") {
    return <AccountStartView member={memberById(currentMemberId)} openCircles={openCircles} pendingCircles={db.pendingCircles} onSaved={syncAfterWrite} onJoin={joinCircle} onWithdraw={withdrawRequest} onCreate={openCreateCircle} onLogout={logout}/>;
  }

  return <main className="world-shell">
    <aside className="circle-dock" aria-label="我的圈子地图">
      <button className={`brand-mark ${view === "about" ? "active" : ""}`} onClick={() => setView("about")} aria-label="了解流动圈"><BrandGlyph large/><span className="brand-copy"><strong>流动圈</strong><b>FLOW CIRCLE · 了解我们 →</b></span></button>
      <div className="dock-heading"><span>我的地图</span><b>{String(circles.length).padStart(2,"0")}</b></div>
      <button className={`dock-all ${feedCircleId === "all" && view === "feed" ? "active" : ""}`} onClick={showAllCircles}><NavIcon kind="feed"/><b>全部圈子动态</b><strong>{posts.length}</strong></button>
      <div className="dock-list">{circles.filter((item) => memberById(currentMemberId).circleIds.includes(item.id)).map((item) => { const account = accountFor(currentMemberId, item.id); return <button key={item.id} className={`dock-circle dock-${item.color} ${feedCircleId === item.id ? "active" : ""}`} onClick={() => selectCircle(item.id)}><CircleGlyph icon={item.short} seed={item.id} size="small"/><span><b>{item.name}</b><small>{item.currency}</small></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div>
      <button className="new-circle" onClick={openCreateCircle}><b>＋</b><span>创建新圈子</span></button>
    </aside>

    <section className="phone-stage">
      <div className={`app-frame ${view === "about" || view === "create" ? "about-open" : ""}`}>
        <header className="topbar"><button className={`brand-mini ${view === "about" ? "active" : ""}`} onClick={() => setView("about")} aria-label="了解流动圈"><BrandGlyph/></button><div><p>{view === "about" ? "FLOW CIRCLE · 产品概念" : view === "create" ? "NEW CIRCLE · 创建向导" : "我的圈子动态"}</p><h1>{view === "about" ? "关于流动圈" : view === "create" ? "创建新圈子" : `你好，${memberById(currentMemberId).name}！`}</h1></div><button className="bell-button" onClick={() => { setOverlay("notifications"); if (db.unreadNotifications > 0) markNotificationsRead(); }} aria-label={`通知${db.unreadNotifications > 0 ? `，${db.unreadNotifications} 条未读` : ""}`}><NotificationIcon/>{db.unreadNotifications > 0 && <i>{db.unreadNotifications > 9 ? "9+" : db.unreadNotifications}</i>}</button><button className="avatar-button" onClick={() => setView("me")} aria-label="打开我的主页"><Character member={memberById(currentMemberId)}/></button></header>
        {view !== "about" && view !== "create" && <nav className="circle-switcher" aria-label="切换动态范围"><button className={`all-switch ${feedCircleId === "all" && view === "feed" ? "selected" : ""}`} onClick={showAllCircles}><NavIcon kind="feed"/><span>全部圈子</span><b>{posts.length}</b></button>{circles.filter((item) => memberById(currentMemberId).circleIds.includes(item.id)).map((item) => { const account = accountFor(currentMemberId, item.id); return <button key={item.id} className={feedCircleId === item.id ? "selected" : ""} onClick={() => selectCircle(item.id)}><CircleGlyph icon={item.short} seed={item.id} size="tiny"/><span>{item.name}</span><b>{account.balance > 0 ? "+" : ""}{account.balance}</b></button>; })}</nav>}
        <div className="view-content">
          {view === "about" && <AboutView onExplore={showAllCircles} onCreate={openCreateCircle} onCircle={(id) => selectCircle(id, "circle")}/>}
          {view === "create" && <CreateCircleView key={createSession} onExit={() => setView("me")} onDone={async (input) => {
            const response=await fetch("/api/circles",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)}); const result=await response.json() as {error?:string};
            if(!response.ok) throw new Error(result.error||"创建失败");
            // The circle exists from here on. A failed refetch must not surface
            // as a failed creation, or the user retries and makes a duplicate.
            await syncAfterWrite();
            flash(`${input.name}已经创建，可以邀请成员了`);
          }}/>} 
          {view === "feed" && <FeedView activeCircle={activeCircle} activeAccount={activeAccount} isAllCircles={feedCircleId === "all"} posts={feedPosts} filter={feedFilter} onCompose={() => openComposer()} onCircle={() => setView("circle")} onMe={() => setView("me")} onProfile={openProfile} onShare={openPostShare} onFilter={() => setOverlay("feedFilter")} onPost={openPost}/>}
          {view === "discover" && <DiscoverView posts={discoverPosts} filter={discoverFilter} setFilter={setDiscoverFilter} openCircles={openCircles} onJoin={joinCircle} onSpeak={openComposer} onProfile={openProfile} onShare={openPostShare} onPost={openPost}/>}
          {view === "circle" && <CircleView circle={activeCircle} account={activeAccount} posts={posts.filter((post) => post.circleIds.includes(activeCircle.id))} isOwner={isCircleOwner} pendingCount={db.joinRequests.filter((r) => r.circleId === activeCircle.id).length} onSpeak={openComposer} onProfile={openProfile} onShare={openPostShare} onPost={openPost} onRules={() => setOverlay("rules")} onMembers={() => setOverlay("members")} onInvite={() => setOverlay("invite")} onSettings={() => setOverlay("circleSettings")}/>}
          {view === "me" && <MeView onShare={() => setOverlay("share")} onCard={() => openComposer("card")} onCreate={openCreateCircle} onSettings={() => setOverlay("settings")} onEditProfile={() => setOverlay("editProfile")} onCircle={(id) => selectCircle(id, "circle")} onArchive={(tab) => openProfile(currentMemberId, tab)} onLogout={logout}/>}
        </div>
        <nav className="bottom-nav" aria-label="主要导航">
          <button className={view === "feed" ? "active" : ""} onClick={() => setView("feed")}><NavIcon kind="feed"/><small>动态</small></button>
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><NavIcon kind="discover"/><small>发现</small></button>
          <button className="compose-slot" onClick={() => openComposer()} aria-label="记一笔"><NavIcon kind="record"/><small>记一笔</small></button>
          <button className={view === "circle" ? "active" : ""} onClick={() => setView("circle")}><NavIcon kind="circle"/><small>圈子</small></button>
          <button className={view === "me" ? "active" : ""} onClick={() => setView("me")}><NavIcon kind="me"/><small>我的</small></button>
        </nav>
      </div>
    </section>

    <aside className="world-panel">
      <div className="world-card world-card-main"><span className="world-kicker">TODAY IN YOUR CIRCLES</span><h2>今天，圈里有<br/><em>{posts.length} 件事</em>在流动</h2><div className="world-stats"><span><b>{posts.filter((post) => post.kind === "need" || post.kind === "offer").length}</b>需要 / 提供</span><span><b>{posts.filter((post) => post.kind === "trade" || post.kind === "mystery").length}</b>互助完成</span><span><b>{posts.filter((post) => post.kind === "card").length}</b>张好人卡</span></div></div>
      <button className="world-card value-card value-card-button" onClick={() => { setView("circle"); setOverlay("rules"); }}><span className="world-kicker">协商参考</span><h3>{activeCircle.name}</h3>{activeCircle.settings.references.slice(0,2).map((item) => <div key={item.name}><b>{item.name}</b><span>{item.value}</span></div>)}<p>查看规则 →</p></button>
      <div className="world-rule"><b>可以问，<br/>也可以拒绝。</b><span>NO PRESSURE · NO RANKING</span></div>
    </aside>

    {composer && <ComposerSheet circleId={activeCircle.id} intent={intent} setIntent={setIntent} onClose={() => setComposer(false)} onSubmit={submitCompose} onNotice={flash}/>} 
    {overlay === "share" && <ShareSheet shareUrl={typeof window === "undefined" ? "" : `${window.location.origin}/?profile=${encodeURIComponent(currentMemberId)}`} onClose={closeOverlay} onNotice={flash} onCopy={async () => {
      const shareUrl=`${location.origin}/?profile=${encodeURIComponent(currentMemberId)}`;
      try { await navigator.clipboard.writeText(shareUrl); flash(isLocalUrl(shareUrl) ? "已复制本地测试链接，只能在这台电脑打开" : "个人档案链接已复制，可以发到微信群"); }
      catch { flash("复制失败，请手动选择链接"); }
    }} onDone={async () => {
      const me=memberById(currentMemberId); const canShare=typeof navigator.share==="function"; const shareUrl=`${location.origin}/?profile=${encodeURIComponent(currentMemberId)}`;
      try{
        if(isLocalUrl(shareUrl)) { await navigator.clipboard.writeText(shareUrl); flash("已复制本地测试链接，只能在这台电脑打开"); return; }
        if(canShare) await navigator.share({title:`${me.name}的个人档案`,text:"可以问，也可以拒绝。",url:shareUrl}); else await navigator.clipboard.writeText(shareUrl);
      }catch{ return; }
      setOverlay(null); flash(canShare?"已经交给系统分享":"个人档案链接已复制，可以发到微信群");
    }}/>} 
    {overlay === "postShare" && selectedPost && <PostShareSheet post={selectedPost} shareUrl={typeof window === "undefined" ? "" : `${window.location.origin}/?post=${encodeURIComponent(selectedPost.id)}`} onClose={() => setOverlay(null)} onNotice={flash}/>}
    {overlay === "profile" && selectedMember && <ProfileSheet member={selectedMember} activeCircleId={activeCircle.id} initialTab={profileTab} onClose={() => setOverlay(null)} onNotice={flash} onChanged={syncAfterWrite}/>} 
    {overlay === "rules" && <RulesSheet circle={activeCircle} onClose={() => setOverlay(null)}/>}
    {overlay === "members" && <MembersSheet circle={activeCircle} requests={db.joinRequests.filter((r) => r.circleId === activeCircle.id)} isOwner={isCircleOwner} onProfile={openProfile} onInvite={() => openSubSheet("invite")} onClose={closeOverlay} onResolve={resolveRequest} onLeave={leaveCircle} onTransfer={transferOwner}/>}
    {overlay === "invite" && <InviteSheet circle={activeCircle} onClose={closeOverlay} onNotice={flash}/>}
    {overlay === "feedFilter" && <FeedFilterSheet active={feedFilter} onSelect={(next) => { setFeedFilter(next); setOverlay(null); }} onClose={() => setOverlay(null)}/>}
    {overlay === "post" && selectedPost && <PostSheet post={selectedPost} onProfile={() => selectedPost.memberId && openProfile(selectedPost.memberId)} onShare={() => openPostShare(selectedPost.id)} onClose={() => setOverlay(null)}/>}
    {overlay === "notifications" && <NotificationsSheet notifications={db.notifications} onClose={() => setOverlay(null)} onOpen={openNotification}/>}
    {overlay === "settings" && <SettingsSheet settings={db.settings} onClose={() => setOverlay(null)} onSaved={async () => { await syncAfterWrite(); flash("公开设置已经保存"); }}/>} 
    {overlay === "circleSettings" && <CircleSettingsSheet circle={activeCircle} onClose={() => setOverlay(null)} onSaved={syncAfterWrite} onNotice={flash}/>}
    {overlay === "editProfile" && <EditProfileSheet member={memberById(currentMemberId)} onClose={() => setOverlay(null)} onSaved={syncAfterWrite} onNotice={flash}/>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}

// Shown while the signed-in user belongs to no circle yet: fill in the profile,
// then either create a circle or join an open one.
function AccountStartView({ member, openCircles, pendingCircles, onSaved, onJoin, onWithdraw, onCreate, onLogout }: { member: Member; openCircles: DiscoverableCircle[]; pendingCircles: DiscoverableCircle[]; onSaved: () => Promise<void>; onJoin: (circle: DiscoverableCircle) => Promise<void>; onWithdraw: (circle: DiscoverableCircle) => Promise<void>; onCreate: () => void; onLogout: () => void }) {
  const [name,setName]=useState(member.name);
  const [bio,setBio]=useState(member.bio);
  const [wechat,setWechat]=useState(member.wechat);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);
  const joinable = openCircles.filter((circle) => !circle.pending);
  // Any edit makes the ✓ a lie, so drop it as soon as a field changes.
  const edit = <T,>(set: (v: T) => void) => (v: T) => { setSaved(false); set(v); };

  async function saveProfile() {
    try {
      if (!name.trim()) { setError("请先填写怎么称呼你"); return; }
      setSaving(true); setError("");
      const response=await fetch("/api/profile",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({name:name.trim(),bio:bio.trim(),wechat:wechat.trim()})});
      const result=await response.json() as {error?:string};
      if(!response.ok) throw new Error(result.error||"保存失败");
      setSaved(true);
      await onSaved();
    } catch(error) {
      setError(error instanceof Error?error.message:"保存失败");
    } finally {
      setSaving(false);
    }
  }

  return <main className="account-start"><section className="account-card">
    <div className="account-brand"><BrandGlyph/><b>FLOW CIRCLE</b></div>
    <Pill color="green">{member.handle}</Pill>
    <h1>先完善档案，<br/>再找到你的圈子。</h1>
    <p>这里只记录你愿意公开的社区身份。真实协商仍然发生在微信或线下。</p>
    <div className="account-form">
      <label><span>怎么称呼你</span><input value={name} maxLength={40} onChange={(event)=>edit(setName)(event.target.value)} placeholder="昵称"/></label>
      <label><span>一句话介绍（可稍后填写）</span><input value={bio} maxLength={80} onChange={(event)=>edit(setBio)(event.target.value)} placeholder="例如：喜欢把坏掉的东西拆开"/></label>
      <label><span>联系方式 / 微信号（可稍后填写）</span><input value={wechat} maxLength={60} onChange={(event)=>edit(setWechat)(event.target.value)} placeholder="只对同圈成员显示"/></label>
    </div>
    {error&&<p className="account-error">{error}</p>}
    <button className="primary-button" disabled={saving} onClick={saveProfile}>{saving?"正在保存…":saved?"已保存 ✓":"保存档案"}</button>
    <div className="account-next"><button className="secondary-button" onClick={onCreate}>创建第一个圈子</button></div>
    {pendingCircles.length > 0 && <div className="open-circle-list pending-list">
      <b>正在等待放行</b>
      {pendingCircles.map((circle) => <button key={circle.id} className="awaiting" onClick={() => onWithdraw(circle)}><CircleGlyph icon={circle.short} seed={circle.id} size="small"/><span><b>{circle.name}</b><small>已提交申请，等圈主确认</small></span><strong>撤回申请</strong></button>)}
    </div>}
    {joinable.length > 0 && <div className="open-circle-list">
      <b>或者加入一个已经开放的圈子</b>
      {joinable.map((circle) => <button key={circle.id} onClick={() => onJoin(circle)}><CircleGlyph icon={circle.short} seed={circle.id} size="small"/><span><b>{circle.name}</b><small>{circle.currency} · {circle.members} 人 · {circle.joining === "approval" ? "需审批" : "可直接加入"}</small></span><strong>加入 →</strong></button>)}
    </div>}
    {pendingCircles.length > 0
      ? <div className="account-boundary"><b>申请已经送到了。</b><span>圈主放行之后，这里才会出现对应的成员、余额和互助记录。你也可以随时撤回。</span></div>
      : <div className="account-boundary"><b>还没有圈子</b><span>加入或创建一个圈子。</span></div>}
    <button className="account-signout" onClick={onLogout}>退出登录，换一个账号</button>
  </section></main>;
}

function AboutView({ onExplore, onCreate, onCircle }: { onExplore: () => void; onCreate: () => void; onCircle: (id: string) => void }) {
  const concepts = [
    { number: "01", title: "圈子", color: "pink", text: "独立的成员、规则和互助额度。" },
    { number: "02", title: "互助额度", color: "yellow", text: "记录已经完成的互助。" },
    { number: "03", title: "需要 / 提供", color: "green", text: "发布正在寻找或可以给出的事。" },
    { number: "04", title: "好人卡", color: "blue", text: "留下一段感谢。" },
  ];
  const steps = [
    ["先发生", "在微信或线下协商。"],
    ["记一笔", "填写并查看草稿。"],
    ["发布", "记录进入对应圈子。"],
  ];
  return <div className="about-page">
    <section className="about-hero">
      <div className="about-orbit orbit-one"/><div className="about-orbit orbit-two"/><div className="about-grid-mark"/>
      <Pill color="cream">FLOW CIRCLE · 流动圈</Pill>
      <h2>让帮助被记得，<br/>但不让数字定义关系。</h2>
      <p>记录互助、需要、提供和感谢。</p>
      <div className="about-actions"><button className="about-primary" onClick={onExplore}>看看圈里正在发生什么 →</button><button onClick={onCreate}>＋ 创建一个圈子</button></div>
    </section>

    <section className="about-section">
      <SectionTitle eyebrow="FOUR DIFFERENT THINGS" title="四件事，各自有边界"/>
      <div className="concept-grid">{concepts.map((item) => <article key={item.number} className={`concept-card concept-${item.color}`}><span>{item.number}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>

    <section className="about-section flow-section">
      <SectionTitle eyebrow="HOW IT FLOWS" title="一次互助，怎么流动"/>
      <div className="flow-steps">{steps.map(([title, text], index) => <article key={title}><b>{String(index + 1).padStart(2,"0")}</b><div><h3>{title}</h3><p>{text}</p></div>{index < steps.length - 1 && <span aria-hidden="true">↓</span>}</article>)}</div>
    </section>

    <section className="about-section">
      <SectionTitle eyebrow="THREE REAL CONTEXTS" title="同一个工具，长在不同关系里"/>
      <div className="about-circles">{circles.map((circle, index) => <button key={circle.id} className={`about-circle about-circle-${circle.color}`} onClick={() => onCircle(circle.id)}><span className="about-circle-number">0{index + 1}</span><CircleGlyph icon={circle.short} seed={circle.id} size="small"/><div><small>{circle.currency}</small><h3>{circle.name}</h3><p>{circle.tagline}</p></div><b>进入圈子 →</b></button>)}</div>
    </section>

    <section className="about-boundaries">
      <div><span>KEEP IT HUMAN</span><h2>有些事，流动圈明确不做。</h2></div>
      <ul><li>不与人民币兑换</li><li>不做贡献排名</li><li>可以不记录</li><li>可以拒绝、暂停或离开</li></ul>
    </section>

    <blockquote className="about-manifesto"><span>“</span><p>数字是影子，关系是实体。<br/>没有记录的善意，仍然成立。</p><b>流动圈 · FLOW CIRCLE</b></blockquote>
  </div>;
}

function ComposeHero({ onCompose }: { onCompose: () => void }) {
  return <section className="agent-hero"><div className="hero-decor decor-grid"/><div className="hero-decor decor-circle"/><button className="agent-orb" onClick={onCompose} aria-label="记一笔"><i className="agent-antenna"/><span>＋</span><b>记一笔</b></button><div className="agent-copy"><Pill color="cream">FLOW · 社区记忆</Pill><h2>今天，想记下什么？</h2></div></section>;
}

function FeedView({ activeCircle, activeAccount, isAllCircles, posts: list, filter, onCompose, onCircle, onMe, onProfile, onShare, onFilter, onPost }: { activeCircle: Circle; activeAccount: ReturnType<typeof accountFor>; isAllCircles: boolean; posts: Post[]; filter: FeedFilter; onCompose: () => void; onCircle: () => void; onMe: () => void; onProfile: (id?: string) => void; onShare: (id: string) => void; onFilter: () => void; onPost: (id: string) => void }) {
  const labels: Record<FeedFilter,string> = { all: "全部动态", trade: "互助记录", need: "只看需要", offer: "只看提供", card: "好人卡" };
  const myCards = activeDb.goodCards.filter((card) => card.toMemberId === activeDb.currentMemberId && card.visibility === "cross-circle").length;
  const totalGiven = activeDb.accounts.filter((account) => account.memberId === activeDb.currentMemberId).reduce((sum, account) => sum + account.given, 0);
  const scopeTitle = isAllCircles ? "全部圈子" : activeCircle.name;
  return <><ComposeHero onCompose={onCompose}/><section className="scope-banner"><span>{isAllCircles ? "综合动态" : "当前圈子"}</span><b>{scopeTitle}</b><small>{list.length} 条</small></section><section className="stats-grid" aria-label="当前动态范围概览"><button className="stat-card stat-yellow" onClick={isAllCircles ? onMe : onCircle}><span>{isAllCircles ? "圈子" : "当前额度"}</span><strong>{isAllCircles ? memberById(activeDb.currentMemberId).circleIds.length : `${activeAccount.balance > 0 ? "+" : ""}${activeAccount.balance}`}</strong></button><button className="stat-card stat-pink" onClick={onMe}><span>我给出过</span><strong>{isAllCircles ? totalGiven : activeAccount.given}</strong></button><button className="stat-card stat-blue" onClick={() => onProfile(activeDb.currentMemberId)}><span>好人卡</span><strong>{myCards}</strong></button></section><SectionTitle eyebrow="LIVE FROM THE CIRCLE" title={`${scopeTitle} · ${labels[filter]}`} action={`筛选 · ${list.length}`} onAction={onFilter}/><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>;
}

function DiscoverView({ posts: list, filter, setFilter, openCircles, onJoin, onSpeak, onProfile, onShare, onPost }: { posts: Post[]; filter: DiscoverFilter; setFilter: (filter: DiscoverFilter) => void; openCircles: DiscoverableCircle[]; onJoin: (circle: DiscoverableCircle) => Promise<void>; onSpeak: (intent?: ComposerType) => void; onProfile: (id?: string) => void; onShare: (id: string) => void; onPost: (id: string) => void }) {
  const options: {id: DiscoverFilter; label: string}[] = [{id:"all",label:"全部"},{id:"need",label:"我想要"},{id:"offer",label:"我可以给"},{id:"circles",label:`可加入的圈子 ${openCircles.length}`}];
  return <><section className="page-hero discover-hero"><div><Pill color="pink">跨圈发现</Pill><h2>有人在找，<br/>也有人可以给。</h2></div><button onClick={() => onSpeak("need")}>＋ 发布</button></section>
    <div className="filter-row" aria-label="发现筛选">{options.map((item) => <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
    {filter === "circles"
      ? (openCircles.length === 0
          ? <p className="result-note">目前没有可以直接加入的圈子。圈子大多靠熟人邀请——找一个认识的人要一条邀请链接。</p>
          : <><p className="result-note">{openCircles.length} 个你还没加入的圈子</p><div className="open-circle-list">{openCircles.map((circle) => <button key={circle.id} className={circle.pending ? "awaiting" : ""} onClick={() => onJoin(circle)}><CircleGlyph icon={circle.short} seed={circle.id} size="small"/><span><b>{circle.name}</b><small>{circle.pending ? "已申请，等圈主放行" : circle.tagline || `${circle.currency} · ${circle.members} 人`}</small></span><strong>{circle.pending ? "撤回申请" : circle.joining === "approval" ? "申请 →" : "加入 →"}</strong></button>)}</div></>)
      : <><p className="result-note">找到 {list.length} 条仍然有效的内容</p><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>}</>;
}

function CircleView({ circle, account, posts: circlePosts, isOwner, pendingCount, onSpeak, onProfile, onShare, onPost, onRules, onMembers, onInvite, onSettings }: { circle: Circle; account: ReturnType<typeof accountFor>; posts: Post[]; isOwner: boolean; pendingCount: number; onSpeak: (intent?: ComposerType) => void; onProfile: (id?: string) => void; onShare: (id: string) => void; onPost: (id: string) => void; onRules: () => void; onMembers: () => void; onInvite: () => void; onSettings: () => void }) {
  const { references } = circle.settings;
  return <><section className={`page-hero circle-hero hero-${circle.color}`}><div><Pill color="cream">我的营地 · {circle.currency}</Pill><h2>{circle.name}</h2><p>{circle.tagline}</p></div><div className="coin-badge"><span>{account.balance > 0 ? "+" : ""}{account.balance}</span><small>{circle.currency}</small></div></section>
    <div className="circle-actions"><button onClick={() => onSpeak()}>＋ 记一笔</button><button onClick={onInvite}>邀请成员</button><button onClick={onRules}>圈子介绍</button>{isOwner && <button onClick={onSettings}>圈子设置</button>}</div>
    <button className="camp-preview" onClick={onRules}><CircleGlyph icon={circle.short} seed={circle.id} size="regular"/><div><small>CAMP PROFILE</small><h3>{circle.tagline || "还没有写圈子介绍"}</h3><p>{circle.joining === "approval" ? "加入需管理员审批" : "受邀可直接加入"} · {circle.members} 位成员</p></div><b>进入介绍 →</b></button>
    <section className="balance-panel"><div><span>当前额度</span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong><small>我在这个圈的流动额度</small></div><div><span>给出过</span><strong>{account.given}</strong><small>来自真实互助</small></div><div><span>收到过</span><strong>{account.received}</strong><small>接受帮助也很好</small></div></section>
    <SectionTitle eyebrow="REFERENCE" title="圈内参考物" action={isOwner ? "编辑" : "查看规则"} onAction={isOwner ? onSettings : onRules}/>
    {references.length > 0
      ? <div className="reference-grid">{references.map((item) => <button key={item.name} onClick={onRules}><b>{item.name}</b><span>{item.value}</span></button>)}</div>
      : <p className="soft-note">{isOwner ? "还没有协商参考。去圈子设置添加。" : "还没有协商参考。"}</p>}
    <SectionTitle eyebrow="PEOPLE" title="最近活跃的成员" action={pendingCount > 0 ? `全部成员 · ${pendingCount} 待审` : "全部成员"} onAction={onMembers}/>
    {pendingCount > 0 && <button className="pending-banner" onClick={onMembers}><b>{pendingCount} 个人在等你放行</b><span>他们通过邀请或发现页申请加入，通过后才算正式成员。</span><strong>去处理 →</strong></button>}
    <div className="member-row">{circle.memberIds.slice(0,4).map((id) => memberById(id)).filter(Boolean).map((member) => <button key={member.id} onClick={() => onProfile(member.id)}><Character member={member} small/><b>{member.name}</b><small>{member.handle}</small></button>)}</div>
    <div className="circle-feed"><SectionTitle eyebrow={`${circlePosts.length} EVENTS IN THIS CIRCLE`} title={`${circle.name}动态`}/><FeedList posts={circlePosts} onProfile={onProfile} onShare={onShare} onPost={onPost}/></div></>;
}

function MeView({ onShare, onCard, onCreate, onSettings, onEditProfile, onCircle, onArchive, onLogout }: { onShare: () => void; onCard: () => void; onCreate: () => void; onSettings: () => void; onEditProfile: () => void; onCircle: (id: string) => void; onArchive: (tab: ProfileTab) => void; onLogout: () => void }) {
  const me = memberById(activeDb.currentMemberId);
  const myListings = activeDb.listings.filter((item) => item.memberId === me.id);
  const activeNeed = myListings.find((item) => item.type === "need" && item.status === "active");
  const activeOffer = myListings.find((item) => item.type === "offer" && item.status === "active");
  const cardCount = activeDb.goodCards.filter((card) => card.toMemberId === me.id && card.visibility === "cross-circle").length;
  const transactionCount = activeDb.transactions.filter((item) => item.providerId === me.id || item.receiverId === me.id).length;
  return <><section className="profile-hero"><Character member={me}/><div><Pill color="cream">{me.handle}</Pill><h2>{me.name}</h2><p>{me.bio || "还没有写介绍"}</p></div><button onClick={onEditProfile}>编辑资料</button></section><section className="passport-card"><div><span>COMMUNITY PASSPORT</span><h3>{cardCount} 张好人卡</h3><p>“{activeDb.goodCards.find((card) => card.toMemberId === me.id)?.story ?? "还没有好人卡。"}”</p></div><button onClick={onCard}>＋ 发好人卡</button></section><SectionTitle eyebrow="FULL ARCHIVE" title="我的档案"/><div className="archive-grid"><button onClick={() => onArchive("cards")}><strong>{cardCount}</strong><span>好人卡</span></button><button onClick={() => onArchive("listings")}><strong>{myListings.length}</strong><span>需要 / 提供</span></button><button onClick={() => onArchive("transactions")}><strong>{transactionCount}</strong><span>互助记录</span></button></div><SectionTitle eyebrow="OPEN NOW" title="现在的需要 / 提供" action="公开设置" onAction={onSettings}/><div className="my-board"><button className="my-need" onClick={() => onArchive("listings")}><Pill color="pink">我想要</Pill><h3>{activeNeed?.title ?? "还没有发布"}</h3>{activeNeed && <span>{activeNeed.visibility === "cross-circle" ? "跨圈公开" : "圈内可见"}</span>}</button><button className="my-offer" onClick={() => onArchive("listings")}><Pill color="green">我可以给</Pill><h3>{activeOffer?.title ?? "还没有发布"}</h3>{activeOffer && <span>{activeOffer.circleIds.length} 个圈可见</span>}</button></div><SectionTitle eyebrow="MY CIRCLES" title="我的圈子" action="创建新圈" onAction={onCreate}/><div className="my-circles">{circles.filter((circle) => me.circleIds.includes(circle.id)).map((circle) => { const account = accountFor(me.id, circle.id); return <button className="my-circle" key={circle.id} onClick={() => onCircle(circle.id)}><CircleGlyph icon={circle.short} seed={circle.id} size="small"/><span><b>{circle.name}</b><small>{circle.currency} · {circle.members} 人</small></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div><div className="me-actions"><button className="secondary-button" onClick={onShare}>分享档案</button><button className="text-link" onClick={onLogout}>退出登录</button></div></>;
}

function FeedList({ posts: list, onProfile, onShare, onPost }: { posts: Post[]; onProfile: (id?: string) => void; onShare: (id: string) => void; onPost: (id: string) => void }) {
  if (list.length === 0) return <div className="feed-empty"><b>暂时没有动态</b></div>;
  return <div className="feed-list">{list.map((post) => <article key={post.id} className={`feed-card feed-${post.kind}`}><header><button className="feed-person" onClick={() => post.memberId ? onProfile(post.memberId) : onPost(post.id)}><Character member={post.memberId ? memberById(post.memberId) : undefined} text={post.memberId ? undefined : post.avatar} color={post.color} variant={post.avatarVariant} small/><span><b>{post.person}</b><small>{post.caption}</small></span></button><Pill color={post.color}>{post.badge}</Pill></header><button className="feed-open" onClick={() => onPost(post.id)}><span className="feed-text">{post.text}</span><span className="chip-row">{post.chips.map((chip) => <i key={chip}>#{chip}</i>)}</span></button><footer><span>{post.meta}</span><span><button onClick={() => onPost(post.id)}>详情</button><button onClick={() => onShare(post.id)}>分享 ↗</button></span></footer></article>)}</div>;
}

function Modal({ children, onClose, label, wide = false }: { children: React.ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const closeTopDialog = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
      if (dialogs.at(-1) !== dialogRef.current) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", closeTopDialog);
    return () => document.removeEventListener("keydown", closeTopDialog);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><section ref={dialogRef} className={`sheet ${wide ? "sheet-wide" : ""}`} role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()}><button className="close-button" onClick={onClose} aria-label="关闭">×</button>{children}</section></div>;
}

// The composer. Four intents, each a plain form: pick who/which circle, fill in
// the fields loop-backend stores, review the draft, publish. (The natural-
// language "泡泡助手" path is not wired up — see docs; nothing here calls an LLM.)
function ComposerSheet({ circleId, intent, setIntent, onClose, onSubmit, onNotice }: { circleId: string; intent: ComposerType; setIntent: (intent: ComposerType) => void; onClose: () => void; onSubmit: (input: ComposeInput) => Promise<void>; onNotice: (message: string) => void }) {
  const [review, setReview] = useState<{ input: ComposeInput; title: string; detail: string; footer: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // record / card
  const [otherId, setOtherId] = useState("");
  const [direction, setDirection] = useState<"received" | "given">("received");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [story, setStory] = useState("");
  const [recordVisibility, setRecordVisibility] = useState<"public" | "mystery" | "private">("public");
  const [cardVisibility, setCardVisibility] = useState<"cross-circle" | "hidden">("cross-circle");

  // need / offer
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [reference, setReference] = useState("");
  const [listingCircleIds, setListingCircleIds] = useState<string[]>(circleId ? [circleId] : []);
  const [crossCircle, setCrossCircle] = useState(false);

  const myCircles = circles.filter((item) => memberById(activeDb.currentMemberId)?.circleIds.includes(item.id));
  // `circleId` is whatever tab is open, which is `circles[0]` before the user
  // has picked one — so track the target explicitly and show it in the form.
  const [recordCircleId, setRecordCircleId] = useState(circleId || myCircles[0]?.id || "");
  const circle = circleById(recordCircleId) ?? EMPTY_CIRCLE;
  const others = circle.memberIds.map((mid) => memberById(mid)).filter((m) => m && m.id !== activeDb.currentMemberId);
  const isLedger = intent === "record";
  const isCard = intent === "card";
  const isListing = intent === "need" || intent === "offer";

  function toggleListingCircle(id: string) {
    setListingCircleIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  // Build the draft the review step shows, and the payload it will POST.
  function buildDraft() {
    if (isLedger || isCard) {
      const other = others.find((m) => m.id === otherId);
      if (!other) { onNotice("先选择一位成员"); return; }
      const me = activeDb.currentMemberId;

      if (isLedger) {
        const amt = Number(amount);
        if (!Number.isInteger(amt) || amt <= 0) { onNotice("请填写大于 0 的整数额度"); return; }
        const providerId = direction === "received" ? other.id : me;
        const receiverId = direction === "received" ? me : other.id;
        const heading = note.trim() || (direction === "received" ? `${other.name}帮了我` : `我帮了${other.name}`);
        setReview({
          input: { intent: "record", circleId: circle.id, providerId, receiverId, amount: amt, title: heading, story: story.trim(), visibility: recordVisibility, tags: ["互助"] },
          title: heading,
          detail: story.trim() || heading,
          footer: `${memberById(providerId)?.name} +${amt} · ${memberById(receiverId)?.name} −${amt} （${circle.currency}）`,
        });
        return;
      }

      const text = story.trim();
      if (!text) { onNotice("好人卡必须写清楚发生了什么"); return; }
      setReview({
        input: { intent: "card", circleId: circle.id, toId: other.id, story: text, visibility: cardVisibility },
        title: `给${other.name}一张好人卡`,
        detail: text,
        footer: `${cardVisibility === "cross-circle" ? "跨圈公开" : "仅对方可见"} · 不产生任何余额`,
      });
      return;
    }

    const heading = title.trim();
    if (!heading) { onNotice("写一个标题，比如「泉州的一晚住宿」"); return; }
    if (listingCircleIds.length === 0) { onNotice("至少选择一个圈子"); return; }
    setReview({
      input: { intent, title: heading, detail: detail.trim(), circleIds: listingCircleIds, visibility: crossCircle ? "cross-circle" : "circle", location: location.trim(), time: time.trim(), reference: reference.trim(), tags: [] },
      title: `${intent === "need" ? "我想要" : "我可以给"} · ${heading}`,
      detail: detail.trim() || heading,
      footer: `${listingCircleIds.map((id) => circleById(id)?.name).filter(Boolean).join("、")} · ${crossCircle ? "跨圈公开" : "仅圈内可见"}`,
    });
  }

  async function publish() {
    if (!review) return;
    try { setSaving(true); await onSubmit(review.input); }
    catch (error) { onNotice(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  }

  const accent = intents.find((item) => item.id === intent)?.color ?? "yellow";

  return <Modal onClose={onClose} label="记一笔">
    <div className="sheet-heading"><Pill color={accent}>{review ? "发布确认" : "快速选择"}</Pill><h2>{review ? "发布前确认" : "记什么？"}</h2></div>

    {!review ? <>
      <div className="intent-grid">{intents.map((item) => <button key={item.id} className={`intent intent-${item.color} ${intent === item.id ? "selected" : ""}`} onClick={() => setIntent(item.id)}><b>{item.icon}</b><span><strong>{item.label}</strong></span></button>)}</div>

      {(isLedger || isCard) && (myCircles.length === 0 ? <p className="soft-note">先加入或创建一个圈子，再记录互助。</p> : others.length === 0
        ? <p className="soft-note">「{circle.name}」还没有其他成员。先到圈子页「邀请成员」，对方加入后就可以互相记录了。</p>
        : <div className="manual-form">
            {myCircles.length > 1 && <label><span>记在哪个圈子</span><select value={recordCircleId} onChange={(e) => { setRecordCircleId(e.target.value); setOtherId(""); }}>{myCircles.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.currency}）</option>)}</select></label>}
            <label><span>{isLedger ? "和谁的互助" : "把好人卡送给谁"}</span><select value={otherId} onChange={(e) => setOtherId(e.target.value)}><option value="">选择一位成员</option>{others.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>

            {isLedger && <>
              <div className="manual-choice"><button className={direction === "received" ? "active" : ""} onClick={() => setDirection("received")}>对方帮了我</button><button className={direction === "given" ? "active" : ""} onClick={() => setDirection("given")}>我帮了对方</button></div>
              <label><span>额度（{circle.currency}）</span><input type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例如 5"/></label>
              <label><span>一句话标题</span><input value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} placeholder="例如：厦门借住一晚"/></label>
              <label><span>发生了什么（可选）</span><textarea value={story} rows={2} onChange={(e) => setStory(e.target.value)} placeholder="聊到半夜，第二天一起吃了早饭"/></label>
              <label><span>让谁看见</span><select value={recordVisibility} onChange={(e) => setRecordVisibility(e.target.value as typeof recordVisibility)}><option value="public">圈内公开</option><option value="mystery">神秘记录（隐藏双方与故事）</option><option value="private">仅当事人</option></select></label>
              {!circle.settings.allowNegativeBalance && <p className="soft-note">这个圈子没有开启「允许负余额」，接收方的额度不能记成负数。</p>}
            </>}

            {isCard && <>
              <label><span>发生了什么</span><textarea value={story} rows={3} onChange={(e) => setStory(e.target.value)} placeholder="下雨那天他发现公共厨房漏水，默默修好了。"/></label>
              <label><span>让谁看见</span><select value={cardVisibility} onChange={(e) => setCardVisibility(e.target.value as typeof cardVisibility)}><option value="cross-circle">跨圈公开，跟着 TA 走</option><option value="hidden">只给对方看</option></select></label>
            </>}

            <button className="primary-button" onClick={buildDraft}>查看草稿 <b>→</b></button>
          </div>)}

      {isListing && (myCircles.length === 0 ? <p className="soft-note">先加入或创建一个圈子，才能发布需要 / 提供。</p> : <div className="manual-form">
        <label><span>标题</span><input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={intent === "need" ? "例如：泉州的一晚住宿" : "例如：一起修小家电"}/></label>
        <label><span>完整说明</span><textarea value={detail} rows={3} onChange={(e) => setDetail(e.target.value)} placeholder={intent === "need" ? "下周在泉州停留一晚，想找一个可以睡觉、也可以一起聊天的地方。" : "这周可以帮忙修小家电，也可以一起研究怎么修。"}/></label>
        <label><span>时间（可选）</span><input value={time} onChange={(e) => setTime(e.target.value)} placeholder="7 月 23 日 / 本周三至周日"/></label>
        <label><span>地点（可选）</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="泉州 / 线上"/></label>
        <label><span>参考额度（可选）</span><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={`约 10 ${circle.currency}，也可以协商`}/></label>
        <span className="form-label">在哪些圈子里出现</span>
        <div className="circle-picker">{myCircles.map((item) => <button key={item.id} className={listingCircleIds.includes(item.id) ? "active" : ""} onClick={() => toggleListingCircle(item.id)}><CircleGlyph icon={item.short} seed={item.id} size="tiny"/>{item.name}</button>)}</div>
        <label className="inline-check"><input type="checkbox" checked={crossCircle} onChange={(e) => setCrossCircle(e.target.checked)}/><span><b>跨圈公开</b></span></label>
        <button className="primary-button" onClick={buildDraft}>查看草稿 <b>→</b></button>
      </div>)}
    </> : <>
      <div className={`draft-card draft-${accent}`}><Pill color="cream">草稿 · 可修改</Pill><h3>{review.title}</h3><p>{review.detail}</p><div>{review.footer}</div></div>
      <div className="sheet-actions"><button className="secondary-button" onClick={() => setReview(null)}>返回修改</button><button className="primary-button" disabled={saving} onClick={publish}>{saving ? "正在保存…" : "发布"} <b>→</b></button></div>
    </>}
  </Modal>;
}

function ShareSheet({ shareUrl, onClose, onCopy, onDone, onNotice }: { shareUrl: string; onClose: () => void; onCopy: () => Promise<void>; onDone: () => Promise<void>; onNotice: (message: string) => void }) {
  // A share poster can leave the app, so circle-only titles must never be
  // printed on it. The linked profile still applies bootstrap visibility.
  const myListings = activeDb.settings.publicListings
    ? activeDb.listings.filter((listing) => listing.memberId === activeDb.currentMemberId && listing.status === "active" && listing.visibility === "cross-circle")
    : [];
  const needs = myListings.filter((item) => item.type === "need");
  const offers = myListings.filter((item) => item.type === "offer");
  const me=memberById(activeDb.currentMemberId);
  const posterRef = useRef<HTMLDivElement>(null);
  async function saveImage() { try { await savePosterImage(posterRef.current, `${me.name}-个人档案`); onNotice("个人档案图片已保存"); } catch { onNotice("保存失败，请稍后再试"); } }
  return <Modal onClose={onClose} label="分享个人档案预览"><span className="sheet-kicker">分享个人档案</span><div ref={posterRef} className="share-poster"><div className="poster-top"><Character member={me}/><div><span>{me.handle}</span><h2>{me.name}的个人档案</h2></div></div><div className="poster-panel poster-need"><b>我目前想要</b>{needs.map((item) => <p key={item.id}>{item.title}</p>)}{needs.length === 0 && <p>暂无公开内容</p>}</div><div className="poster-panel poster-offer"><b>我目前可以给</b>{offers.map((item) => <p key={item.id}>{item.title}</p>)}{offers.length === 0 && <p>暂无公开内容</p>}</div><div className="poster-bottom"><div><b>可以问，也可以拒绝。</b></div><QrCode value={shareUrl} className="fake-qr"/></div></div><p className="share-boundary-note">仅包含跨圈公开内容</p>{isLocalUrl(shareUrl) && <p className="local-link-warning">本地测试链接，仅这台电脑可打开。</p>}<div className="share-link-row"><span>{shareUrl}</span><button className="secondary-button" onClick={onCopy}>复制链接</button></div><div className="share-primary-actions"><button className="secondary-button" onClick={saveImage}>保存图片</button><button className="primary-button" onClick={onDone}>{isLocalUrl(shareUrl) ? "复制测试链接" : "分享档案"}</button></div></Modal>;
}

function PostShareSheet({ post, shareUrl, onClose, onNotice }: { post: Post; shareUrl: string; onClose: () => void; onNotice: (message: string) => void }) {
  const listing = post.source === "listing" ? activeDb.listings.find((item) => item.id === post.sourceId) : null;
  const card = post.source === "card" ? activeDb.goodCards.find((item) => item.id === post.sourceId) : null;
  const crossCircle = listing?.visibility === "cross-circle" || card?.visibility === "cross-circle";
  const circleNames = post.circleIds.map((id) => circleById(id)?.name).filter(Boolean).join("、");
  const posterRef = useRef<HTMLDivElement>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      onNotice(isLocalUrl(shareUrl) ? "已复制本地测试链接，只能在这台电脑打开" : "动态链接已复制");
    } catch { onNotice("复制失败，请手动选择链接"); }
  }

  async function sharePost() {
    const canShare = typeof navigator.share === "function";
    try {
      if (isLocalUrl(shareUrl)) { await copyLink(); return; }
      if (canShare) await navigator.share({ title: `${post.badge}｜${post.person}`, text: crossCircle ? post.text : "登录流动圈查看这条圈内动态", url: shareUrl });
      else await navigator.clipboard.writeText(shareUrl);
    } catch { return; }
    onClose();
    onNotice(canShare ? "已经交给系统分享" : "动态链接已复制");
  }

  async function saveImage() { try { await savePosterImage(posterRef.current, `${post.badge}-${post.person}`); onNotice("动态分享图片已保存"); } catch { onNotice("保存失败，请稍后再试"); } }

  return <Modal onClose={onClose} label="分享动态预览">
    <span className="sheet-kicker">DYNAMIC SHARE · 动态分享</span>
    <div ref={posterRef} className={`post-share-poster detail-${post.color}`}>
      {crossCircle
        ? <><div className="poster-top"><Character member={post.memberId ? memberById(post.memberId) : undefined} text={post.memberId ? undefined : post.avatar} color={post.color} variant={post.avatarVariant}/><div><span>{post.caption}</span><h2>{post.person}</h2></div></div><Pill color="cream">{post.badge} · 跨圈公开</Pill><p className="post-share-copy">{post.text}</p><small>{post.meta}</small></>
        : <div className="restricted-share"><Pill color="blue">圈内动态</Pill><h2>登录后查看</h2><small>{circleNames || "相关圈子"}</small></div>}
      <div className="poster-bottom"><div><b>{crossCircle ? "可以问，也可以拒绝。" : "仅圈内成员可见"}</b></div><QrCode value={shareUrl} className="fake-qr"/></div>
    </div>
    <p className="share-boundary-note">{crossCircle ? "跨圈公开" : "仅圈内成员可见"}</p>
    {isLocalUrl(shareUrl) && <p className="local-link-warning">本地测试链接，仅这台电脑可打开。</p>}
    <div className="share-link-row"><span>{shareUrl}</span><button className="secondary-button" onClick={copyLink}>复制链接</button></div>
    <div className="share-primary-actions"><button className="secondary-button" onClick={saveImage}>保存图片</button><button className="primary-button" onClick={sharePost}>{isLocalUrl(shareUrl) ? "复制测试链接" : "分享动态"}</button></div>
  </Modal>;
}

function ProfileSheet({ member, activeCircleId, initialTab, onClose, onNotice, onChanged }: { member: Member; activeCircleId: string; initialTab: ProfileTab; onClose: () => void; onNotice: (message: string) => void; onChanged: () => Promise<void> }) {
  const [contact, setContact] = useState(false);
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [transactionDialog, setTransactionDialog] = useState<TransactionDialog | null>(null);
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [transactionBusy, setTransactionBusy] = useState(false);
  const [transactionError, setTransactionError] = useState("");
  const isSelf = member.id === activeDb.currentMemberId;
  const accounts = activeDb.accounts.filter((item) => item.memberId === member.id);
  // Falling back to accounts[0] labelled the number with a circle the viewer
  // wasn't looking at; without a circle in context, show none.
  const activeAccount = accounts.find((item) => item.circleId === activeCircleId) ?? accountFor(member.id, activeCircleId);
  const activeCircle = circleById(activeAccount.circleId) ?? EMPTY_CIRCLE;
  const cards = activeDb.goodCards.filter((card) => card.toMemberId === member.id && (card.visibility === "cross-circle" || isSelf));
  const listings = activeDb.listings.filter((listing) => listing.memberId === member.id);
  const transactions = activeDb.transactions.filter((transaction) => (transaction.providerId === member.id || transaction.receiverId === member.id) && (isSelf || transaction.visibility === "public"));

  async function changeListing(id: string, status: "active" | "paused" | "closed") {
    const response = await fetch(`/api/listings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { onNotice(result.error || "更新失败"); return; }
    await onChanged();
    onNotice(status === "active" ? "内容已重新发布" : "内容已暂停");
  }

  async function amendTransaction(id: string, body: Record<string, unknown>, done: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "更新失败");
      await onChanged();
      onNotice(done);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "更新失败";
    }
  }

  function openRejectDialog(transaction: Transaction, currency: string) {
    setTransactionError("");
    setTransactionDialog({ kind: "reject", transaction, currency });
  }

  // Proposing a correction moves nothing — the other party has to accept it.
  function openCorrectionDialog(transaction: Transaction, currency: string) {
    setCorrectionAmount(String(transaction.amount));
    setTransactionError("");
    setTransactionDialog({ kind: "correct", transaction, currency });
  }

  async function submitTransactionDialog() {
    if (!transactionDialog || transactionBusy) return;
    const { kind, transaction } = transactionDialog;
    let body: Record<string, unknown> = { action: "reject" };
    let done = "记录已撤销，请核对双方额度";
    if (kind === "correct") {
      const amount = Number(correctionAmount);
      if (!Number.isInteger(amount) || amount <= 0) { setTransactionError("额度必须是大于 0 的整数"); return; }
      if (amount === transaction.amount) { setTransactionError("新额度需要和现在不同"); return; }
      body = { action: "correct", amount };
      done = "更正已提议，等待对方确认";
    }
    setTransactionBusy(true);
    setTransactionError("");
    const error = await amendTransaction(transaction.id, body, done);
    setTransactionBusy(false);
    if (error) { setTransactionError(error); return; }
    setTransactionDialog(null);
  }

  async function resolveCorrection(id: string, action: "accept" | "decline" | "withdraw") {
    const response = await fetch(`/api/records/${id}/correction`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { onNotice(result.error || "更新失败"); return; }
    await onChanged();
    onNotice(action === "accept" ? "已接受更正，双方账户已重算" : action === "decline" ? "已谢绝更正，记录保持原样" : "已撤回提议");
  }

  async function confirmTransaction(id: string) {
    const response = await fetch(`/api/records/${id}/confirm`, { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { onNotice(result.error || "确认失败"); return; }
    await onChanged();
    onNotice("已确认，额度已经入账");
  }

  const statusLabel = { active: "进行中", paused: "已暂停", closed: "已结束" } as const;
  const transactionStatus = { pending: "待确认", confirmed: "已确认", corrected: "已更正", rejected: "已撤销" } as const;

  return <><Modal onClose={onClose} label={`${member.name}的完整社区档案`} wide>
    <div className={`role-card role-${member.color}`}><Character member={member}/><div><Pill color="cream">{isSelf ? "我的完整档案" : `同圈成员 · ${member.circleIds.length} 个圈`}</Pill><h2>{member.name}</h2><p>{member.handle}{member.bio ? ` · ${member.bio}` : ""}</p></div></div>
    <div className="profile-numbers"><div><b>{activeAccount.balance > 0 ? "+" : ""}{activeAccount.balance}</b><span>{activeCircle.name} · 当前额度</span></div><div><b>{activeAccount.given}</b><span>在本圈给出过</span></div><div><b>{activeAccount.received}</b><span>在本圈收到过</span></div></div>
    <div className="profile-tabs" role="tablist"><button className={tab === "cards" ? "active" : ""} onClick={() => setTab("cards")}>好人卡 <b>{cards.length}</b></button><button className={tab === "listings" ? "active" : ""} onClick={() => setTab("listings")}>需要 / 提供 <b>{listings.length}</b></button><button className={tab === "transactions" ? "active" : ""} onClick={() => setTab("transactions")}>互助记录 <b>{transactions.length}</b></button></div>

    {tab === "cards" && <div className="archive-list card-archive">{cards.map((card) => { const from = memberById(card.fromMemberId); const circle = circleById(card.circleId); return <article key={card.id}><header><Character member={from} small/><span><b>{from?.name} 写给 {member.name}</b><small>{[card.date, circle?.name].filter(Boolean).join(" · ")}</small></span><Pill color="coral">好人卡</Pill></header><p>“{card.story}”</p></article>; })}{cards.length === 0 && <div className="empty-archive">还没有好人卡。它由接收帮助的人主动写下。</div>}</div>}

    {tab === "listings" && <div className="archive-list listing-archive">{listings.map((listing) => <article key={listing.id} className={listing.type === "need" ? "archive-need" : "archive-offer"}><header><Pill color={listing.type === "need" ? "pink" : "green"}>{listing.type === "need" ? "我想要" : "我可以给"}</Pill><span className={`status status-${listing.status}`}>{statusLabel[listing.status]}</span>{isSelf && listing.status !== "closed" && <button onClick={() => changeListing(listing.id, listing.status === "active" ? "paused" : "active")}>{listing.status === "active" ? "暂停" : "重新发布"}</button>}</header><h3>{listing.title}</h3><p>{listing.detail}</p><dl><div><dt>时间</dt><dd>{listing.time || "—"}</dd></div><div><dt>地点</dt><dd>{listing.location || "—"}</dd></div><div><dt>参考</dt><dd>{listing.reference || "可协商"}</dd></div><div><dt>范围</dt><dd>{listing.visibility === "cross-circle" ? "跨圈公开" : listing.circleIds.map((id) => circleById(id)?.name).filter(Boolean).join("、")}</dd></div></dl></article>)}{listings.length === 0 && <div className="empty-archive">还没有发布中的需要或提供。</div>}</div>}

    {tab === "transactions" && <div className="archive-list transaction-archive">{transactions.map((transaction) => {
      const provider = memberById(transaction.providerId);
      const receiver = memberById(transaction.receiverId);
      const circle = circleById(transaction.circleId) ?? EMPTY_CIRCLE;
      const canAmend = isSelf && circle.settings.allowRejectCorrect && transaction.status !== "rejected";
      const proposal = isSelf ? transaction.pendingCorrection : null;
      const mine = proposal?.proposedById === activeDb.currentMemberId;
      return <article key={transaction.id}>
        <header><div>
          <Pill color={transaction.visibility === "private" ? "blue" : "yellow"}>{transaction.visibility === "private" ? "仅自己可见" : transaction.visibility === "mystery" ? "神秘记录" : "圈内公开"}</Pill>
          <span className={`status status-${transaction.status}`}>{transactionStatus[transaction.status]}</span>
          {isSelf && transaction.status === "pending" && transaction.createdById !== activeDb.currentMemberId && <button onClick={() => confirmTransaction(transaction.id)}>确认入账</button>}
          {isSelf && transaction.status === "pending" && transaction.createdById === activeDb.currentMemberId && <span className="status status-pending">等对方确认</span>}
          {canAmend && !proposal && <button onClick={() => openCorrectionDialog(transaction, circle.currency)}>提议更正</button>}
          {canAmend && <button onClick={() => openRejectDialog(transaction, circle.currency)}>拒绝 / 撤销</button>}
        </div><strong>{transaction.amount} {circle.currency}</strong></header>
        <h3>{transaction.title}</h3><p>{transaction.story}</p>
        {proposal && <div className="correction-note">
          <b>{mine ? "你提议" : "对方提议"}把额度改成 {proposal.amount} {circle.currency}</b>
          <span>{mine ? "等对方确认后才会生效。" : "接受后双方账户会立刻重算；谢绝的话记录保持原样。"}</span>
          <div>{mine
            ? <button onClick={() => resolveCorrection(transaction.id, "withdraw")}>撤回提议</button>
            : <><button onClick={() => resolveCorrection(transaction.id, "accept")}>接受</button><button onClick={() => resolveCorrection(transaction.id, "decline")}>谢绝</button></>}</div>
        </div>}
        <footer><span>{provider?.name} → {receiver?.name}</span><span>{transaction.happenedAt} · {circle.name}</span></footer>
      </article>;
    })}{transactions.length === 0 && <div className="empty-archive">当前没有可以向你公开的交易记录。</div>}</div>}

    <SectionTitle eyebrow="CIRCLE ACCOUNTS" title="各圈额度"/>
    <div className="account-strip">{accounts.map((account) => { const circle = circleById(account.circleId) ?? EMPTY_CIRCLE; return <div key={account.circleId}><span>{circle.name}</span><b>{account.balance > 0 ? "+" : ""}{account.balance} {circle.currency}</b><small>给出 {account.given} · 收到 {account.received}</small></div>; })}</div>

    {isSelf
      ? null
      : contact
        ? <div className="contact-reveal"><span>{member.wechat ? "联系方式" : "账号"}</span><b>{member.wechat || member.handle}</b><button onClick={async () => { try { await navigator.clipboard.writeText(member.wechat || member.handle); onNotice("已复制"); } catch { onNotice("复制失败，请手动复制"); } }}>复制</button></div>
        : <button className="primary-button" onClick={() => setContact(true)}>联系{member.name}{member.wechat ? "，查看联系方式" : ""}</button>}
    {!isSelf && contact && !member.wechat && <p className="soft-note">TA 还没有填写联系方式，可以先在圈子里留言。</p>}
  </Modal>
  {transactionDialog && <Modal onClose={() => { if (!transactionBusy) setTransactionDialog(null); }} label={transactionDialog.kind === "correct" ? "提议更正额度" : "确认撤销记录"}>
    <div className="sheet-heading"><Pill color={transactionDialog.kind === "correct" ? "blue" : "coral"}>{transactionDialog.kind === "correct" ? "等待对方确认" : "会恢复双方额度"}</Pill><h2>{transactionDialog.kind === "correct" ? "把这笔记录改成多少？" : "确认撤销这笔记录？"}</h2><p>{transactionDialog.transaction.title}</p></div>
    {transactionDialog.kind === "correct"
      ? <div className="manual-form"><label><span>新的互助额度</span><input aria-label="新的互助额度" type="number" min="1" step="1" inputMode="numeric" value={correctionAmount} onChange={(event) => setCorrectionAmount(event.target.value)}/><small>当前是 {transactionDialog.transaction.amount} {transactionDialog.currency}。对方接受后才会重算。</small></label></div>
      : <div className="transaction-warning"><b>{transactionDialog.transaction.amount} {transactionDialog.currency}</b><p>撤销后，这笔记录不再计入双方额度；过去的通知会显示为已处理。</p></div>}
    {transactionError && <p className="account-error" role="alert">{transactionError}</p>}
    <div className="sheet-actions"><button className="secondary-button" disabled={transactionBusy} onClick={() => setTransactionDialog(null)}>取消</button><button className={`primary-button ${transactionDialog.kind === "reject" ? "danger-button" : ""}`} disabled={transactionBusy} onClick={submitTransactionDialog}>{transactionBusy ? "正在处理…" : transactionDialog.kind === "correct" ? "发送更正提议" : "确认撤销"}</button></div>
  </Modal>}
  </>;
}

// The circle's public agreement page: what it is, how to get in, what the
// negotiation references are, and which mutual-aid toggles are on.
function RulesSheet({ circle, onClose }: { circle: Circle; onClose: () => void }) {
  const { references, rules, allowNegativeBalance, requireConfirmation, allowRejectCorrect } = circle.settings;
  const toggles = [
    { on: allowNegativeBalance, title: "允许负余额", note: "可以先接受帮助" },
    { on: requireConfirmation, title: "记录需对方确认", note: "确认后入账" },
    { on: allowRejectCorrect, title: "允许拒绝 / 更正", note: "更改后重新计算" },
  ];
  return <Modal onClose={onClose} label={`${circle.name}介绍与约定`} wide>
    <header className={`detail-hero hero-${circle.color}`}><CircleGlyph icon={circle.short} seed={circle.id} size="large"/><h2>{circle.name}</h2><p>{circle.tagline || "这个圈子还没有写介绍。"}</p><small>{circle.currency} · {circle.members} 位成员 · {circle.joining === "approval" ? "加入需审批" : "受邀可直接加入"}</small></header>
    <SectionTitle eyebrow="REFERENCE" title="协商参考"/>
    {references.length > 0
      ? <div className="reference-detail-grid">{references.map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}</div>
      : <p className="soft-note">还没有协商参考。</p>}
    <SectionTitle eyebrow="HOW IT RUNS" title="记账规则"/>
    <div className="toggle-summary">{toggles.map((item) => <div key={item.title} className={item.on ? "on" : ""}><b>{item.on ? "✓" : "—"} {item.title}</b><span>{item.on ? item.note : "未开启"}</span></div>)}</div>
    {rules.length > 0 && <><SectionTitle eyebrow="AGREEMENTS" title="圈子约定"/><section className="rule-list">{rules.map((rule, index) => <div key={rule}><b>{String(index + 1).padStart(2, "0")}</b><p>{rule}</p></div>)}</section></>}
    <div className="boundary-card"><b>敏感内容可以不记录</b><p>也可以拒绝、暂停或退出。</p></div>
  </Modal>;
}

function MembersSheet({ circle, requests, isOwner, onProfile, onInvite, onClose, onResolve, onLeave, onTransfer }: { circle: Circle; requests: JoinRequest[]; isOwner: boolean; onProfile: (id?: string) => void; onInvite: () => void; onClose: () => void; onResolve: (circleId: string, memberId: string, action: "approve" | "decline") => Promise<void>; onLeave: (circle: Circle) => Promise<boolean>; onTransfer: (circle: Circle, memberId: string) => Promise<boolean> }) {
  const circleMembers = circle.memberIds.map((id) => memberById(id));
  // The row only disappears once the refetch lands, so without this a double
  // tap sends the same approve twice.
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) { setBusy(true); try { await action(); } finally { setBusy(false); } }
  const [memberAction, setMemberAction] = useState<{ kind: "leave" } | { kind: "transfer"; member: Member } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const me = activeDb.currentMemberId;
  const balance = accountFor(me, circle.id).balance;
  const others = circleMembers.filter((member) => member.id !== me);
  // The invite page promises every member they can leave, so say plainly what
  // still stands in the way rather than letting the server refuse silently.
  const blocker = balance < 0
    ? `你在这个圈子还欠 ${-balance} ${circle.currency}，先把余额补回非负才能退出。`
    : isOwner && others.length > 0
      ? "你是圈主。审批和设置只有圈主能做，所以要先把圈主转让给其他成员。"
      : "";
  async function confirmMemberAction() {
    if (!memberAction || actionBusy) return;
    setActionBusy(true);
    const ok = memberAction.kind === "leave"
      ? await onLeave(circle)
      : await onTransfer(circle, memberAction.member.id);
    setActionBusy(false);
    if (ok) setMemberAction(null);
  }

  return <><Modal onClose={onClose} label={`${circle.name}全部成员`} wide><div className="sheet-heading member-heading"><Pill color={circle.color}>{circle.members} 位成员</Pill><h2>{circle.name}的成员</h2></div>{requests.length > 0 && <section className="request-list"><SectionTitle eyebrow="WAITING" title={`${requests.length} 个人在等你放行`}/>{requests.map((request) => <article key={request.member.id}><Character member={request.member}/><div><b>{request.member.name}</b><small>{request.member.handle} · {request.requestedAt}</small>{request.note && <p>“{request.note}”</p>}</div><div className="request-actions"><button className="primary-button" disabled={busy} onClick={() => run(() => onResolve(circle.id, request.member.id, "approve"))}>通过</button><button className="secondary-button" disabled={busy} onClick={() => run(() => onResolve(circle.id, request.member.id, "decline"))}>谢绝</button></div></article>)}</section>}<div className="member-list">{circleMembers.map((member,index) => { const account = accountFor(member.id, circle.id); const offer = activeDb.listings.find((listing) => listing.memberId === member.id && listing.type === "offer" && listing.status === "active"); return <button key={member.id || `unknown-${index}`} disabled={!isKnown(member)} onClick={() => onProfile(member.id)}><span className="member-index">0{index+1}</span><Character member={member}/><span><b>{member.name}</b><small>{member.handle}</small><p>{offer?.title ?? member.bio}</p></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div><button className="primary-button" onClick={onInvite}>＋ 邀请成员</button>
    {isOwner && others.length > 0 && <section className="transfer-owner"><SectionTitle eyebrow="HANDOVER" title="转让圈主"/><p className="soft-note">对方将负责审批与设置。</p><div className="transfer-list">{others.map((member) => <button key={member.id} disabled={actionBusy} onClick={() => setMemberAction({ kind: "transfer", member })}><Character member={member} small/><span><b>{member.name}</b><small>{member.handle}</small></span><strong>转让 →</strong></button>)}</div></section>}
    <section className="leave-circle"><SectionTitle eyebrow="EXIT" title="退出圈子"/><p className="soft-note">{blocker || "历史记录保留；余额归零；发布内容关闭。"}</p><button className="text-link danger" disabled={blocker !== "" || actionBusy} onClick={() => setMemberAction({ kind: "leave" })}>退出 {circle.name}</button></section></Modal>
    {memberAction && <Modal onClose={() => { if (!actionBusy) setMemberAction(null); }} label={memberAction.kind === "transfer" ? "确认转让圈主" : "确认退出圈子"}>
      <div className="sheet-heading"><Pill color={memberAction.kind === "transfer" ? "blue" : "coral"}>{memberAction.kind === "transfer" ? "权限会立即改变" : "不会删除历史记录"}</Pill><h2>{memberAction.kind === "transfer" ? `把圈主转让给 ${memberAction.member.name}？` : `确认退出 ${circle.name}？`}</h2><p>{memberAction.kind === "transfer" ? "转让后，审批入圈和修改设置由对方负责；你仍然是普通成员。" : "退出后，你的发布中内容会关闭，过去由双方确认的互助记录仍会保留。"}</p></div>
      <div className="sheet-actions"><button className="secondary-button" disabled={actionBusy} onClick={() => setMemberAction(null)}>取消</button><button className={`primary-button ${memberAction.kind === "leave" ? "danger-button" : ""}`} disabled={actionBusy} onClick={confirmMemberAction}>{actionBusy ? "正在处理…" : memberAction.kind === "transfer" ? "确认转让" : "确认退出"}</button></div>
    </Modal>}
  </>;
}

function InviteSheet({ circle, onClose, onNotice }: { circle: Circle; onClose: () => void; onNotice: (message: string) => void }) {
  const [method, setMethod] = useState<"link" | "poster">("link");
  const [inviteUrl,setInviteUrl]=useState(""); const [creating,setCreating]=useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  async function createInvite(){try{setCreating(true);const response=await fetch("/api/invitations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({circleId:circle.id})});const result=await response.json() as {url?:string;error?:string};if(!response.ok||!result.url)throw new Error(result.error||"邀请创建失败");setInviteUrl(result.url);return result.url;}catch(error){onNotice(error instanceof Error?error.message:"邀请创建失败");return "";}finally{setCreating(false);}}
  // Every copy/share mints a fresh link: these are single-use, so reusing the
  // cached one would hand two people the same token and fail the second.
  async function copyInvite(){const url=await createInvite();if(!url)return;try{await navigator.clipboard.writeText(url);onNotice(isLocalUrl(url)?"已复制本地测试链接，只能在这台电脑打开":"邀请链接已复制，只能用一次");}catch{onNotice("复制失败，请手动复制链接");}}
  async function shareInvite(){const url=await createInvite();if(!url)return;const canShare=typeof navigator.share==="function";try{if(isLocalUrl(url)){await navigator.clipboard.writeText(url);onNotice("已复制本地测试链接，只能在这台电脑打开");return;}if(canShare)await navigator.share({title:`加入${circle.name}`,text:circle.tagline,url});else await navigator.clipboard.writeText(url);}catch{return;}onNotice(canShare?"邀请已经交给系统分享":"邀请链接已复制，可以粘贴到微信");}
  async function showPoster(){setMethod("poster");if(!inviteUrl&&!creating)await createInvite();}
  async function saveImage(){if(!inviteUrl){onNotice("请先生成邀请图");return;}try{await savePosterImage(posterRef.current, `${circle.name}-邀请`);onNotice("邀请图片已保存");}catch{onNotice("保存失败，请稍后再试");}}
  return <Modal onClose={onClose} label={`邀请加入${circle.name}`}><div className="sheet-heading"><Pill color={circle.color}>{circle.joining === "approval" ? "加入需审批" : "受邀直接加入"}</Pill><h2>邀请加入 {circle.name}</h2></div><div className="invite-tabs"><button className={method === "link" ? "active" : ""} onClick={() => setMethod("link")}>邀请链接</button><button className={method === "poster" ? "active" : ""} onClick={() => void showPoster()}>微信邀请图</button></div>{method === "link" ? <div className="invite-link"><span>7 天有效 · 仅可使用 1 次</span><b>{inviteUrl||"生成安全邀请链接"}</b><button disabled={creating} onClick={copyInvite}>{creating?"正在生成…":inviteUrl?"复制链接":"生成并复制"}</button></div> : <div ref={posterRef} className={`mini-invite-poster hero-${circle.color}`}><CircleGlyph icon={circle.short} seed={circle.id} size="regular"/><span>来自圈内伙伴的邀请</span><h3>来 {circle.name}<br/>看看我们还能怎样互相帮助</h3><p>可以问，也可以拒绝。</p><QrCode value={inviteUrl} className="mini-code"/></div>}{isLocalUrl(inviteUrl) && <p className="local-link-warning">本地测试地址，仅这台电脑可打开。</p>}{method === "poster" ? <div className="share-primary-actions"><button className="secondary-button" disabled={creating || !inviteUrl} onClick={saveImage}>保存图片</button><button className="primary-button" disabled={creating} onClick={shareInvite}>分享邀请</button></div> : <button className="primary-button" disabled={creating} onClick={shareInvite}>分享邀请</button>}</Modal>;
}

// Four-step create wizard. Every field maps to something loop-backend stores:
// name/icon/currency/description/joining, plus the three toggles and the
// references + rules kept in `circle.settings`.
type CreateCircleInput = {
  name: string; short: string; currency: string; tagline: string; joining: string;
  allowNegative: boolean; requireConfirmation: boolean; allowRejectCorrect: boolean;
  references: { name: string; value: string; note?: string }[];
  rules: string[];
};
function CreateCircleView({ onExit, onDone }: { onExit: () => void; onDone: (input: CreateCircleInput) => Promise<void> }) {
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [short, setShort] = useState<CircleIconKey>("n1");
  const [currency, setCurrency] = useState("");
  const [tagline, setTagline] = useState("");
  const [joining, setJoining] = useState("direct");
  // Negative balances default ON: without them the very first record in a new
  // circle would fail, since nobody has any credit to spend yet.
  const [allowNegative, setAllowNegative] = useState(true);
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [allowRejectCorrect, setAllowRejectCorrect] = useState(false);
  const [referenceName, setReferenceName] = useState("");
  const [referenceValue, setReferenceValue] = useState("");
  const [rules, setRules] = useState("");
  const steps = ["圈子身份", "互助设置", "成员与边界", "预览确认"];
  const unit = currency || "额度";
  const ruleList = rules.split("\n").map((line) => line.trim()).filter(Boolean);
  // Name and unit are the only things loop requires. They live on step 1, so
  // catch them there rather than letting someone fill in three more screens
  // and get turned away at the end.
  const missing = !name.trim() ? "请先填写圈子名称" : !currency.trim() ? "请先给互助额度起个名字" : "";
  const referenceError = (referenceName.trim() === "") !== (referenceValue.trim() === "") ? "协商参考需要同时填写名称和额度；也可以两项都留空" : "";
  const ruleError = ruleList.length > 10 ? `圈子约定最多 10 条，目前有 ${ruleList.length} 条` : "";
  const stepError = step === 1 ? missing : step === 2 ? referenceError : step === 3 ? ruleError : "";
  const blocked = stepError !== "";
  const canEnterStep = (target: number) => !(target > 1 && missing) && !(target > 2 && referenceError) && !(target > 3 && ruleError);

  if (saved) return <section className="create-success"><div className="success-burst">✓</div><Pill color="green">已创建</Pill><h2>{name}<br/>准备好了。</h2><div className="created-passport"><CircleGlyph icon={short} seed={name} size="regular"/><div><span>新的圈子</span><h3>{name}</h3><p>{currency} · {joining === "direct" ? "受邀直接加入" : "管理员审批"}</p></div><b>已创建</b></div><div className="create-actions"><button className="primary-button" onClick={onExit}>回到我的圈子</button></div></section>;

  return <section className="create-page">
    <div className="create-intro"><div><Pill color="green">创建圈子</Pill><h2>给一段关系，<br/>画出边界。</h2></div><button onClick={onExit}>退出</button></div>

    <nav className="create-progress" aria-label="创建圈子步骤">{steps.map((label, index) => <button key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} disabled={!canEnterStep(index + 1)} onClick={() => setStep(index + 1)}><b>{step > index + 1 ? "✓" : `0${index + 1}`}</b><span>{label}</span></button>)}</nav>

    <div className="create-panel">
      {step === 1 && <><div className="create-heading"><span>STEP 01 · IDENTITY</span><h2>圈子身份</h2></div><div className="create-form-grid"><label className="wide"><span>圈子名称</span><input value={name} maxLength={40} placeholder="例如：周末手作营地" onChange={(event) => setName(event.target.value)}/></label><label><span>互助额度名称</span><input value={currency} maxLength={20} placeholder="例如：泡泡" onChange={(event) => setCurrency(event.target.value)}/></label><label className="wide"><span>一句话介绍</span><textarea value={tagline} maxLength={120} placeholder="一起做东西，也一起分享工具、经验和时间。" onChange={(event) => setTagline(event.target.value)}/></label></div><div className="circle-icon-picker"><div className="circle-icon-picker-heading"><span className="form-label">选择圈子图案</span></div>{CIRCLE_ICON_GROUPS.map((group) => <section key={group.label}><header><b>{group.label}</b></header><div>{group.keys.map((key) => <button key={key} type="button" className={short === key ? "selected" : ""} onClick={() => setShort(key)} aria-label={`选择${CIRCLE_ICON_LABELS[key]}圈子图案`}><CircleGlyph icon={key} seed={key} size="small"/><span>{CIRCLE_ICON_LABELS[key]}</span></button>)}</div></section>)}</div></>}

      {step === 2 && <><div className="create-heading"><span>STEP 02 · MUTUAL CREDIT</span><h2>互助设置</h2></div><div className="mechanism-card"><div className="mechanism-icon">＋<br/>−</div><div><Pill color="yellow">互助账户</Pill><h3>成员共同记账</h3><p>给出增加，收到减少。</p></div><b>已选择</b></div><div className="reference-editor"><div><span>协商参考</span><input value={referenceName} placeholder="一小时协作" onChange={(event) => setReferenceName(event.target.value)}/></div><div><span>大约多少额度</span><input value={referenceValue} placeholder={`约 5 ${unit}`} onChange={(event) => setReferenceValue(event.target.value)}/></div></div><span className="form-label">记账规则</span><div className="toggle-list"><label><span><b>允许负余额</b><small>可以先接受帮助</small></span><input type="checkbox" checked={allowNegative} onChange={(event) => setAllowNegative(event.target.checked)}/></label><label><span><b>记录需要对方确认</b><small>确认后入账</small></span><input type="checkbox" checked={requireConfirmation} onChange={(event) => setRequireConfirmation(event.target.checked)}/></label><label><span><b>允许拒绝 / 更正</b><small>更改后重新计算</small></span><input type="checkbox" checked={allowRejectCorrect} onChange={(event) => setAllowRejectCorrect(event.target.checked)}/></label></div></>}

      {step === 3 && <><div className="create-heading"><span>STEP 03 · GOVERNANCE</span><h2>成员与边界</h2></div><span className="form-label">新成员怎么加入</span><div className="create-choice-row two"><button className={joining === "direct" ? "active" : ""} onClick={() => setJoining("direct")}><b>受邀直接加入</b></button><button className={joining === "approval" ? "active" : ""} onClick={() => setJoining("approval")}><b>管理员审批</b></button></div><label className="typing-box"><span>圈子约定（一行一条，最多 10 条）</span><textarea rows={5} value={rules} onChange={(event) => setRules(event.target.value)} placeholder={"可以开口，也可以拒绝\n敏感互助可以不记录\n成员可以随时暂停或退出"}/><small className={ruleError ? "field-count over" : "field-count"}>{ruleList.length} / 10</small></label><div className="boundary-card"><b>共同边界</b><p>不与人民币兑换，不做贡献排名。</p></div></>}

      {step === 4 && <><div className="create-heading"><span>STEP 04 · REVIEW</span><h2>创建前确认</h2></div><article className="circle-draft-preview"><header><CircleGlyph icon={short} seed={name} size="large"/><div><Pill color="cream">新圈预览</Pill><h2>{name || "未命名圈子"}</h2><p>{tagline || "还没有写一句话介绍"}</p></div></header><div className="draft-summary"><div><span>互助额度</span><b>{currency || "未命名"}</b><small>不兑换人民币</small></div><div><span>加入方式</span><b>{joining === "direct" ? "受邀直接加入" : "管理员审批"}</b><small>{allowNegative ? "允许负余额" : "先贡献再支取"}</small></div><div><span>协商参考</span><b>{referenceName || "暂未设置"}</b><small>{referenceValue}</small></div></div><ul><li>记录已完成的互助</li>{requireConfirmation ? <li>对方确认后入账</li> : <li>记录后入账</li>}{allowRejectCorrect && <li>允许拒绝或更正</li>}{ruleList.map((rule) => <li key={rule}>{rule}</li>)}</ul><footer><span>可以问，也可以拒绝。</span></footer></article>{error && <div className="review-warning"><b>创建失败</b><p>{error}</p></div>}</>}

      <div className="create-footer">{blocked && <p className="step-hint">{stepError}</p>}<button className="secondary-button" onClick={() => step === 1 ? onExit() : setStep(step - 1)}>{step === 1 ? "取消" : "← 上一步"}</button>{step < 4 ? <button className="primary-button" disabled={blocked} onClick={() => setStep(step + 1)}>继续：{steps[step]} →</button> : <button className="primary-button" disabled={saving} onClick={async () => { try { setSaving(true); setError(""); await onDone({ name: name.trim(), short, currency: currency.trim(), tagline: tagline.trim(), joining, allowNegative, requireConfirmation, allowRejectCorrect, references: referenceName.trim() ? [{ name: referenceName.trim(), value: referenceValue.trim(), note: "" }] : [], rules: ruleList }); setSaved(true); } catch(error) { setError(error instanceof Error ? error.message : "创建失败"); } finally { setSaving(false); } }}>{saving ? "正在创建…" : "创建圈子"}</button>}</div>
    </div>
  </section>;
}

function FeedFilterSheet({ active, onSelect, onClose }: { active: FeedFilter; onSelect: (filter: FeedFilter) => void; onClose: () => void }) {
  const options: {id: FeedFilter; title: string; color: Color}[] = [
    {id:"all",title:"全部动态",color:"yellow"},
    {id:"trade",title:"互助记录",color:"blue"},
    {id:"need",title:"我想要",color:"pink"},
    {id:"offer",title:"我可以给",color:"green"},
    {id:"card",title:"好人卡",color:"coral"},
  ];
  return <Modal onClose={onClose} label="筛选圈子动态"><div className="sheet-heading"><Pill color="yellow">快速选择</Pill><h2>筛选动态</h2></div><div className="filter-menu">{options.map((item) => <button key={item.id} className={`${active === item.id ? "active" : ""} filter-${item.color}`} onClick={() => onSelect(item.id)}><span/><div><b>{item.title}</b></div><strong>{active === item.id ? "✓" : "→"}</strong></button>)}</div></Modal>;
}

function PostSheet({ post, onProfile, onShare, onClose }: { post: Post; onProfile: () => void; onShare: () => void; onClose: () => void }) {
  const circle = circleById(post.circleIds[0]) ?? EMPTY_CIRCLE;
  const names = post.circleIds.map((id) => circleById(id)?.name).filter(Boolean);
  const details: { label: string; value: string }[] = [
    { label: names.length > 1 ? "所属圈子" : "所属圈子", value: names.join("、") || "—" },
  ];
  if (post.source === "listing") {
    const listing = activeDb.listings.find((item) => item.id === post.sourceId)!;
    const timeAndPlace = [listing.time, listing.location].filter(Boolean).join(" · ") || "未填写";
    details.push({ label: "时间 / 地点", value: timeAndPlace }, { label: "参考", value: listing.reference || "可协商" }, { label: "可见范围", value: listing.visibility === "cross-circle" ? "跨圈公开" : "相关圈子" });
  } else if (post.source === "transaction") {
    const transaction = activeDb.transactions.find((item) => item.id === post.sourceId)!;
    const status = transaction.status === "confirmed" ? "已确认" : transaction.status === "corrected" ? "已更正" : transaction.status === "pending" ? "待对方确认" : "已撤销";
    details.push({ label: "发生 / 记录", value: `${transaction.happenedAt} · ${transaction.recordedAt} 记录` }, { label: "额度与状态", value: `${transaction.amount} ${circle.currency} · ${status}` }, { label: "可见范围", value: transaction.visibility === "mystery" ? "圈内神秘记录" : transaction.visibility === "private" ? "仅当事人" : "圈内公开" });
  } else {
    const card = activeDb.goodCards.find((item) => item.id === post.sourceId)!;
    details.push({ label: "写下日期", value: card.date }, { label: "可见范围", value: card.visibility === "cross-circle" ? "跨圈公开" : "接收者已隐藏" }, { label: "余额影响", value: "不产生余额，也不需要偿还" });
  }
  return <Modal onClose={onClose} label="动态详情"><div className={`post-detail detail-${post.color}`}><div className="post-detail-head"><Character member={post.memberId ? memberById(post.memberId) : undefined} text={post.memberId ? undefined : post.avatar} color={post.color} variant={post.avatarVariant}/><div><Pill color="cream">{post.badge}</Pill><h2>{post.person}</h2><p>{post.caption}</p></div></div><p className="post-detail-copy">{post.text}</p><div className="chip-row">{post.chips.map((chip) => <span key={chip}>#{chip}</span>)}</div></div><div className="detail-meta">{details.map((detail) => <div key={detail.label}><span>{detail.label}</span><b>{detail.value}</b></div>)}</div><div className="sheet-actions">{post.memberId ? <button className="secondary-button" onClick={onProfile}>成员主页</button> : <button className="secondary-button" onClick={onClose}>关闭</button>}<button className="primary-button" onClick={onShare}>分享</button></div></Modal>;
}

function NotificationsSheet({ notifications, onClose, onOpen }: { notifications: AppDatabase["notifications"]; onClose: () => void; onOpen: (destination: NotificationDestination, circleId?: string) => void }) {
  function describe(n: AppDatabase["notifications"][number]): { badge: string; color: Color; line: string; destination?: NotificationDestination; actionLabel?: string } {
    const actor = memberById(n.actorId);
    const who = isKnown(actor) ? actor.name : "有人";
    const circle = circleById(n.circleId);
    const where = circle?.name;
    const unit = circle?.currency ?? "额度";
    switch (n.kind) {
      case "join_request": {
        const stillWaiting = activeDb.joinRequests.some((request) => request.circleId === n.circleId && request.member.id === n.actorId);
        const waitingInCircle = activeDb.joinRequests.filter((request) => request.circleId === n.circleId);
        if (stillWaiting) return { badge: "入圈申请", color: "pink", line: `${who} 申请加入${where ?? "你的圈子"}${n.note ? `：“${n.note}”` : ""}`, destination: "members", actionLabel: "去处理" };
        if (!isKnown(actor) && waitingInCircle.length > 0) return { badge: "待处理", color: "pink", line: `${where ?? "圈子"}还有 ${waitingInCircle.length} 个入圈申请等待处理`, destination: "members", actionLabel: "查看申请" };
        const joined = circle?.memberIds.includes(n.actorId) === true;
        return joined
          ? { badge: "已通过", color: "green", line: `${who} 已经加入${where ?? "你的圈子"}`, destination: "circle", actionLabel: "查看圈子" }
          : { badge: "已处理", color: "blue", line: isKnown(actor) ? `${who} 的入圈申请已经处理` : "这次入圈申请已经处理" };
      }
      case "join_approved": return { badge: "已通过", color: "green", line: `${who} 放行了你加入${where ?? "圈子"}的申请`, destination: "circle", actionLabel: "进入圈子" };
      case "joined": return { badge: "新成员", color: "green", line: n.text === "owner_transferred" ? `${who} 把${where ?? "圈子"}的圈主转让给了你` : `${who} 加入了${where ?? "你的圈子"}`, destination: "circle", actionLabel: "查看圈子" };
      case "invite": {
        if (!n.amount) return { badge: "待你处理", color: "yellow", line: `${who} 邀请你加入${where ?? "一个圈子"}`, destination: "circle", actionLabel: "查看圈子" };
        const candidates = activeDb.transactions.filter((transaction) => transaction.circleId === n.circleId && transaction.createdById === n.actorId && transaction.amount === n.amount);
        const transaction = candidates.find((item) => item.title === n.note) ?? candidates.find((item) => item.status === "pending") ?? candidates[0];
        if (transaction?.status === "pending") return { badge: "待你处理", color: "yellow", line: `${who} 记了一笔 ${n.amount} ${unit}${n.note ? `：${n.note}` : ""}，等你确认`, destination: "transactions", actionLabel: "去确认" };
        if (transaction?.status === "rejected") return { badge: "已撤销", color: "blue", line: `${who} 的这笔记录已经撤销，不需要再确认` };
        if (transaction?.status === "corrected") return { badge: "已更正", color: "green", line: `${who} 的这笔记录已按更正后的额度入账`, destination: "transactions", actionLabel: "查看记录" };
        if (transaction?.status === "confirmed") return { badge: "已确认", color: "green", line: `${who} 的这笔记录已经确认入账`, destination: "transactions", actionLabel: "查看记录" };
        return { badge: "已处理", color: "blue", line: `${who} 的这笔记录已经处理，不需要再确认` };
      }
      case "received": return { badge: "互助记录", color: "yellow", line: `${who} 记下了一笔 ${n.amount ?? ""} ${unit}${n.note ? `：${n.note}` : ""}`, destination: "transactions", actionLabel: "查看记录" };
      case "badge": return { badge: "好人卡", color: "coral", line: `${who} 写了一张好人卡给你${n.note ? `：“${n.note}”` : ""}`, destination: "cards", actionLabel: "查看好人卡" };
      default: return { badge: "动态", color: "blue", line: n.text || `${who} 有新的动态` };
    }
  }

  return <Modal onClose={onClose} label="通知" wide>
    <div className="sheet-heading"><Pill color="yellow">通知</Pill><h2>需要处理的事</h2></div>
    {notifications.length === 0
      ? <div className="empty-archive">还没有通知</div>
      : <div className="archive-list notification-list">{notifications.map((n) => { const { badge, color, line, destination, actionLabel } = describe(n); return <article key={n.id} className={n.read ? "" : "unread"}><header><Pill color={color}>{badge}</Pill><small>{n.createdAt}</small></header><p>{line}</p>{destination && actionLabel && <button className="notification-action" onClick={() => onOpen(destination, n.circleId)}>{actionLabel} →</button>}</article>; })}</div>}
  </Modal>;
}

function SettingsSheet({ settings, onClose, onSaved }: { settings: AppDatabase["settings"]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [cards, setCards] = useState(settings.publicCards); const [needs, setNeeds] = useState(settings.publicListings); const [hidden, setHidden] = useState(settings.keepHiddenPrivate); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  async function save(){try{setSaving(true);setError("");const response=await fetch("/api/settings",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({publicCards:cards,publicListings:needs,keepHiddenPrivate:hidden})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"保存失败");await onSaved();onClose();}catch(error){setError(error instanceof Error?error.message:"保存失败");}finally{setSaving(false);}}
  return <Modal onClose={onClose} label="跨圈公开设置"><div className="sheet-heading"><Pill color="blue">公开边界</Pill><h2>跨圈公开</h2></div><div className="toggle-list"><label><span><b>好人卡</b><small>未隐藏的内容</small></span><input type="checkbox" checked={cards} onChange={(event) => setCards(event.target.checked)}/></label><label><span><b>需要 / 提供</b><small>标记为跨圈的内容</small></span><input type="checkbox" checked={needs} onChange={(event) => setNeeds(event.target.checked)}/></label><label><span><b>保留私人存档</b><small>隐藏内容仅自己可见</small></span><input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)}/></label></div>{error&&<p className="soft-note">{error}</p>}<button className="primary-button" disabled={saving} onClick={save}>{saving?"正在保存…":"保存"}</button></Modal>;
}

// Owner-only circle settings: the three mutual-aid toggles plus the free-text
// references and rules loop keeps in `circle.settings`.
function CircleSettingsSheet({ circle, onClose, onSaved, onNotice }: { circle: Circle; onClose: () => void; onSaved: () => Promise<void>; onNotice: (message: string) => void }) {
  const [currency, setCurrency] = useState(circle.currency);
  const [tagline, setTagline] = useState(circle.tagline);
  const [joining, setJoining] = useState(circle.joining);
  const [negative, setNegative] = useState(circle.settings.allowNegativeBalance);
  const [confirmation, setConfirmation] = useState(circle.settings.requireConfirmation);
  const [amend, setAmend] = useState(circle.settings.allowRejectCorrect);
  const [references, setReferences] = useState(circle.settings.references.length ? circle.settings.references : [{ name: "", value: "", note: "" }]);
  const [rules, setRules] = useState(circle.settings.rules.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function editReference(index: number, field: "name" | "value" | "note", value: string) {
    setReferences((current) => current.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function removeReference(index: number) {
    setReferences((current) => current.length === 1 ? [{ name: "", value: "", note: "" }] : current.filter((_, i) => i !== index));
  }

  async function save() {
    try {
      const nextCurrency = currency.trim();
      const nextRules = rules.split("\n").map((line) => line.trim()).filter(Boolean);
      const incompleteReference = references.find((item) => (item.name.trim() !== "") !== (item.value.trim() !== ""));
      if (!nextCurrency) { setError("互助额度名称不能为空"); return; }
      if (incompleteReference) { setError("每条参考物都需要同时填写名称和参考额度"); return; }
      if (nextRules.length > 10) { setError("圈子约定最多 10 条，请先合并或删除多余内容"); return; }
      setSaving(true);
      setError("");
      const response = await fetch(`/api/circles/${circle.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({
        currency: nextCurrency, tagline: tagline.trim(), joining,
        allowNegativeBalance: negative, requireConfirmation: confirmation, allowRejectCorrect: amend,
        references: references.filter((item) => item.name.trim()).map((item) => ({ name: item.name.trim(), value: item.value.trim(), note: item.note.trim() })),
        rules: nextRules,
      }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      await onSaved();
      onClose();
      onNotice("圈子设置已保存");
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  }

  return <Modal onClose={onClose} label={`${circle.name}设置`} wide>
    <div className="sheet-heading"><Pill color={circle.color}>圈主设置</Pill><h2>{circle.name}</h2></div>
    <div className="manual-form">
      <label><span>互助额度名称</span><input value={currency} maxLength={20} onChange={(e) => setCurrency(e.target.value)}/></label>
      <label><span>一句话介绍</span><textarea value={tagline} rows={2} maxLength={120} onChange={(e) => setTagline(e.target.value)}/></label>
      <span className="form-label">新成员怎么加入</span>
      <div className="manual-choice"><button className={joining === "direct" ? "active" : ""} onClick={() => setJoining("direct")}>受邀直接加入</button><button className={joining === "approval" ? "active" : ""} onClick={() => setJoining("approval")}>需要圈主审批</button></div>
    </div>
    <span className="form-label">记账规则</span>
    <div className="toggle-list">
      <label><span><b>允许负余额</b><small>可以先接受帮助</small></span><input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)}/></label>
      <label><span><b>记录需要对方确认</b><small>确认后入账</small></span><input type="checkbox" checked={confirmation} onChange={(e) => setConfirmation(e.target.checked)}/></label>
      <label><span><b>允许拒绝 / 更正</b><small>更改后重新计算</small></span><input type="checkbox" checked={amend} onChange={(e) => setAmend(e.target.checked)}/></label>
    </div>
    <span className="form-label">协商参考物（最多 8 条）</span>
    <div className="reference-editor-list">{references.map((item, index) => <div key={index}>
      <input value={item.name} placeholder="一晚住宿" onChange={(e) => editReference(index, "name", e.target.value)}/>
      <input value={item.value} placeholder={`约 10 ${currency}`} onChange={(e) => editReference(index, "value", e.target.value)}/>
      <input value={item.note} placeholder="说明（可选）" onChange={(e) => editReference(index, "note", e.target.value)}/>
      <button type="button" className="remove-reference" onClick={() => removeReference(index)} aria-label={`删除第 ${index + 1} 条参考物`}>删除</button>
    </div>)}</div>
    {references.length < 8 && <button className="text-link" onClick={() => setReferences([...references, { name: "", value: "", note: "" }])}>＋ 再加一条参考物</button>}
    <label className="typing-box"><span>圈子约定（一行一条，最多 10 条）</span><textarea rows={4} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={"可以开口，也可以拒绝\n允许负余额\n敏感互助可以不记录"}/></label>
    {error && <p className="account-error" role="alert">{error}</p>}
    <div className="sheet-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving} onClick={save}>{saving ? "正在保存…" : "保存设置"}</button></div>
  </Modal>;
}

// The editable part of a loop account: display name, bio and contact handle.
function EditProfileSheet({ member, onClose, onSaved, onNotice }: { member: Member; onClose: () => void; onSaved: () => Promise<void>; onNotice: (message: string) => void }) {
  const [name, setName] = useState(member.name);
  const [bio, setBio] = useState(member.bio);
  const [wechat, setWechat] = useState(member.wechat);
  const existingFace = parseFaceAvatar(member.avatar);
  const initialAbstract = ABSTRACT_AVATARS.includes(member.avatar as AbstractAvatarVariant) ? member.avatar as AbstractAvatarVariant : abstractAvatarFor(member.id);
  const [avatarMode, setAvatarMode] = useState<"abstract" | "face">(existingFace ? "face" : "abstract");
  const [abstractAvatar, setAbstractAvatar] = useState<AbstractAvatarVariant>(initialAbstract);
  const [face, setFace] = useState<FaceConfig>(existingFace ? { ...existingFace, accessory: "none" } : { ...DEFAULT_FACE_CONFIG });
  const [activeAvatarPart, setActiveAvatarPart] = useState<AvatarPart>("hair");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const avatar: AvatarVariant = avatarMode === "face" ? encodeFaceAvatar({ ...face, accessory: "none" }) : abstractAvatar;

  function randomizeFace() {
    setAvatarMode("face");
    setFace({ ...CURATED_FACE_PRESETS[Math.floor(Math.random() * CURATED_FACE_PRESETS.length)], accessory: "none" });
  }
  function visualChoice(key: string, label: string, patch: Partial<FaceConfig>, selected: boolean) {
    return <button key={key} type="button" aria-label={label} title={label} className={`avatar-visual-choice ${selected ? "selected" : ""}`} onClick={() => setFace((current) => ({ ...current, ...patch }))}><Character variant={encodeFaceAvatar({ ...face, ...patch })} color={member.color} small/></button>;
  }

  async function save() {
    try {
      if (!name.trim()) { setError("显示名称不能为空"); return; }
      setSaving(true);
      setError("");
      const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), bio: bio.trim(), wechat: wechat.trim(), avatar }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      await onSaved();
      onClose();
      onNotice("个人资料已保存");
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  }

  return <Modal onClose={onClose} label="编辑资料">
    <div className="sheet-heading"><Pill color="cream">{member.handle}</Pill><h2>我的跨圈身份</h2><p>用户名和地址由系统生成，不能修改。联系方式只对同圈成员显示。</p></div>
    <div className="manual-form">
      <label><span>显示名称</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)}/></label>
      <label><span>一句话介绍</span><input value={bio} maxLength={80} onChange={(e) => setBio(e.target.value)} placeholder="例如：喜欢把坏掉的东西拆开"/></label>
      <label><span>联系方式 / 微信号</span><input value={wechat} maxLength={60} onChange={(e) => setWechat(e.target.value)} placeholder="只对同圈成员显示"/></label>
    </div>
    <div className="avatar-customizer">
      <div className="avatar-customizer-preview"><div className="avatar-live-preview"><Character variant={avatar} color={member.color}/></div><div><span className="form-label">我的头像</span><p>{avatarMode === "abstract" ? "注册后默认使用系统几何图案，你也可以换一个。" : "自由选择发型、表情、眼镜和颜色。"}</p>{avatarMode === "face" && <div className="avatar-preview-actions"><button type="button" onClick={randomizeFace}>换一套搭配</button><button type="button" onClick={() => setFace({ ...DEFAULT_FACE_CONFIG })}>恢复默认脸</button></div>}</div></div>
      <div className="avatar-mode-row"><button type="button" className={avatarMode === "abstract" ? "selected" : ""} onClick={() => setAvatarMode("abstract")}>系统几何图案</button><button type="button" className={avatarMode === "face" ? "selected" : ""} onClick={() => setAvatarMode("face")}>定制我的脸</button></div>
      {avatarMode === "abstract" && <div className="avatar-part-controls"><section className="avatar-option-panel"><div className="avatar-visual-grid">{ABSTRACT_AVATARS.map((variant, index) => <button key={variant} type="button" aria-label={`系统几何图案 ${index + 1}`} className={`avatar-visual-choice ${abstractAvatar === variant ? "selected" : ""}`} onClick={() => setAbstractAvatar(variant)}><Character variant={variant} color={member.color} small/></button>)}</div></section></div>}
      {avatarMode === "face" && <div className="avatar-part-controls">
        <div className="avatar-part-tabs">{([['hair','发型'],['eyes','眼睛'],['glasses','眼镜'],['mouth','嘴巴'],['color','颜色']] as [AvatarPart,string][]).map(([part,label]) => <button key={part} type="button" className={activeAvatarPart === part ? "selected" : ""} onClick={() => setActiveAvatarPart(part)}>{label}</button>)}</div>
        <section className="avatar-option-panel">
          {activeAvatarPart === "hair" && <div className="avatar-visual-grid">{AVATAR_HAIRS.map((hair) => visualChoice(hair, AVATAR_PART_LABELS.hair[hair], { hair }, face.hair === hair))}</div>}
          {activeAvatarPart === "eyes" && <div className="avatar-visual-grid">{AVATAR_EYES.map((eyes) => visualChoice(eyes, AVATAR_PART_LABELS.eyes[eyes], { eyes }, face.eyes === eyes))}</div>}
          {activeAvatarPart === "glasses" && <div className="avatar-visual-grid">{AVATAR_GLASSES.map((glasses) => visualChoice(glasses, AVATAR_PART_LABELS.glasses[glasses], { glasses }, face.glasses === glasses))}</div>}
          {activeAvatarPart === "mouth" && <div className="avatar-visual-grid">{AVATAR_MOUTHS.map((mouth) => visualChoice(mouth, AVATAR_PART_LABELS.mouth[mouth], { mouth }, face.mouth === mouth))}</div>}
          {activeAvatarPart === "color" && <div className="avatar-color-options"><span>肤色</span><div className="avatar-visual-grid">{AVATAR_SKINS.map((skin) => visualChoice(`skin-${skin}`, AVATAR_PART_LABELS.skin[skin], { skin }, face.skin === skin))}</div><span>发色</span><div className="avatar-visual-grid">{AVATAR_HAIR_COLORS.map((hairColor) => visualChoice(`hair-${hairColor}`, AVATAR_PART_LABELS.hairColor[hairColor], { hairColor }, face.hairColor === hairColor))}</div></div>}
        </section>
      </div>}
    </div>
    <div className="detail-meta"><div><span>用户名</span><b>{member.handle}</b></div><div><span>地址</span><b>{member.address ? `${member.address.slice(0, 10)}…` : "—"}</b></div></div>
    {error && <p className="account-error" role="alert">{error}</p>}
    <div className="sheet-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving} onClick={save}>{saving ? "正在保存…" : "保存"}</button></div>
  </Modal>;
}
