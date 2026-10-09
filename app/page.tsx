"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import type { AbstractAvatarVariant, AvatarVariant, Circle, Color, DiscoverableCircle, GoodCard, JoinRequest, Listing, Member, Revision, Transaction } from "./types";
import { composeDraftKey, readComposeDraft, writeComposeDraft, clearComposeDraft } from "./lib/compose-draft";
import { listingDisplayCircleIds } from "./lib/listing-scope";
import { parseFaceAvatar } from "./lib/avatar";
import { parsePartnerAvatar } from "./lib/partner-avatar";
import { AvatarWorkshop } from "./components/avatar-workshop";
import { FaceAvatarArtwork } from "./components/face-avatar";
import { AbstractAvatarArtwork } from "./components/abstract-avatar";
import { BrandGlyph, FlowIcon, CircleGlyph, NotificationIcon, NavIcon, CIRCLE_ICON_GROUPS, CIRCLE_ICON_LABELS, type CircleIconKey } from "./components/identity";
import { toRevision, type AppDatabase, type LoopRevision } from "../db/runtime";
import type { ComposeInput } from "./api/records/route";

type View = "feed" | "discover" | "circle" | "me" | "profile" | "about" | "create";
type ComposerType = "record" | "need" | "offer" | "card";
type FeedFilter = "all" | "trade" | "need" | "offer" | "card";
type DiscoverFilter = "all" | "need" | "offer" | "circles";
type ProfileTab = "cards" | "listings" | "transactions";
type NotificationDestination = "members" | "transactions" | "cards" | "circle";
type Overlay = "share" | "postShare" | "circlePreview" | "rules" | "members" | "invite" | "feedFilter" | "post" | "circleSettings" | "editProfile" | "notifications" | null;
type TransactionDialog = { kind: "edit" | "revoke"; transaction: Transaction; currency: string };

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
  /** every circle this entry is visible in — a listing can span several */
  circleIds: string[];
  source: "listing" | "card" | "transaction";
  sourceId: string;
};

function GenderSymbol({ member }: { member?: Member }) {
  return member?.gender ? <span className="gender-symbol" aria-label={member.gender === "male" ? "男" : "女"}> {member.gender === "male" ? "♂" : "♀"}</span> : null;
}

function canSharePost(post: Post): boolean {
  if (post.source === "listing") {
    const listing = activeDb.listings.find((item) => item.id === post.sourceId);
    return listing?.memberId === activeDb.currentMemberId && listing.status === "active";
  }
  if (post.source === "transaction") {
    const record = activeDb.transactions.find((item) => item.id === post.sourceId);
    return Boolean(record && !record.redacted && !record.pendingCorrection && !record.pendingRevision && (record.providerId === activeDb.currentMemberId || record.receiverId === activeDb.currentMemberId) && (record.status === "confirmed" || record.status === "corrected"));
  }
  if (post.source === "card") {
    const card = activeDb.goodCards.find((item) => item.id === post.sourceId);
    return card?.toMemberId === activeDb.currentMemberId;
  }
  return false;
}

function sharePostForListing(listing: Listing): Post {
  const author = memberById(listing.memberId);
  const scope = listing.visibility === "cross-circle" ? "跨圈公开" : listing.circleIds.map((id) => circleById(id)?.name).filter(Boolean).join("、");
  return { id: `listing:${listing.id}`, kind: listing.type, badge: listing.type === "need" ? "我想要" : "我可以给", person: author.name, caption: author.handle, memberId: author.id, avatar: author.initial, avatarVariant: author.avatar, color: listing.type === "need" ? "pink" : "green", text: listing.detail || listing.title, meta: scope, circleIds: listingDisplayCircleIds(listing, memberById(listing.memberId).circleIds), source: "listing", sourceId: listing.id };
}

function sharePostForTransaction(record: Transaction): Post {
  const me = memberById(activeDb.currentMemberId);
  const circle = circleById(record.circleId) ?? EMPTY_CIRCLE;
  return { id: `transaction:${record.id}`, kind: "trade", badge: "互助记录", person: `${me.name}的互助记录`, caption: me.handle, memberId: me.id, avatar: me.initial, avatarVariant: me.avatar, color: "yellow", text: record.story || record.title, meta: `${circle.name} · ${record.amount} ${circle.currency}`, circleIds: [circle.id], source: "transaction", sourceId: record.id };
}

function sharePostForCard(card: GoodCard): Post {
  const from = memberById(card.fromMemberId);
  const to = memberById(card.toMemberId);
  const circle = circleById(card.circleId);
  return { id: `card:${card.id}`, kind: "card", badge: "好人好事", person: `${from.name}写给${to.name}`, caption: to.handle, memberId: to.id, avatar: to.initial, avatarVariant: to.avatar, color: "coral", text: card.story, meta: [card.date, circle?.name].filter(Boolean).join(" · "), circleIds: card.circleId ? [card.circleId] : [], source: "card", sourceId: card.id };
}

// Empty world until the loop-backend session loads — no demo/default user.
const initialDb: AppDatabase = { members: [], circles: [], accounts: [], listings: [], goodCards: [], transactions: [], activity: [], joinRequests: [], pendingCircles: [], notifications: [], unreadNotifications: 0, settings: { publicCards: true, publicListings: true, keepHiddenPrivate: true }, session: { authenticated: false }, currentMemberId: "" };
const EMPTY_SETTINGS: Circle["settings"] = { allowNegativeBalance: false, requireConfirmation: false, allowRejectCorrect: false, references: [], rules: [] };
const EMPTY_CIRCLE: Circle = { id: "", name: "", short: "•", color: "green", currency: "积分", members: 0, tagline: "", joining: "direct", discoverability: "unknown", settings: EMPTY_SETTINGS, ownerId: "", isMember: false, memberIds: [], stats: null };
let activeDb = initialDb;
let members = activeDb.members;
let circles = activeDb.circles;

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
      result.push({ id: postId, kind: listing.type, badge: listing.type === "need" ? "我想要" : "我可以给", person: member.name, caption: member.handle, memberId: member.id, avatar: member.initial, avatarVariant: member.avatar, color: listing.type === "need" ? "pink" : "green", text: listing.detail || listing.title, meta: scope, circleIds: listingDisplayCircleIds(listing, memberById(listing.memberId).circleIds), source: activity.source, sourceId: listing.id });
      continue;
    }
    if (activity.source === "card") {
      const card = activeDb.goodCards.find((item) => item.id === activity.sourceId);
      const from = activeDb.members.find((item) => item.id === card?.fromMemberId);
      const to = activeDb.members.find((item) => item.id === card?.toMemberId);
      if (!card || !from || !to) continue;
      result.push({ id: postId, kind: "card", badge: "好人好事", person: `${from.name} → ${to.name}`, caption: card.visibility === "cross-circle" ? "跨圈公开" : "已隐藏", memberId: to.id, avatar: to.initial, avatarVariant: to.avatar, color: "coral", text: card.story, meta: `${card.date} · 被好好看见`, circleIds: card.circleId ? [card.circleId] : [], source: activity.source, sourceId: card.id });
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
    result.push({ id: postId, kind: hidden ? "mystery" : "trade", badge: hidden ? "神秘记录" : pending ? "待确认" : "互助完成", person: hidden ? "圈里发生了一次互助" : `${provider!.name} → ${receiver!.name}`, caption: hidden ? "身份与故事已隐藏" : pending ? "等待另一方确认" : transaction.visibility === "private" ? "仅当事人" : transaction.visibility === "mystery" ? "神秘记录 · 事情仅当事人可见" : "圈内公开", memberId: hidden ? undefined : provider!.id, avatar: hidden ? "?" : provider!.initial, avatarVariant: hidden ? "crop" : provider!.avatar, color: hidden ? "blue" : "yellow", text: hidden ? "参与者和故事选择了隐藏。" : transaction.story || transaction.title, meta: `${circle.name} · ${transaction.amount} ${circle.currency}`, circleIds: [circle.id], source: activity.source, sourceId: transaction.id });
  }
  return result;
}

let posts = buildPosts();

const intents: { id: ComposerType; label: string; color: Color; }[] = [
  { id: "record", label: "记一笔互助", color: "yellow" },
  { id: "card", label: "记录好事", color: "blue" },
  { id: "need", label: "我想要", color: "pink" },
  { id: "offer", label: "我可以给", color: "green" },
];

function Character({ member, text, color = "yellow", variant = "crop", small = false }: { member?: Member; text?: string; color?: Color; variant?: AvatarVariant; small?: boolean }) {
  const active = member ?? { initial: text ?? "友", color, avatar: variant };
  const symbolOnly = !member && Boolean(text);
  const partner = parsePartnerAvatar(active.avatar);
  const face = parseFaceAvatar(active.avatar);
  const avatarClasses = partner ? "avatar-partner" : face
    ? `avatar-custom avatar-skin-${face.skin} avatar-shape-${face.shape} avatar-hair-${face.hair} avatar-hair-color-${face.hairColor} avatar-eyes-${face.eyes} avatar-glasses-${face.glasses} avatar-mouth-${face.mouth}`
    : `avatar-abstract face-${active.avatar}`;
  return <span className={`character character-${active.color} ${avatarClasses} ${symbolOnly ? "character-symbol" : ""} ${small ? "character-small" : ""}`} aria-hidden="true">{symbolOnly
    ? <span className="character-mark"><FlowIcon kind="mystery"/></span>
    : partner ? <AbstractAvatarArtwork variant={partner.shape} expression={partner.expression} color={partner.color} accentColor={partner.accentColor}/> : face
      ? <FaceAvatarArtwork config={face}/>
      : <AbstractAvatarArtwork variant={active.avatar as AbstractAvatarVariant}/>}</span>;
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
    {error && <p className="account-error" role="alert">{error}</p>}
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

// Shown when a refetch fails while the person is still signed in. The world on
// screen may be stale, but a backend blip must not fall back to the sign-in
// gate and ask for another OTP.
function SessionRetryBar({ onRetry }: { onRetry: () => void }) {
  return <div className="session-retry" role="status">
    <span>数据没能刷新，你仍然处于登录状态。</span>
    <button onClick={onRetry}>重试</button>
  </div>;
}

export default function Home() {
  const [db, setDb] = useState<AppDatabase>(initialDb);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("feed");
  // No seeded ids: the active circle/member/post are whatever the loaded world
  // and the user's own clicks say they are.
  const [circleId, setCircleId] = useState("");
  const [feedCircleId, setFeedCircleId] = useState("all");
  const [discoverCircleId, setDiscoverCircleId] = useState("");
  const [composer, setComposer] = useState(false);
  const [intent, setIntent] = useState<ComposerType>("record");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [profileTab, setProfileTab] = useState<ProfileTab>("listings");
  const [profileCircleId, setProfileCircleId] = useState("all");
  const [previewCircleId, setPreviewCircleId] = useState("");
  const [composerOtherId, setComposerOtherId] = useState("");
  // The record a notification pointed at; the profile archive scrolls to it.
  const [focusRecordId, setFocusRecordId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [postContactRequested, setPostContactRequested] = useState(false);
  const [publishedShare, setPublishedShare] = useState<{ source: "listing" | "transaction"; id: string } | null>(null);
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
  const viewContentRef = useRef<HTMLDivElement>(null);

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

  // A failed refetch while signed in is a stale screen, not a logout: keep the
  // last good world visible and offer a retry.
  async function retryLoad() {
    try { await refreshData(); } catch { /* the banner stays until a load succeeds */ }
  }

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

  async function joinCircle(circle: DiscoverableCircle): Promise<boolean> {
    if (circle.pending) { await withdrawRequest(circle); return false; }
    try {
      const response = await fetch(`/api/circles/${circle.id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "加入失败");
      await syncAfterWrite();
      flash(result.status === "pending" ? `已申请加入${circle.name}，等待圈主确认` : `已加入${circle.name}`);
      return true;
    } catch (error) { flash(error instanceof Error ? error.message : "加入失败"); return false; }
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
      // loop refuses with a reason (社区货币余额不足 / 要先转让圈主) — show it as-is.
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

  // After signing in from an invite (`/?join=<token>`, the invite page's
  // "先登录" link), go back to that invite's preview. Joining stays an explicit
  // click there — signing in never accepts an invite by itself.
  useEffect(() => {
    if (!db.session.authenticated) return;
    const joinToken = new URLSearchParams(window.location.search).get("join");
    if (!joinToken) return;
    window.location.replace(`/join/${encodeURIComponent(joinToken)}`);
  }, [db.session.authenticated]);

  // A shared profile URL opens the same in-page profile after the recipient
  // has an authenticated session. Profile data still comes from the normal
  // bootstrap visibility rules; the query parameter is only navigation state.
  useEffect(() => {
    if (!db.session.authenticated || view === "profile") return;
    const profileId = new URLSearchParams(window.location.search).get("profile");
    if (!profileId) return;
    const timer = window.setTimeout(() => {
      window.history.replaceState({}, "", "/");
      if (!db.members.some((member) => member.id === profileId)) {
        flash("这个成员档案对你不可见，或链接已经失效");
        return;
      }
      setSelectedMemberId(profileId);
      setProfileTab("listings");
      setProfileCircleId("all");
      setView(profileId === db.currentMemberId ? "me" : "profile");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [db.members, db.currentMemberId, db.session.authenticated, view]);

  const activeCircle = circles.find((item) => item.id === circleId) ?? circles[0] ?? EMPTY_CIRCLE;
  const activeAccount = accountFor(currentMemberId, activeCircle.id);
  const pageScopeId = view === "feed" ? feedCircleId : view === "discover" ? discoverCircleId : view === "circle" ? activeCircle.id : view === "me" || view === "profile" ? profileCircleId : "";
  useEffect(() => {
    viewContentRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [view, pageScopeId, feedFilter, discoverFilter]);
  const selectedMember = memberById(selectedMemberId);
  const profileNavCircles = circles.filter((item) => memberById(currentMemberId).circleIds.includes(item.id) && (view !== "profile" || selectedMember.circleIds.includes(item.id)));
  const navCircleId = view === "me" || view === "profile" ? profileCircleId : view === "circle" ? activeCircle.id : view === "discover" ? discoverCircleId : feedCircleId;
  const selectedPost = posts.find((post) => post.id === selectedPostId);
  const profileComposerCircleId = profileCircleId !== "all" ? profileCircleId : profileNavCircles[0]?.id ?? activeCircle.id;
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
    if (discoverCircleId && !post.circleIds.includes(discoverCircleId)) return false;
    if (discoverFilter === "all" || discoverFilter === "circles") return true;
    return post.kind === discoverFilter;
  }), [db, discoverFilter, discoverCircleId]);

  const toastTimer = useRef(0);
  function flash(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }

  // Auth gate: wait for the first bootstrap, then require a loop-backend session.
  if (!loaded) return <main className="login-splash"><section className="join-card" role="status"><BrandGlyph large/><h1>让关系，自在流动。</h1><p>正在连接流动圈…</p></section></main>;
  if (!db.session.authenticated) {
    if (loadFailed) return <main className="login-splash"><div className="join-card"><BrandGlyph large/><h1>稍等一下，马上重逢。</h1><p>连不上流动圈的数据服务。你没有被登出，稍后再试一次就好。</p><button className="primary-button" onClick={() => { setLoaded(false); refreshData().catch(() => {}).finally(() => setLoaded(true)); }}>重试</button></div></main>;
    return <LoginGate onDone={async () => { setLoaded(false); try { await refreshData(); } finally { setLoaded(true); } }}/>;
  }

  function openComposer(nextIntent: ComposerType = "record", otherId = "") {
    setIntent(nextIntent); setComposerOtherId(otherId); setComposer(true);
  }

  function selectCircle(id: string, nextView?: View) {
    if ((view === "me" || view === "profile") && !nextView) {
      setProfileCircleId(id);
      return;
    }
    setCircleId(id);
    if (view === "discover" && !nextView) {
      setDiscoverCircleId(id);
      setView("discover");
      return;
    }
    setFeedCircleId(id);
    setView(nextView ?? (view === "circle" ? "circle" : "feed"));
  }

  function showAllCircles() {
    if (view === "me" || view === "profile") { setProfileCircleId("all"); return; }
    setFeedCircleId("all"); setView("feed");
  }

  function showAllDiscoverCircles() {
    if (view === "discover") { setDiscoverCircleId(""); return; }
    showAllCircles();
  }

  function openFeed() {
    if (view === "discover" && discoverCircleId) {
      setCircleId(discoverCircleId);
      setFeedCircleId(discoverCircleId);
    }
    setView("feed");
  }

  function openDiscover() {
    setDiscoverCircleId("");
    setView("discover");
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

  function openProfile(id?: string, tab: ProfileTab = "listings") {
    if (!id) return;
    setSelectedMemberId(id);
    setProfileTab(tab);
    const person = memberById(id);
    const sourceCircleId = view === "feed" ? feedCircleId : view === "circle" ? activeCircle.id : view === "me" || view === "profile" ? profileCircleId : "all";
    setProfileCircleId(sourceCircleId !== "all" && person.circleIds.includes(sourceCircleId) && memberById(currentMemberId).circleIds.includes(sourceCircleId) ? sourceCircleId : "all");
    setOverlay(null);
    setView(id === currentMemberId ? "me" : "profile");
  }

  function openPost(id: string, contact = false) {
    setSelectedPostId(id); setPostContactRequested(contact); setOverlay("post");
  }

  function openPostShare(id: string) {
    const post = posts.find((item) => item.id === id);
    if (!post || !canSharePost(post)) return;
    const record = post.source === "transaction" ? activeDb.transactions.find((item) => item.id === post.sourceId) : null;
    const card = post.source === "card" ? activeDb.goodCards.find((item) => item.id === post.sourceId) : null;
    setSharePost(record ? sharePostForTransaction(record) : card ? sharePostForCard(card) : post); setOverlay("postShare");
  }

  function openArchiveShare(source: "listing" | "transaction" | "card", id: string) {
    let post: Post | null = null;
    if (source === "listing") {
      const listing = activeDb.listings.find((entry) => entry.id === id);
      if (listing) post = sharePostForListing(listing);
    } else if (source === "transaction") {
      const record = activeDb.transactions.find((entry) => entry.id === id);
      if (record) post = sharePostForTransaction(record);
    } else {
      const card = activeDb.goodCards.find((entry) => entry.id === id);
      if (card) post = sharePostForCard(card);
    }
    if (!post || !canSharePost(post)) { flash("这条内容暂时不能分享"); return; }
    setSharePost(post); setOverlay("postShare");
  }

  function openNotification(destination: NotificationDestination, targetCircleId?: string, recordId?: string) {
    if (targetCircleId && circles.some((circle) => circle.id === targetCircleId)) {
      setCircleId(targetCircleId);
      setFeedCircleId(targetCircleId);
    }
    if (destination === "members") { setView("circle"); setOverlay("members"); return; }
    if (destination === "circle") { setView("circle"); setOverlay(null); return; }
    setSelectedMemberId(currentMemberId);
    setProfileTab(destination === "cards" ? "cards" : "transactions");
    setProfileCircleId(targetCircleId || "all");
    setFocusRecordId(destination === "transactions" && recordId ? recordId : null);
    setOverlay(null);
    setView("me");
  }

  async function submitCompose(input: ComposeInput) {
    const response = await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json() as { error?: string; id?: string };
    if (!response.ok) throw new Error(result.error || "保存失败");
    // Close first: the entry is already saved, and leaving the draft up with a
    // live 确认发布 button is exactly how you get two identical ledger entries.
    clearComposeDraft(composeDraftKey(currentMemberId, input.intent));
    setComposer(false);
    await syncAfterWrite();
    if (result.id && (input.intent === "need" || input.intent === "offer")) setPublishedShare({ source: "listing", id: result.id });
    flash(input.intent === "record" ? "互助已入账，修改或撤销需对方同意" : input.intent === "card" ? "这件好事已记录在对方的跨圈主页" : "已经发布，可以分享这条内容");
  }

  if (circles.length === 0 && view !== "create") {
    return <>{loadFailed && <SessionRetryBar onRetry={retryLoad}/>}<AccountStartView member={memberById(currentMemberId)} openCircles={openCircles} pendingCircles={db.pendingCircles} onSaved={syncAfterWrite} onJoin={joinCircle} onWithdraw={withdrawRequest} onCreate={openCreateCircle} onLogout={logout}/></>;
  }

  return <main className="world-shell">
    {loadFailed && <SessionRetryBar onRetry={retryLoad}/>}
    <aside className="circle-dock" aria-label="我的圈子地图">
      <button className={`brand-mark ${view === "about" ? "active" : ""}`} onClick={() => setView("about")} aria-label="了解流动圈"><BrandGlyph large/><span className="brand-copy"><strong>流动圈</strong><b>FLOW CIRCLE · 了解我们 →</b></span></button>
      <div className="dock-heading"><span>我的地图</span><b>{String(circles.length).padStart(2,"0")}</b></div>
      <button className={`dock-all ${feedCircleId === "all" && view === "feed" ? "active" : ""}`} onClick={showAllCircles}><NavIcon kind="feed"/><b>全部圈子动态</b><strong>{posts.length}</strong></button>
      <div className="dock-list">{(view === "profile" ? profileNavCircles : circles.filter((item) => memberById(currentMemberId).circleIds.includes(item.id))).map((item) => { const account = accountFor(currentMemberId, item.id); return <button key={item.id} className={`dock-circle dock-${item.color} ${navCircleId === item.id ? "active" : ""}`} onClick={() => selectCircle(item.id)}><CircleGlyph icon={item.short} seed={item.id} size="small"/><span><b>{item.name}</b><small>{item.currency}</small></span>{view !== "profile" && <strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong>}</button>; })}</div>
      <button className="new-circle" onClick={openCreateCircle}><b>＋</b><span>创建新圈子</span></button><div className="dock-note"><p>让帮助被记得。<br/>让关系，自在流动。</p><span>SMALL ACTS, REAL CONNECTIONS.</span></div>
    </aside>

    <section className="phone-stage">
      <div className={`app-frame ${view === "about" || view === "create" ? "about-open" : ""}`}>
        <header className="topbar"><button className={`brand-mini ${view === "about" ? "active" : ""}`} onClick={() => setView("about")} aria-label="了解流动圈"><BrandGlyph/></button><div><p>{view === "about" ? "FLOW CIRCLE · 产品概念" : view === "create" ? "NEW CIRCLE · 创建向导" : view === "me" ? "我的档案" : view === "profile" ? "成员档案" : "我的圈子动态"}</p><h1>{view === "about" ? "关于流动圈" : view === "create" ? "创建新圈子" : view === "me" ? "我的" : view === "profile" ? `${selectedMember.name}的档案` : `你好，${memberById(currentMemberId).name}！`}</h1></div><button className="bell-button" onClick={() => setOverlay("notifications")} aria-label={`通知${db.unreadNotifications > 0 ? `，${db.unreadNotifications} 条未读` : ""}`}><NotificationIcon/>{db.unreadNotifications > 0 && <i>{db.unreadNotifications > 9 ? "9+" : db.unreadNotifications}</i>}</button><button className="avatar-button" onClick={() => { setProfileCircleId("all"); setView("me"); }} aria-label="打开我的主页"><Character member={memberById(currentMemberId)}/></button></header>
        {view !== "about" && view !== "create" && <nav className="circle-switcher" aria-label={view === "profile" ? "筛选共同圈子" : view === "me" ? "筛选我的档案" : view === "circle" ? "切换圈子主页" : view === "discover" ? "筛选发现圈子" : "切换动态范围"}>
          <button className={`all-switch ${view === "me" || view === "profile" ? profileCircleId === "all" ? "selected" : "" : view === "feed" && feedCircleId === "all" || view === "discover" && !discoverCircleId ? "selected" : ""}`} onClick={showAllDiscoverCircles}><NavIcon kind="feed"/><span>{view === "profile" ? "全部共同圈" : view === "circle" ? "全部圈子动态" : "全部圈子"}</span>{view === "profile" && <b>{profileNavCircles.length}</b>}</button>
          {(view === "profile" ? profileNavCircles : circles.filter((item) => memberById(currentMemberId).circleIds.includes(item.id))).map((item) => { const account = accountFor(currentMemberId, item.id); return <button key={item.id} className={navCircleId === item.id ? "selected" : ""} onClick={() => selectCircle(item.id)}><CircleGlyph icon={item.short} seed={item.id} size="tiny"/><span>{item.name}</span>{view !== "profile" && <b>{account.balance > 0 ? "+" : ""}{account.balance}</b>}</button>; })}
        </nav>}
        <div className="view-content" ref={viewContentRef}>
          {publishedShare && <div className="published-share"><span>发布成功，想让更多人看到吗？</span><button onClick={() => { openArchiveShare(publishedShare.source, publishedShare.id); setPublishedShare(null); }}>分享这条内容</button><button aria-label="关闭分享提示" onClick={() => setPublishedShare(null)}>×</button></div>}
          {view === "about" && <AboutView onExplore={showAllCircles} onCreate={openCreateCircle} onCircle={(id) => selectCircle(id, "circle")}/>}
          {view === "create" && <CreateCircleView key={createSession} onExit={() => setView("me")} onDone={async (input) => {
            const response=await fetch("/api/circles",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)}); const result=await response.json() as {error?:string};
            if(!response.ok) throw new Error(result.error||"创建失败");
            // The circle exists from here on. A failed refetch must not surface
            // as a failed creation, or the user retries and makes a duplicate.
            await syncAfterWrite();
            flash(`${input.name}已经创建，可以邀请成员了`);
          }}/>}
          {view === "feed" && <FeedView activeCircle={activeCircle} isAllCircles={feedCircleId === "all"} posts={feedPosts} filter={feedFilter} onCompose={() => openComposer()} onProfile={openProfile} onShare={openPostShare} onFilter={() => setOverlay("feedFilter")} onPost={openPost}/>}
          {view === "discover" && <DiscoverView posts={discoverPosts} filter={discoverFilter} setFilter={setDiscoverFilter} openCircles={openCircles} onPreview={(id) => { setPreviewCircleId(id); setOverlay("circlePreview"); }} onSpeak={openComposer} onProfile={openProfile} onShare={openPostShare} onPost={openPost}/>}
          {view === "circle" && <CircleView circle={activeCircle} account={activeAccount} posts={posts.filter((post) => post.circleIds.includes(activeCircle.id))} visibleTradeCount={db.transactions.filter((record) => record.circleId === activeCircle.id && (record.status === "confirmed" || record.status === "corrected")).length} openCircles={openCircles} isOwner={isCircleOwner} pendingCount={db.joinRequests.filter((r) => r.circleId === activeCircle.id).length} onProfile={openProfile} onShare={openPostShare} onPost={openPost} onRules={() => setOverlay("rules")} onMembers={() => setOverlay("members")} onInvite={() => setOverlay("invite")} onSettings={() => setOverlay("circleSettings")} onDiscover={() => { setDiscoverCircleId(""); setDiscoverFilter("circles"); setView("discover"); }} onPreview={(id) => { setPreviewCircleId(id); setOverlay("circlePreview"); }} onCreate={openCreateCircle}/>}
          {view === "me" && <ProfilePage key={`${currentMemberId}-${profileTab}`} member={memberById(currentMemberId)} circleScopeId={profileCircleId} initialTab={profileTab} focusRecordId={focusRecordId} onNotice={flash} onChanged={syncAfterWrite} onSelectCircle={(id) => selectCircle(id)} onShareItem={openArchiveShare} onPublish={openComposer} onEdit={() => setOverlay("editProfile")} onShare={() => setOverlay("share")} onRecord={() => openComposer("record")} onPreview={() => {}}/>}
          {view === "profile" && selectedMember.id && <ProfilePage key={`${selectedMember.id}-${profileTab}`} member={selectedMember} circleScopeId={profileCircleId} initialTab={profileTab} focusRecordId={null} onNotice={flash} onChanged={syncAfterWrite} onSelectCircle={(id) => selectCircle(id)} onShareItem={openArchiveShare} onPublish={openComposer} onEdit={() => {}} onShare={() => {}} onRecord={() => openComposer("record", selectedMember.id)} onPreview={(id) => { setPreviewCircleId(id); setOverlay("circlePreview"); }}/>}
        </div>
        <nav className="bottom-nav" aria-label="主要导航">
          <button aria-current={view === "feed" ? "page" : undefined} className={view === "feed" ? "active" : ""} onClick={openFeed}><NavIcon kind="feed"/><small>动态</small></button>
          <button aria-current={view === "discover" ? "page" : undefined} className={view === "discover" ? "active" : ""} onClick={openDiscover}><NavIcon kind="discover"/><small>发现</small></button>
          <button className="compose-slot" onClick={() => openComposer()} aria-label="打开记录菜单"><NavIcon kind="record"/><small>记录</small></button>
          <button aria-current={view === "circle" ? "page" : undefined} className={view === "circle" ? "active" : ""} onClick={() => setView("circle")}><NavIcon kind="circle"/><small>圈子</small></button>
          <button aria-current={view === "me" ? "page" : undefined} className={view === "me" ? "active" : ""} onClick={() => { setProfileCircleId("all"); setProfileTab("listings"); setView("me"); }}><NavIcon kind="me"/><small>我的</small></button>
        </nav>
      </div>
    </section>

    <aside className="world-panel" aria-label="圈子概览">
      <div className="world-card world-card-main"><span className="world-kicker">LIFE IN YOUR CIRCLES</span><h2>圈里有<br/><em>{posts.length} 件事</em>在流动</h2><div className="world-stats"><span><b>{posts.filter((post) => post.kind === "need" || post.kind === "offer").length}</b>需要 / 提供</span><span><b>{posts.filter((post) => post.kind === "trade" || post.kind === "mystery").length}</b>互助记录</span><span><b>{posts.filter((post) => post.kind === "card").length}</b>件好人好事</span></div></div>
      <button className="world-card value-card value-card-button" onClick={() => { setView("circle"); setOverlay("rules"); }}><span className="world-kicker">互助参考</span><h3>{activeCircle.name}</h3>{activeCircle.settings.references.slice(0,2).map((item) => <div key={item.name}><b>{item.name}</b><span>{item.value}</span></div>)}<p>查看规则 →</p></button>
      <div className="world-rule"><b>可以问，<br/>也可以拒绝。</b><span>NO PRESSURE · NO RANKING</span></div>
    </aside>

    {composer && <ComposerSheet key={`${currentMemberId}:${intent}`} circleId={view === "me" || view === "profile" ? profileComposerCircleId : activeCircle.id} initialOtherId={composerOtherId} intent={intent} setIntent={setIntent} onClose={() => setComposer(false)} onSubmit={submitCompose} onNotice={flash}/>}
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
    {overlay === "postShare" && sharePost && canSharePost(sharePost) && <PostShareSheet post={sharePost} onClose={() => setOverlay(null)} onNotice={flash}/>}
    {overlay === "circlePreview" && previewCircleId && <CirclePreviewSheet circleId={previewCircleId} onClose={() => setOverlay(null)} onJoin={async (circle) => { if (await joinCircle(circle)) setOverlay(null); }}/>}
    {overlay === "rules" && <RulesSheet circle={activeCircle} onClose={() => setOverlay(null)}/>}
    {overlay === "members" && <MembersSheet circle={activeCircle} requests={db.joinRequests.filter((r) => r.circleId === activeCircle.id)} isOwner={isCircleOwner} onProfile={openProfile} onInvite={() => openSubSheet("invite")} onClose={closeOverlay} onResolve={resolveRequest} onLeave={leaveCircle} onTransfer={transferOwner}/>}
    {overlay === "invite" && <InviteSheet circle={activeCircle} onClose={closeOverlay} onNotice={flash}/>}
    {overlay === "feedFilter" && <FeedFilterSheet active={feedFilter} onSelect={(next) => { setFeedFilter(next); setOverlay(null); }} onClose={() => setOverlay(null)}/>}
    {overlay === "post" && selectedPost && <PostSheet key={`${selectedPost.id}:${postContactRequested}`} post={selectedPost} contactRequested={postContactRequested} onProfile={() => selectedPost.memberId && openProfile(selectedPost.memberId)} onShare={() => openPostShare(selectedPost.id)} onNotice={flash} onClose={() => setOverlay(null)}/>}
    {overlay === "notifications" && <NotificationsSheet notifications={db.notifications} onClose={() => { setOverlay(null); if (db.unreadNotifications > 0) void markNotificationsRead(); }} onOpen={openNotification}/>}
    {overlay === "circleSettings" && <CircleSettingsSheet circle={activeCircle} onClose={() => setOverlay(null)} onSaved={syncAfterWrite} onNotice={flash}/>}
    {overlay === "editProfile" && <EditProfileSheet member={memberById(currentMemberId)} onClose={() => setOverlay(null)} onSaved={syncAfterWrite} onNotice={flash}/>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}

// Shown while the signed-in user belongs to no circle yet: fill in the profile,
// then either create a circle or join an open one.
function AccountStartView({ member, openCircles, pendingCircles, onSaved, onJoin, onWithdraw, onCreate, onLogout }: { member: Member; openCircles: DiscoverableCircle[]; pendingCircles: DiscoverableCircle[]; onSaved: () => Promise<void>; onJoin: (circle: DiscoverableCircle) => Promise<boolean>; onWithdraw: (circle: DiscoverableCircle) => Promise<void>; onCreate: () => void; onLogout: () => void }) {
  const [name,setName]=useState(member.name);
  const [bio,setBio]=useState(member.bio);
  const [wechat,setWechat]=useState(member.wechat);
  const [gender,setGender]=useState<Member["gender"]>(member.gender ?? null);
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
      const response=await fetch("/api/profile",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({name:name.trim(),bio:bio.trim(),wechat:wechat.trim(),gender})});
      const result=await response.json() as {error?:string};
      if(!response.ok) throw new Error(result.error||"保存失败");
      const checked = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!checked.ok) throw new Error("资料已提交，暂时无法核对性别是否保存。请刷新确认。");
      const world = await checked.json() as AppDatabase;
      if ((world.members.find((item) => item.id === member.id)?.gender ?? null) !== gender)
        throw new Error("性别未保存，后端尚未支持此字段。请保留选择，稍后重试。");
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
      <label><span>性别</span><select value={gender ?? ""} onChange={(event) => edit(setGender)(event.target.value === "male" ? "male" : event.target.value === "female" ? "female" : null)}><option value="">不显示</option><option value="male">男 ♂</option><option value="female">女 ♀</option></select></label>
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
    { number: "01", title: "圈子", color: "pink", text: "独立的成员、规则和社区货币。" },
    { number: "02", title: "社区货币", color: "yellow", text: "记录已经完成的互助。" },
    { number: "03", title: "需要 / 提供", color: "green", text: "发布正在寻找或可以给出的事。" },
    { number: "04", title: "好人好事", color: "blue", text: "留下一段感谢。" },
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
  return <section className="compose-banner"><h2><span>小小互助，</span><span>都值得被记得。</span></h2><button className="hero-compose" onClick={onCompose}>记一笔 <span aria-hidden="true">↗</span></button></section>;
}

function FeedView({ activeCircle, isAllCircles, posts: list, filter, onCompose, onProfile, onShare, onFilter, onPost }: { activeCircle: Circle; isAllCircles: boolean; posts: Post[]; filter: FeedFilter; onCompose: () => void; onProfile: (id?: string, tab?: ProfileTab) => void; onShare: (id: string) => void; onFilter: () => void; onPost: (id: string) => void }) {
  const labels: Record<FeedFilter,string> = { all: "全部动态", trade: "互助记录", need: "只看需要", offer: "只看提供", card: "好人好事" };
  const scopeTitle = isAllCircles ? "全部圈子" : activeCircle.name;
  return <><ComposeHero onCompose={onCompose}/><section className="scope-banner"><span>{isAllCircles ? "综合动态" : "当前圈子"}</span><b>{scopeTitle}</b><small>{list.length} 条</small></section><SectionTitle eyebrow="LIVE FROM THE CIRCLE" title={`${scopeTitle} · ${labels[filter]}`} action={`筛选 · ${list.length}`} onAction={onFilter}/><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>;
}

function DiscoverView({ posts: list, filter, setFilter, openCircles, onPreview, onSpeak, onProfile, onShare, onPost }: { posts: Post[]; filter: DiscoverFilter; setFilter: (filter: DiscoverFilter) => void; openCircles: DiscoverableCircle[]; onPreview: (id: string) => void; onSpeak: (intent?: ComposerType) => void; onProfile: (id?: string) => void; onShare: (id: string) => void; onPost: (id: string) => void }) {
  const options: {id: DiscoverFilter; label: string}[] = [{id:"all",label:"全部"},{id:"need",label:"我想要"},{id:"offer",label:"我可以给"},{id:"circles",label:`可加入的圈子 ${openCircles.length}`}];
  return <><section className="page-hero discover-hero"><div><Pill color="pink">跨圈发现</Pill><h2>有人在找，<br/>也有人可以给。</h2></div><button onClick={() => onSpeak("need")}>＋ 发布</button></section>
    <div className="filter-row" aria-label="发现筛选">{options.map((item) => <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
    {filter === "circles"
      ? (openCircles.length === 0
          ? <p className="result-note">目前没有可以直接加入的圈子。圈子大多靠熟人邀请——找一个认识的人要一条邀请链接。</p>
           : <><p className="result-note">{openCircles.length} 个你还没加入的圈子</p><div className="open-circle-list">{openCircles.map((circle) => <button key={circle.id} className={circle.pending ? "awaiting" : ""} onClick={() => onPreview(circle.id)}><CircleGlyph icon={circle.short} seed={circle.id} size="small"/><span><b>{circle.name}</b><small>{circle.tagline || `${circle.currency} · ${circle.members} 人`}</small></span><strong>看介绍 →</strong></button>)}</div></>)
      : <><p className="result-note">找到 {list.length} 条仍然有效的内容</p><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>}</>;
}

function CircleView({ circle, account, posts: circlePosts, visibleTradeCount, openCircles, isOwner, pendingCount, onProfile, onShare, onPost, onRules, onMembers, onInvite, onSettings, onDiscover, onPreview, onCreate }: { circle: Circle; account: ReturnType<typeof accountFor>; posts: Post[]; visibleTradeCount: number; openCircles: DiscoverableCircle[]; isOwner: boolean; pendingCount: number; onProfile: (id?: string) => void; onShare: (id: string) => void; onPost: (id: string) => void; onRules: () => void; onMembers: () => void; onInvite: () => void; onSettings: () => void; onDiscover: () => void; onPreview: (id: string) => void; onCreate: () => void }) {
  const { references } = circle.settings;
  return <><div className="circle-quick-nav"><button onClick={onDiscover}>发现其他圈子</button><button onClick={onCreate}>＋ 创建新圈子</button></div><section className={`page-hero circle-hero hero-${circle.color}`}><div><Pill color="cream">{isOwner ? "我创建的圈子" : "我加入的圈子"} · {circle.currency}</Pill><h2>{circle.name}</h2><p>{circle.tagline}</p>{!isOwner && <p>圈主：{memberById(circle.ownerId)?.name || "其他成员"} · 我是成员</p>}</div><div className="circle-hero-actions"><button onClick={onInvite}>邀请成员</button>{isOwner && <button onClick={onSettings}>圈子设置</button>}</div></section>
    <button className="camp-preview" onClick={onRules}><CircleGlyph icon={circle.short} seed={circle.id} size="regular"/><div><small>CAMP PROFILE · 圈子介绍</small><h3>{circle.tagline || "还没有写圈子介绍"}</h3><p>{circle.joining === "approval" ? "新成员申请需圈主审批" : "新成员可直接加入"} · {circle.members} 位成员</p></div><b>进入介绍 →</b></button>
    <section className="circle-trade-count" aria-label="圈内互助概览"><div><span>圈内互助</span><strong>{circle.stats?.posted ?? visibleTradeCount} <small>笔</small></strong></div><p>{circle.stats ? "全圈已入账的互助记录" : "当前可见、已入账的互助记录"}</p></section>
    <section className="balance-panel"><div><span>社区货币余额</span><strong>{account.balance > 0 ? "+" : ""}{account.balance} <em>{circle.currency}</em></strong><small>我在这个圈的余额</small></div><div><span>给出过</span><strong>{account.given}</strong><small>来自真实互助</small></div><div><span>收到过</span><strong>{account.received}</strong><small>接受帮助也很好</small></div></section>
    <SectionTitle eyebrow="REFERENCE" title="互助参考" action={isOwner ? "编辑" : "查看规则"} onAction={isOwner ? onSettings : onRules}/>
    {references.length > 0
      ? <div className="reference-grid">{references.map((item) => <button key={item.name} onClick={onRules}><b>{item.name}</b><span>{item.value}</span></button>)}</div>
      : <p className="soft-note">{isOwner ? "还没有互助参考。去圈子设置添加。" : "还没有互助参考。"}</p>}
    <SectionTitle eyebrow="PEOPLE" title="最近活跃的成员" action={pendingCount > 0 ? `全部成员 · ${pendingCount} 待审` : "全部成员"} onAction={onMembers}/>
    {pendingCount > 0 && <button className="pending-banner" onClick={onMembers}><b>{pendingCount} 个人在等你放行</b><span>他们通过邀请或发现页申请加入，通过后才算正式成员。</span><strong>去处理 →</strong></button>}
    <div className="member-row">{circle.memberIds.slice(0,4).map((id) => memberById(id)).filter(Boolean).map((member) => <button key={member.id} onClick={() => onProfile(member.id)}><Character member={member} small/><b>{member.name}<GenderSymbol member={member}/></b><small>{member.handle}<GenderSymbol member={member}/></small></button>)}</div>
    <div className="circle-feed"><SectionTitle eyebrow={`${circlePosts.length} EVENTS IN THIS CIRCLE`} title={`${circle.name}动态`}/><FeedList posts={circlePosts} onProfile={onProfile} onShare={onShare} onPost={onPost}/></div>
    <section className="circle-explore"><SectionTitle eyebrow="MORE CIRCLES" title="其他可加入的圈子"/><p>先看看介绍，再决定是否申请加入。</p>{openCircles.slice(0, 2).map((item) => <button key={item.id} className="circle-explore-preview" onClick={() => onPreview(item.id)}><CircleGlyph icon={item.short} seed={item.id} size="small"/><span><b>{item.name}</b><small>{item.tagline || `${item.members} 位成员`}</small></span><strong>看介绍 →</strong></button>)}<button className="circle-explore-more" onClick={onDiscover}>发现更多圈子 →</button></section></>;
}

function FeedList({ posts: list, onProfile, onShare, onPost }: { posts: Post[]; onProfile: (id?: string) => void; onShare: (id: string) => void; onPost: (id: string, contact?: boolean) => void }) {
  if (list.length === 0) return <div className="feed-empty"><b>暂时没有动态</b></div>;
  return <div className="feed-list">{list.map((post) => <article key={post.id} className={`feed-card feed-${post.kind}`}><header><button className="feed-person" onClick={() => post.memberId ? onProfile(post.memberId) : onPost(post.id)}><Character member={post.memberId ? memberById(post.memberId) : undefined} text={post.memberId ? undefined : post.avatar} color={post.color} variant={post.avatarVariant} small/><span><b>{post.person}<GenderSymbol member={post.memberId ? memberById(post.memberId) : undefined}/></b><small>{post.caption}</small></span></button><Pill color={post.color}>{post.badge}</Pill></header><button className="feed-open" onClick={() => onPost(post.id)}><span className="feed-text">{post.text}</span></button><footer><span>{post.meta}</span><span>{post.source === "listing" && post.memberId !== activeDb.currentMemberId ? <button onClick={() => onPost(post.id, true)}>联系{post.person} →</button> : <><button onClick={() => onPost(post.id)}>详情</button>{canSharePost(post) && <button onClick={() => onShare(post.id)}>分享 ↗</button>}</>}</span></footer></article>)}</div>;
}

function Modal({ children, onClose, label, wide = false, className = "" }: { children: React.ReactNode; onClose: () => void; label: string; wide?: boolean; className?: string }) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => {
    const closeTopDialog = (event: KeyboardEvent) => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
      if (dialogs.at(-1) !== dialogRef.current) return;
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      if (controls.length === 0) return;
      const first = controls[0]; const last = controls.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", closeTopDialog);
    return () => document.removeEventListener("keydown", closeTopDialog);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><section ref={dialogRef} className={`sheet ${wide ? "sheet-wide" : ""} ${className}`} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()}><button className="close-button" onClick={onClose} aria-label="关闭">×</button>{children}</section></div>;
}

function SheetHeading({ eyebrow, title, description, meta, color = "cream", visual }: { eyebrow?: string; title: string; description?: React.ReactNode; meta?: React.ReactNode; color?: string; visual?: React.ReactNode }) {
  return <header className={`sheet-heading ${visual ? "sheet-heading-with-visual" : ""}`}>
    {visual && <div className="sheet-heading-visual">{visual}</div>}
    <div className="sheet-heading-copy">
      {eyebrow && <Pill color={color}>{eyebrow}</Pill>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {meta && <small>{meta}</small>}
    </div>
  </header>;
}

// The composer. Four intents, each a plain form: pick who/which circle, fill in
// the fields loop-backend stores, review the draft, publish. (The natural-
// language "泡泡助手" path is not wired up — see docs; nothing here calls an LLM.)
function ComposerSheet({ circleId, initialOtherId, intent, setIntent, onClose, onSubmit, onNotice }: { circleId: string; initialOtherId?: string; intent: ComposerType; setIntent: (intent: ComposerType) => void; onClose: () => void; onSubmit: (input: ComposeInput) => Promise<void>; onNotice: (message: string) => void }) {
  const draftKey = composeDraftKey(activeDb.currentMemberId, intent);
  const [draft] = useState(() => readComposeDraft(draftKey));
  const [review, setReview] = useState<{ input: ComposeInput; label: string; description: string; footer: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // record / card
  const [otherId, setOtherId] = useState(draft.otherId ?? initialOtherId ?? "");
  const [direction, setDirection] = useState<"received" | "given">(draft.direction ?? "received");
  const [amount, setAmount] = useState(draft.amount ?? "");
  const [story, setStory] = useState(draft.story ?? "");
  const [recordVisibility, setRecordVisibility] = useState<"public" | "mystery">(draft.recordVisibility ?? "public");

  // need / offer
  const [listingDescription, setListingDescription] = useState(draft.listingDescription ?? "");
  const [reference, setReference] = useState(draft.reference ?? "");
  const [listingCircleIds, setListingCircleIds] = useState<string[]>(draft.listingCircleIds ?? (circleId ? [circleId] : []));
  const [crossCircle, setCrossCircle] = useState(draft.crossCircle ?? false);

  const myCircles = circles.filter((item) => memberById(activeDb.currentMemberId).circleIds.includes(item.id) && (!initialOtherId || intent === "need" || intent === "offer" || memberById(initialOtherId).circleIds.includes(item.id)));
  // `circleId` is whatever tab is open, which is `circles[0]` before the user
  // has picked one — so track the target explicitly and show it in the form.
  const [recordCircleId, setRecordCircleId] = useState(draft.recordCircleId ?? (circleId || myCircles[0]?.id || ""));
  useEffect(() => {
    writeComposeDraft(draftKey, { otherId, direction, amount, story, recordVisibility, listingDescription, reference, listingCircleIds, crossCircle, recordCircleId });
  }, [draftKey, otherId, direction, amount, story, recordVisibility, listingDescription, reference, listingCircleIds, crossCircle, recordCircleId]);

  const circle = circleById(recordCircleId) ?? EMPTY_CIRCLE;
  const others = circle.memberIds.map((mid) => memberById(mid)).filter((m) => m && m.id !== activeDb.currentMemberId);
  const isLedger = intent === "record";
  const isCard = intent === "card";
  const isListing = intent === "need" || intent === "offer";
  const listingCurrency = listingCircleIds.length === 1 ? circleById(listingCircleIds[0])?.currency : undefined;

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
        if (!Number.isInteger(amt) || amt <= 0) { onNotice(`请填写大于 0 的${circle.currency}数量`); return; }
        const description = story.trim();
        if (!description) { onNotice("写下这次互助发生了什么"); return; }
        const providerId = direction === "received" ? other.id : me;
        const receiverId = direction === "received" ? me : other.id;
        setReview({
          // One key per draft: retrying 确认发布 after a lost response reuses it,
          // so the backend returns the record it already posted instead of
          // posting the amount a second time. Editing builds a new draft/key.
          input: { intent: "record", circleId: circle.id, providerId, receiverId, amount: amt, description, visibility: recordVisibility, tags: [], idempotencyKey: crypto.randomUUID() },
          label: "记一笔交换",
          description,
          footer: `${memberById(providerId)?.name} +${amt} · ${memberById(receiverId)?.name} −${amt} （${circle.currency}） · ${recordVisibility === "mystery" ? "神秘记录：对外只显示金额，不显示事情" : "圈内公开"}`,
        });
        return;
      }

      const text = story.trim();
      if (!text) { onNotice("请写清楚这件好事发生了什么"); return; }
      setReview({
        input: { intent: "card", circleId: circle.id, toId: other.id, story: text, visibility: "cross-circle" },
        label: `记录${other.name}的好事`,
        description: text,
        footer: "跨圈公开 · 不产生任何余额",
      });
      return;
    }

    const description = listingDescription.trim();
    if (!description) { onNotice(intent === "need" ? "说说你想要什么" : "说说你可以给什么"); return; }
    if (listingCircleIds.length === 0) { onNotice("至少选择一个圈子"); return; }
    setReview({
      input: { intent, description, circleIds: listingCircleIds, visibility: crossCircle ? "cross-circle" : "circle", reference: reference.trim(), tags: [] },
      label: intent === "need" ? "我想要" : "我可以给",
      description,
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

  return <Modal onClose={onClose} label="记一笔" className="composer-sheet">
    <SheetHeading eyebrow={review ? "发布" : undefined} title={review ? "确认内容" : "记什么？"} color={accent}/>

    {!review ? <>
      <div className="intent-grid">{intents.map((item) => <button key={item.id} aria-pressed={intent === item.id} className={`intent intent-${item.color} ${intent === item.id ? "selected" : ""}`} onClick={() => setIntent(item.id)}><b><FlowIcon kind={item.id}/></b><span><strong>{item.label}</strong></span></button>)}</div>

      {(isLedger || isCard) && (myCircles.length === 0 ? <p className="soft-note">先加入或创建一个圈子，再记录互助。</p> : others.length === 0
        ? <p className="soft-note">「{circle.name}」还没有其他成员。先到圈子页「邀请成员」，对方加入后就可以互相记录了。</p>
        : <div className="manual-form">
            {myCircles.length > 1 && <label><span>记在哪个圈子</span><select value={recordCircleId} onChange={(e) => { setRecordCircleId(e.target.value); setOtherId(""); }}>{myCircles.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.currency}）</option>)}</select></label>}
            <label><span>{isLedger ? "和谁的互助" : "记录谁的好事"}</span><select value={otherId} onChange={(e) => setOtherId(e.target.value)}><option value="">选择一位成员</option>{others.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>

            {isLedger && <>
              <div className="manual-choice"><button className={direction === "received" ? "active" : ""} onClick={() => setDirection("received")}>对方帮了我</button><button className={direction === "given" ? "active" : ""} onClick={() => setDirection("given")}>我帮了对方</button></div>
              <label><span>这次记多少{circle.currency}</span><input type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例如 5"/></label>
              <label><span>{direction === "received" ? "对方帮你做了什么？" : "你帮对方做了什么？"}</span><textarea value={story} rows={4} onChange={(e) => setStory(e.target.value)} placeholder={direction === "received" ? "比如：对方帮我修好了浇水管。" : "比如：我帮对方修好了浇水管。"}/></label>
              <label className="inline-check"><input type="checkbox" checked={recordVisibility === "mystery"} onChange={(e) => setRecordVisibility(e.target.checked ? "mystery" : "public")}/><span><b>神秘记录</b><small>对外只显示金额，不显示事情</small></span></label>
              {circle.settings.requireConfirmation && <p className="soft-note">这个圈子的记录要由对方确认后才会入账。</p>}
              {!circle.settings.allowNegativeBalance && <p className="soft-note">这个圈子需要先有足够的{circle.currency}，才能接受帮助。</p>}
            </>}

            {isCard && <>
              <label><span>你想记录哪件好事？</span><textarea value={story} rows={4} onChange={(e) => setStory(e.target.value)} placeholder="比如：下雨那天，他发现公共厨房漏水，默默修好了。"/></label>

            </>}

            <div className="composer-submit"><button className="primary-button" onClick={buildDraft}>查看草稿 <b>→</b></button></div>
          </div>)}

      {isListing && (myCircles.length === 0 ? <p className="soft-note">先加入或创建一个圈子，才能发布需要 / 提供。</p> : <div className="manual-form">
        <label><span>{intent === "need" ? "说说你想要什么" : "说说你可以给什么"}</span><textarea value={listingDescription} rows={4} onChange={(e) => setListingDescription(e.target.value)} placeholder={intent === "need" ? "比如：想找人帮忙看看活动文案，线上聊一会儿也可以。" : "比如：这周可以帮忙修小家电，也可以一起研究怎么修。"}/></label>
        <label><span>{intent === "need" ? "愿意给出的社区货币（可选）" : "希望收到的社区货币（可选）"}</span><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={listingCurrency ? `比如：10 ${listingCurrency}，也可以商量` : "可以写想法，也可以留空再商量"}/></label>
        <span className="form-label">在哪些圈子里出现</span>
        <div className="circle-picker">{myCircles.map((item) => <button key={item.id} className={listingCircleIds.includes(item.id) ? "active" : ""} onClick={() => toggleListingCircle(item.id)}><CircleGlyph icon={item.short} seed={item.id} size="tiny"/>{item.name}</button>)}</div>
        <label className="inline-check"><input type="checkbox" checked={crossCircle} onChange={(e) => setCrossCircle(e.target.checked)}/><span><b>跨圈公开</b><small>在你当前及以后加入的圈子里显示，也允许跨圈发现。</small></span></label>
        <div className="composer-submit"><button className="primary-button" onClick={buildDraft}>查看草稿 <b>→</b></button></div>
      </div>)}
    </> : <>
      <div className={`draft-card draft-${accent}`}><Pill color="cream">{review.label} · 草稿</Pill><p className="draft-description">{review.description}</p><div>{review.footer}</div></div>
      <div className="sheet-actions"><button className="secondary-button" onClick={() => setReview(null)}>返回修改</button><button className="primary-button" disabled={saving} onClick={publish}>{saving ? "正在保存…" : "发布"} <b>→</b></button></div>
    </>}
  </Modal>;
}

function ShareSheet({ shareUrl, onClose, onCopy, onDone, onNotice }: { shareUrl: string; onClose: () => void; onCopy: () => Promise<void>; onDone: () => Promise<void>; onNotice: (message: string) => void }) {
  // A share poster can leave the app, so circle-only descriptions must never be
  // printed on it. The linked profile still applies bootstrap visibility.
  const myListings = activeDb.settings.publicListings
    ? activeDb.listings.filter((listing) => listing.memberId === activeDb.currentMemberId && listing.status === "active" && listing.visibility === "cross-circle")
    : [];
  const needs = myListings.filter((item) => item.type === "need");
  const offers = myListings.filter((item) => item.type === "offer");
  const me=memberById(activeDb.currentMemberId);
  const posterRef = useRef<HTMLDivElement>(null);
  async function saveImage() { try { await savePosterImage(posterRef.current, `${me.name}-个人档案`); onNotice("个人档案图片已保存"); } catch { onNotice("保存失败，请稍后再试"); } }
  return <Modal onClose={onClose} label="分享个人档案预览">
    <SheetHeading eyebrow="分享" title="个人档案" color="blue"/>
    <div ref={posterRef} className="share-poster"><div className="poster-top"><Character member={me}/><div><span>{me.handle}</span><h2>{me.name}的个人档案</h2></div></div><div className="poster-panel poster-need"><b>我目前想要</b>{needs.map((item) => <p key={item.id}>{item.detail || item.title}</p>)}{needs.length === 0 && <p>暂无公开内容</p>}</div><div className="poster-panel poster-offer"><b>我目前可以给</b>{offers.map((item) => <p key={item.id}>{item.detail || item.title}</p>)}{offers.length === 0 && <p>暂无公开内容</p>}</div><div className="poster-bottom"><div><b>可以问，也可以拒绝。</b></div><QrCode value={shareUrl} className="fake-qr"/></div></div>
    {isLocalUrl(shareUrl) && <p className="local-link-warning">本地测试链接，仅这台电脑可打开。</p>}
    <div className="share-link-row"><span>{shareUrl}</span><button className="secondary-button" onClick={onCopy}>复制链接</button></div>
    <div className="sheet-actions"><button className="secondary-button" onClick={saveImage}>保存图片</button><button className="primary-button" onClick={onDone}>{isLocalUrl(shareUrl) ? "复制测试链接" : "分享档案"}</button></div>
  </Modal>;
}

function PostShareSheet({ post, onClose, onNotice }: { post: Post; onClose: () => void; onNotice: (message: string) => void }) {
  const posterRef = useRef<HTMLDivElement>(null);
  const listing = post.source === "listing" ? activeDb.listings.find((item) => item.id === post.sourceId) : undefined;
  const record = post.source === "transaction" ? activeDb.transactions.find((item) => item.id === post.sourceId) : undefined;
  const card = post.source === "card" ? activeDb.goodCards.find((item) => item.id === post.sourceId) : undefined;
  const publishable = canSharePost(post) && (!record || record.visibility === "public" && !record.pendingRevision) && (!card || card.visibility === "cross-circle");
  const [publicLink, setPublicLink] = useState<{ url: string; token: string } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  async function createPublicLink() {
    if (linkBusy) return;
    setLinkBusy(true);
    try {
      const response = await fetch("/api/shares", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: listing ? "listing" : record ? "record" : "good_card", targetId: post.sourceId }) });
      const result = await response.json() as { url?: string; token?: string; error?: string };
      if (!response.ok || !result.url || !result.token) throw new Error(result.error || "生成公开链接失败");
      setPublicLink({ url: result.url, token: result.token });
    } catch (error) { onNotice(error instanceof Error ? error.message : "生成失败"); }
    finally { setLinkBusy(false); }
  }
  async function revokePublicLink() {
    if (!publicLink || linkBusy) return;
    setLinkBusy(true);
    try {
      const response = await fetch(`/api/shares/${encodeURIComponent(publicLink.token)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "收回失败");
      setPublicLink(null); onNotice("公开链接已收回");
    } catch (error) { onNotice(error instanceof Error ? error.message : "收回失败"); }
    finally { setLinkBusy(false); }
  }
  async function shareLink() {
    if (!publicLink) return;
    try {
      if (!isLocalUrl(publicLink.url) && typeof navigator.share === "function") await navigator.share({ title: post.badge, url: publicLink.url });
      else { await navigator.clipboard.writeText(publicLink.url); onNotice(isLocalUrl(publicLink.url) ? "已复制本地测试链接，仅这台电脑可打开" : "公开链接已复制"); }
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) onNotice("分享失败，请手动复制链接"); }
  }

  async function shareImage() {
    try {
      if (!posterRef.current) throw new Error("分享图还没有准备好");
      await document.fonts?.ready;
      const dataUrl = await toPng(posterRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#fffaf2" });
      const file = new File([await (await fetch(dataUrl)).blob()], `${safeFilename(`${post.badge}-${post.person}`)}.png`, { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${post.badge}｜${post.person}` });
        onClose(); onNotice("图片已交给系统分享");
      } else {
        setImagePreview(dataUrl);
        onNotice("请长按下方图片保存，再发送到微信");
      }
    } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; onNotice("分享图片失败，请稍后再试"); }
  }

  async function saveImage() { try {
    if (/MicroMessenger/i.test(navigator.userAgent)) {
      if (!posterRef.current) throw new Error("分享图还没有准备好");
      await document.fonts?.ready;
      setImagePreview(await toPng(posterRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#fffaf2" }));
      onNotice("请长按下方图片保存，再发送到微信");
    } else { await savePosterImage(posterRef.current, `${post.badge}-${post.person}`); onNotice("已发起图片下载，请在下载列表中查看"); }
  } catch { onNotice("保存失败，请稍后再试"); } }

  return <Modal onClose={onClose} label="分享内容预览">
    <SheetHeading eyebrow="主动分享" title={post.source === "listing" ? post.badge : post.source === "card" ? "好人好事" : "互助记录"} color={post.color}/>
    <div ref={posterRef} className={`post-share-poster share-${post.color}`}>
      <div className="poster-top"><Character member={post.memberId ? memberById(post.memberId) : undefined} text={post.memberId ? undefined : post.avatar} color={post.color} variant={post.avatarVariant}/><div><span>{post.caption}</span><h2>{post.person}</h2></div></div><Pill color="cream">{post.badge}</Pill><p className="post-share-copy">{post.text}</p>{listing?.reference && <p className="post-share-reference"><span>{listing.type === "need" ? "愿意给出" : "希望收到"}</span><b>{listing.reference}</b></p>}<small>{post.meta}</small>
      {publicLink && <QrCode value={publicLink.url}/>}
    </div>
    <p className="share-explainer">图片会展示上面的完整内容。{post.source === "transaction" ? "发送前，请确认故事中没有不想公开的他人信息。" : "可以保存，也可以用手机直接发送。"}</p>
    <div className="sheet-actions"><button className="secondary-button" onClick={saveImage}>保存图片</button><button className="primary-button" onClick={shareImage}>分享图片</button></div>
    {imagePreview && <div className="share-image-preview"><p className="soft-note">长按图片保存到相册，再到微信选择图片发送。</p><img src={imagePreview} alt={`${post.person}的${post.badge}分享图`} style={{ width: "100%", height: "auto" }}/></div>}
    {publishable && !publicLink && <button className="text-link" disabled={linkBusy} onClick={createPublicLink}>{linkBusy ? "正在生成…" : "生成公开链接"}</button>}
    {publicLink && <><p className="soft-note">持链接可直接查看这一条。暂停、结束或撤销后失效。</p><div className="share-link-row"><span>{publicLink.url}</span><button className="secondary-button" onClick={shareLink}>分享链接</button></div><button className="text-link" disabled={linkBusy} onClick={revokePublicLink}>收回公开链接</button>{isLocalUrl(publicLink.url) && <p className="local-link-warning">本地测试地址，仅这台电脑可打开。</p>}</>}
  </Modal>;
}

const revisionStatus = { pending: "等待对方", accepted: "已同意", declined: "已拒绝", withdrawn: "已撤回" } as const;
const visibilityName: Record<string, string> = { public: "圈内公开", mystery: "神秘记录", private: "仅双方可见" };

// "额度 4 → 6", "描述改为「…」", "可见范围 圈内公开 → 神秘记录"
function revisionLines(revision: Revision, currency: string): string[] {
  const { oldValues: from, newValues: to } = revision;
  const lines: string[] = [];
  if (to.amount !== undefined) lines.push(`社区货币 ${from.amount ?? "?"} → ${to.amount} ${currency}`);
  if (to.story !== undefined) lines.push(`描述改为「${String(to.story)}」`);
  if (to.visibility !== undefined) lines.push(`可见范围 ${visibilityName[String(from.visibility)] ?? from.visibility} → ${visibilityName[String(to.visibility)] ?? to.visibility}`);
  return lines;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}


type OtherCircle = { id: string; name: string; icon: string | null; description: string | null; currency: string | null; member_count: number; joining: string; membership_status: string | null };

function ProfilePage({ member, circleScopeId, initialTab, focusRecordId, onNotice, onChanged, onSelectCircle, onShareItem, onPublish, onEdit, onShare, onRecord, onPreview }: { member: Member; circleScopeId: string; initialTab: ProfileTab; focusRecordId?: string | null; onNotice: (message: string) => void; onChanged: () => Promise<void>; onSelectCircle: (id: string) => void; onShareItem: (source: "listing" | "transaction" | "card", id: string) => void; onPublish: (intent: ComposerType) => void; onEdit: () => void; onShare: () => void; onRecord: () => void; onPreview: (id: string) => void }) {
  // Opened from a notification: bring that one record into view.
  const focusedRef = useRef<HTMLElement | null>(null);
  useEffect(() => { focusedRef.current?.scrollIntoView({ block: "center" }); }, [focusRecordId]);
  const [contact, setContact] = useState(false);
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [transactionDialog, setTransactionDialog] = useState<TransactionDialog | null>(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftStory, setDraftStory] = useState("");
  const [draftVisibility, setDraftVisibility] = useState<Transaction["visibility"]>("public");
  const [history, setHistory] = useState<Record<string, Revision[] | "loading" | "error">>({});
  const [viewerProfile, setViewerProfile] = useState<{ other_discoverable_circles: OtherCircle[]; stats: { posted_records: number; mystery_records: number } | null } | "error" | null>(null);
  useEffect(() => {
    let alive = true;
    const query = circleScopeId === "all" ? "" : `?circleId=${encodeURIComponent(circleScopeId)}`;
    fetch(`/api/members/${encodeURIComponent(member.id)}/profile${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { other_discoverable_circles: OtherCircle[]; stats: { posted_records: number; mystery_records: number } | null };
        if (alive) setViewerProfile(response.ok && Array.isArray(data.other_discoverable_circles) ? data : "error");
      }).catch(() => { if (alive) setViewerProfile("error"); });
    return () => { alive = false; };
  }, [member.id, circleScopeId, onChanged]);
  const [transactionBusy, setTransactionBusy] = useState(false);
  const [transactionError, setTransactionError] = useState("");
  const [listingDialog, setListingDialog] = useState<Listing | null>(null);
  const [listingToClose, setListingToClose] = useState<Listing | null>(null);
  const [listingDraft, setListingDraft] = useState({ detail: "", reference: "", visibility: "circle" as Listing["visibility"], circleIds: [] as string[] });
  const [listingBusy, setListingBusy] = useState(false);
  const [listingError, setListingError] = useState("");
  const isSelf = member.id === activeDb.currentMemberId;
  const myCircleIds = memberById(activeDb.currentMemberId).circleIds;
  const visibleCircleIds = member.circleIds.filter((id) => isSelf || myCircleIds.includes(id));
  const scopedCircleId = circleScopeId !== "all" && visibleCircleIds.includes(circleScopeId) ? circleScopeId : null;
  const accounts = activeDb.accounts.filter((item) => item.memberId === member.id && visibleCircleIds.includes(item.circleId));
  const activeAccount = scopedCircleId ? accounts.find((item) => item.circleId === scopedCircleId) : undefined;
  const activeCircle = scopedCircleId ? circleById(scopedCircleId) : undefined;
  const cards = activeDb.goodCards.filter((card) => card.toMemberId === member.id && (card.visibility === "cross-circle" || isSelf) && (!card.circleId || visibleCircleIds.includes(card.circleId)) && (!scopedCircleId || card.circleId === scopedCircleId));
  const listings = activeDb.listings.filter((listing) => listing.memberId === member.id && (isSelf || listing.status === "active") && listingDisplayCircleIds(listing, member.circleIds).some((id) => visibleCircleIds.includes(id)) && (!scopedCircleId || listingDisplayCircleIds(listing, member.circleIds).includes(scopedCircleId)));
  const transactions = activeDb.transactions.filter((transaction) => {
    const viewerInvolved = transaction.providerId === activeDb.currentMemberId || transaction.receiverId === activeDb.currentMemberId;
    return (transaction.providerId === member.id || transaction.receiverId === member.id) && visibleCircleIds.includes(transaction.circleId) && (!scopedCircleId || transaction.circleId === scopedCircleId) && (isSelf || viewerInvolved || transaction.visibility === "public") && (viewerInvolved || transaction.status !== "pending" && transaction.status !== "rejected");
  });

  async function changeListing(id: string, status: "active" | "paused" | "closed") {
    if (listingBusy) return;
    setListingBusy(true);
    try {
      const response = await fetch(`/api/listings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "更新失败");
      await onChanged();
      setListingToClose(null);
      onNotice(status === "active" ? "内容已恢复展示" : status === "paused" ? "内容已暂停展示" : "内容已结束");
    } catch (error) { onNotice(error instanceof Error ? error.message : "更新失败，请稍后再试"); }
    finally { setListingBusy(false); }
  }

  function openListingDialog(listing: Listing) {
    setListingDraft({ detail: listing.detail || listing.title, reference: listing.reference, visibility: listing.visibility, circleIds: listing.circleIds });
    setListingError("");
    setListingDialog(listing);
  }

  async function saveListingDialog() {
    if (!listingDialog || listingBusy) return;
    const detail = listingDraft.detail.trim();
    if (!detail) { setListingError("请写下需要或提供的内容"); return; }
    if (listingDraft.circleIds.length === 0) { setListingError("请至少选择一个圈子"); return; }
    setListingBusy(true);
    setListingError("");
    try {
      const body = { detail, reference: listingDraft.reference.trim(), visibility: listingDraft.visibility, circleIds: listingDraft.circleIds };
      const response = await fetch(`/api/listings/${listingDialog.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败，请稍后再试");
      const refreshed = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!refreshed.ok) throw new Error("修改已提交，但无法核对最新内容。请刷新档案确认。");
      const world = await refreshed.json() as { listings?: Listing[] };
      const saved = world.listings?.find((item) => item.id === listingDialog.id);
      await onChanged();
      if (!saved || saved.detail !== detail || saved.reference !== body.reference || saved.visibility !== body.visibility || [...saved.circleIds].sort().join(",") !== [...body.circleIds].sort().join(","))
        throw new Error("保存结果与填写内容不一致，请保留草稿并刷新核对。");
      setListingDialog(null);
      onNotice("内容已更新");
    } catch (error) {
      setListingError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setListingBusy(false);
    }
  }

  // Since 2026-10 a posted record changes only with both parties' consent:
  // proposing moves nothing; the other party accepts or declines.
  function openRevisionDialog(kind: TransactionDialog["kind"], transaction: Transaction, currency: string) {
    setDraftAmount(String(transaction.amount));
    setDraftStory(transaction.story);
    setDraftVisibility(transaction.visibility);
    setTransactionError("");
    setTransactionDialog({ kind, transaction, currency });
  }

  async function submitTransactionDialog() {
    if (!transactionDialog || transactionBusy) return;
    const { kind, transaction } = transactionDialog;
    const body: Record<string, unknown> = { kind, baseVersion: transaction.version };
    if (kind === "edit") {
      const amount = Number(draftAmount);
      if (!Number.isInteger(amount) || amount <= 0) { setTransactionError("额度必须是大于 0 的整数"); return; }
      // Only what actually changed — each part is its own proposal content.
      if (amount !== transaction.amount) body.amount = amount;
      if (draftStory.trim() !== transaction.story.trim()) body.story = draftStory.trim();
      if (draftVisibility !== transaction.visibility) body.visibility = draftVisibility;
      if (Object.keys(body).length === 2) { setTransactionError("没有任何改动"); return; }
    }
    setTransactionBusy(true);
    setTransactionError("");
    try {
      const response = await fetch(`/api/records/${transaction.id}/revisions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "提交失败");
      await onChanged();
      onNotice(kind === "revoke" ? "已申请撤销，等待对方同意" : "修改已提交，等待对方同意");
      setTransactionDialog(null);
    } catch (error) {
      // The draft stays in the dialog so nothing typed is lost.
      setTransactionError(error instanceof Error ? error.message : "提交失败");
    } finally {
      setTransactionBusy(false);
    }
  }

  async function resolveRevision(transaction: Transaction, revision: Revision, action: "accept" | "decline" | "withdraw") {
    const response = await fetch(`/api/records/${transaction.id}/revisions/${revision.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { onNotice(result.error || "处理失败"); await onChanged(); return; }
    await onChanged();
    setHistory((current) => { const next = { ...current }; delete next[transaction.id]; return next; });
    onNotice(action === "accept"
      ? (revision.kind === "revoke" ? "已同意撤销，双方额度已退回" : "已同意修改，双方账户已重算")
      : action === "decline" ? "已拒绝，记录保持原样" : "已撤回申请");
  }

  async function toggleHistory(id: string) {
    if (history[id] && history[id] !== "error") { setHistory((current) => { const next = { ...current }; delete next[id]; return next; }); return; }
    setHistory((current) => ({ ...current, [id]: "loading" }));
    try {
      const response = await fetch(`/api/records/${id}/history`);
      const result = await response.json() as { revisions?: LoopRevision[]; error?: string };
      if (!response.ok || !result.revisions) throw new Error(result.error || "读取失败");
      setHistory((current) => ({ ...current, [id]: result.revisions!.map(toRevision) }));
    } catch {
      setHistory((current) => ({ ...current, [id]: "error" }));
    }
  }

  const statusLabel = { active: "展示中", paused: "暂停展示", closed: "已结束" } as const;
  const transactionStatus = { pending: "待确认", confirmed: "已入账", corrected: "已修改", rejected: "已撤销" } as const;

  return <><section className="profile-page" aria-label={`${member.name}的档案`}>
    <header className="profile-page-heading"><Character member={member}/><div className="profile-page-identity"><small>{isSelf ? "我的档案" : "成员档案"} · {member.handle}<GenderSymbol member={member}/></small><h2>{member.name}<GenderSymbol member={member}/></h2><p>{member.bio || "还没有填写介绍"}</p></div>
      {isSelf ? <div className="profile-page-actions"><button onClick={onEdit}>编辑资料</button><button onClick={onShare}>分享档案</button></div> : <div className="profile-page-actions"><button onClick={onRecord} disabled={visibleCircleIds.length === 0}>记一笔</button>{contact ? <div className="contact-reveal"><span>联系方式</span><b>{member.wechat || "未填写"}</b>{member.wechat && <button onClick={async () => { try { await navigator.clipboard.writeText(member.wechat); onNotice("已复制"); } catch { onNotice("复制失败，请手动复制"); } }}>复制</button>}</div> : <button onClick={() => setContact(true)}>联系{member.name}</button>}</div>}
    </header>
    {isSelf && <div className="profile-publish-actions"><button onClick={() => onPublish("need")}><Pill color="pink">我想要</Pill><b>发布需要 ＋</b></button><button onClick={() => onPublish("offer")}><Pill color="green">我可以给</Pill><b>发布提供 ＋</b></button></div>}
    <p className="profile-scope-note">{scopedCircleId ? `${activeCircle?.name} · ${isSelf ? "我的圈内内容" : "你们共同圈子的可见内容"}` : isSelf ? "我在全部圈子的内容" : "你们共同圈子的可见内容"}</p>
    {activeAccount && activeCircle && <div className="profile-numbers"><div><b>{activeAccount.balance > 0 ? "+" : ""}{activeAccount.balance} {activeCircle.currency}</b><span>{activeCircle.name} · 社区货币余额</span></div><div><b>{activeAccount.given}</b><span>在本圈给出过</span></div><div><b>{activeAccount.received}</b><span>在本圈收到过</span></div></div>}
    <div className="profile-tabs" role="tablist"><button className={tab === "listings" ? "active" : ""} onClick={() => setTab("listings")}>需要 / 提供 <b>{listings.length}</b></button><button className={tab === "transactions" ? "active" : ""} onClick={() => setTab("transactions")}>互助记录 <b>{viewerProfile && viewerProfile !== "error" && viewerProfile.stats ? viewerProfile.stats.posted_records : transactions.length}</b></button><button className={tab === "cards" ? "active" : ""} onClick={() => setTab("cards")}>好人好事 <b>{cards.length}</b></button></div>

    {tab === "cards" && <div className="archive-list card-archive">{cards.map((card) => { const from = memberById(card.fromMemberId); const circle = circleById(card.circleId); return <article key={card.id}><header><Character member={from} small/><span><b>{from?.name} 记录了 {member.name} 的好事</b><small>{[card.date, circle?.name].filter(Boolean).join(" · ")}</small></span><Pill color="coral">好人好事</Pill></header><p>“{card.story}”</p>{isSelf && <div className="listing-actions"><button onClick={() => onShareItem("card", card.id)}>分享这件好人好事 ↗</button></div>}</article>; })}{cards.length === 0 && <div className="empty-archive">还没有好人好事</div>}</div>}

    {tab === "listings" && <div className="archive-list listing-archive">{listings.map((listing) => <article key={listing.id} className={listing.type === "need" ? "archive-need" : "archive-offer"}><header><Pill color={listing.type === "need" ? "pink" : "green"}>{listing.type === "need" ? "我想要" : "我可以给"}</Pill><div className="listing-status-control"><span className={`status status-${listing.status}`}>{statusLabel[listing.status]}</span>{isSelf && listing.status !== "closed" && <button className="listing-status-toggle" aria-label={listing.status === "active" ? "暂停展示" : "恢复展示"} title={listing.status === "active" ? "暂停展示" : "恢复展示"} onClick={() => changeListing(listing.id, listing.status === "active" ? "paused" : "active")}>{listing.status === "active" ? "⏸" : "▶"}</button>}</div></header><p className="archive-description">{listing.detail || listing.title}</p><dl>{listing.reference && <div><dt>{listing.type === "need" ? "愿意给出" : "希望收到"}</dt><dd>{listing.reference}</dd></div>}<div><dt>范围</dt><dd>{listing.visibility === "cross-circle" ? "跨圈公开" : listing.circleIds.map((id) => circleById(id)?.name).filter(Boolean).join("、")}</dd></div></dl>{isSelf && listing.status !== "closed" && <div className="listing-actions"><button type="button" onClick={() => openListingDialog(listing)}>编辑内容</button><button disabled={listingBusy} onClick={() => setListingToClose(listing)}>结束发布</button>{listing.status === "active" && <button onClick={() => onShareItem("listing", listing.id)}>分享这条内容 ↗</button>}</div>}</article>)}{listings.length === 0 && <div className="empty-archive">还没有发布中的需要或提供。</div>}</div>}

    {tab === "transactions" && <div className="archive-list transaction-archive">{transactions.map((transaction) => {
      const provider = memberById(transaction.providerId);
      const receiver = memberById(transaction.receiverId);
      const circle = circleById(transaction.circleId) ?? EMPTY_CIRCLE;
      const posted = transaction.status === "confirmed" || transaction.status === "corrected";
      const revision = isSelf ? transaction.pendingRevision : null;
      const mine = revision?.proposedById === activeDb.currentMemberId;
      const canPropose = isSelf && posted && !revision && !transaction.redacted;
      const focused = transaction.id === focusRecordId;
      const log = history[transaction.id];
      return <article key={transaction.id} className={focused ? "focused" : undefined} ref={focused ? focusedRef : undefined}>
        <header><div>
          <Pill color={transaction.visibility === "private" ? "blue" : "yellow"}>{transaction.visibility === "private" ? "仅当事人" : transaction.visibility === "mystery" ? "神秘记录" : "圈内公开"}</Pill>
          <span className={`status status-${transaction.status}`}>{transactionStatus[transaction.status]}</span>
          {isSelf && transaction.status === "pending" && transaction.createdById === activeDb.currentMemberId && <span className="status status-pending">等对方确认</span>}
          {canPropose && <button onClick={() => openRevisionDialog("edit", transaction, circle.currency)}>申请修改</button>}
          {canPropose && <button onClick={() => openRevisionDialog("revoke", transaction, circle.currency)}>申请撤销</button>}
        </div><strong>{transaction.amount} {circle.currency}</strong></header>
        <p className="archive-description">{transaction.story || transaction.title}</p><div className="record-actions">{isSelf && !revision && transaction.visibility === "public" && posted && <button onClick={() => onShareItem("transaction", transaction.id)}>分享 ↗</button>}</div>
        {revision && <div className="correction-note">
          <b>{revision.kind === "revoke"
            ? (mine ? "等待对方同意撤销" : `${memberById(revision.proposedById)?.name ?? "对方"}申请撤销这笔记录`)
            : (mine ? "等待对方同意修改" : `${memberById(revision.proposedById)?.name ?? "对方"}申请修改这笔记录`)}</b>
          {revision.kind === "edit" && <ul className="revision-changes">{revisionLines(revision, circle.currency).map((line) => <li key={line}>{line}</li>)}</ul>}
          <span>{revision.kind === "revoke"
            ? (mine ? "对方同意后，这笔记录按当前额度整笔退回；拒绝或你撤回，记录和额度都不变。" : "同意后按当前额度整笔退回双方；拒绝的话记录保持原样。")
            : (mine ? "对方同意后才会生效，在那之前原记录和额度都不变。" : "同意后立即生效并重算双方额度；拒绝的话记录保持原样。")}</span>
          <div>{mine
            ? <button onClick={() => resolveRevision(transaction, revision, "withdraw")}>撤回申请</button>
            : <><button onClick={() => resolveRevision(transaction, revision, "accept")}>同意</button><button onClick={() => resolveRevision(transaction, revision, "decline")}>拒绝</button></>}</div>
        </div>}
        {isSelf && !transaction.redacted && <button className="history-toggle" onClick={() => toggleHistory(transaction.id)}>{log && log !== "error" ? "收起修改记录" : "修改记录"}</button>}
        {log === "loading" && <p className="soft-note">正在读取…</p>}
        {log === "error" && <p className="soft-note">修改记录没能读取，可以再试一次。</p>}
        {Array.isArray(log) && <ol className="revision-history">{log.length === 0 ? <li>还没有修改过</li> : log.map((item) => <li key={item.id}><b>{memberById(item.proposedById)?.name ?? "成员"}{item.kind === "revoke" ? "申请撤销" : "申请修改"} · {revisionStatus[item.status]}</b>{item.kind === "edit" && <span>{revisionLines(item, circle.currency).join("；")}</span>}<small>{formatTime(item.createdAt)}{item.resolvedAt ? ` → ${formatTime(item.resolvedAt)}` : ""}</small></li>)}</ol>}
        <footer><span>{provider?.name} → {receiver?.name}</span><span>记录于 {transaction.recordedAt} · {circle.name}</span></footer>
      </article>;
    })}{transactions.length === 0 && <div className="empty-archive">没有可见记录</div>}</div>}

    {accounts.length > 0 && <><SectionTitle title={isSelf ? "我在各圈" : "你们的共同圈子"}/><div className="account-strip">{accounts.map((account) => { const circle = circleById(account.circleId) ?? EMPTY_CIRCLE; return <button key={account.circleId} type="button" className={scopedCircleId === account.circleId ? "selected" : ""} aria-current={scopedCircleId === account.circleId ? "true" : undefined} aria-label={`查看${circle.name}的档案内容`} onClick={() => onSelectCircle(account.circleId)}><span>{circle.name}</span><b>{account.balance > 0 ? "+" : ""}{account.balance} {circle.currency}</b><small>给出 {account.given} · 收到 {account.received}</small></button>; })}</div></>}
    {!isSelf && <><SectionTitle title="TA 加入的其他圈子"/>{viewerProfile === null ? <p className="soft-note">正在读取…</p> : viewerProfile === "error" ? <p className="soft-note">未能读取其他圈子，请刷新重试。</p> : viewerProfile.other_discoverable_circles.length === 0 ? <div className="empty-archive">目前没有其他可发现的圈子</div> : <div className="open-circle-list">{viewerProfile.other_discoverable_circles.map((circle) => <button key={circle.id} onClick={() => onPreview(circle.id)}><CircleGlyph icon={circle.icon || "n1"} seed={circle.id} size="small"/><span><b>{circle.name}</b><small>{circle.description}</small></span><strong>看介绍 →</strong></button>)}</div>}</>}

  </section>
  {listingToClose && <Modal onClose={() => { if (!listingBusy) setListingToClose(null); }} label="结束发布">
    <SheetHeading title="结束这条发布？" description="结束后不能恢复或编辑，公开分享链接也会失效。" color="coral"/>
    <div className="sheet-actions"><button className="secondary-button" disabled={listingBusy} onClick={() => setListingToClose(null)}>取消</button><button className="primary-button" disabled={listingBusy} onClick={() => changeListing(listingToClose.id, "closed")}>{listingBusy ? "正在结束…" : "确认结束"}</button></div>
  </Modal>}
  {listingDialog && <Modal onClose={() => { if (!listingBusy) setListingDialog(null); }} label="编辑需要或提供">
    <SheetHeading eyebrow={listingDialog.type === "need" ? "我想要" : "我可以给"} title="编辑内容" description="修改自己发布的内容，保存后更新展示。" color={listingDialog.type === "need" ? "pink" : "green"}/>
    <div className="manual-form">
      <label><span>内容</span><textarea rows={4} value={listingDraft.detail} onChange={(event) => setListingDraft((draft) => ({ ...draft, detail: event.target.value }))}/></label>
      <label><span>{listingDialog.type === "need" ? "愿意给出" : "希望收到"}（可选）</span><input value={listingDraft.reference} onChange={(event) => setListingDraft((draft) => ({ ...draft, reference: event.target.value }))}/></label>
    </div>
    <span className="form-label">发布到哪些圈子</span>
    <div className="circle-picker">{myCircleIds.map((id) => circleById(id)).filter((circle): circle is Circle => Boolean(circle)).map((circle) => <button key={circle.id} type="button" className={listingDraft.circleIds.includes(circle.id) ? "active" : ""} onClick={() => setListingDraft((draft) => ({ ...draft, circleIds: draft.circleIds.includes(circle.id) ? draft.circleIds.filter((id) => id !== circle.id) : [...draft.circleIds, circle.id] }))}>{circle.name}</button>)}</div>
    <span className="form-label">可见范围</span>
    <div className="manual-choice"><button type="button" className={listingDraft.visibility === "circle" ? "active" : ""} onClick={() => setListingDraft((draft) => ({ ...draft, visibility: "circle" }))}>仅所选圈子</button><button type="button" className={listingDraft.visibility === "cross-circle" ? "active" : ""} onClick={() => setListingDraft((draft) => ({ ...draft, visibility: "cross-circle" }))}>跨圈公开</button></div>
    {listingError && <p className="account-error" role="alert">{listingError}</p>}
    <div className="sheet-actions"><button className="secondary-button" disabled={listingBusy} onClick={() => setListingDialog(null)}>取消</button><button className="primary-button" disabled={listingBusy} onClick={saveListingDialog}>{listingBusy ? "正在保存…" : "保存修改"}</button></div>
  </Modal>}
  {transactionDialog && <Modal onClose={() => { if (!transactionBusy) setTransactionDialog(null); }} label={transactionDialog.kind === "edit" ? "申请修改记录" : "申请撤销记录"}>
    <SheetHeading eyebrow={transactionDialog.kind === "edit" ? "申请修改" : "申请撤销"} title={transactionDialog.kind === "edit" ? "要改成什么样？" : "申请撤销这笔记录？"} description={transactionDialog.transaction.title} color={transactionDialog.kind === "edit" ? "blue" : "coral"}/>
    {transactionDialog.kind === "edit"
      ? <div className="manual-form">
          <label><span>社区货币数量</span><input aria-label="社区货币数量" type="number" min="1" step="1" inputMode="numeric" value={draftAmount} onChange={(event) => setDraftAmount(event.target.value)}/><small>当前是 {transactionDialog.transaction.amount} {transactionDialog.currency}。</small></label>
          <label><span>发生了什么</span><textarea aria-label="发生了什么" value={draftStory} onChange={(event) => setDraftStory(event.target.value)} rows={5}/></label>
          <label><span>可见范围</span><select aria-label="可见范围" value={draftVisibility} onChange={(event) => setDraftVisibility(event.target.value as Transaction["visibility"])}>
            <option value="public">圈内公开</option><option value="mystery">神秘记录（圈内只看到额度）</option>
            {transactionDialog.transaction.visibility === "private" && <option value="private">仅双方可见</option>}
          </select>{draftVisibility === "public" && transactionDialog.transaction.visibility !== "public" && <small>公开后，圈内成员会看到上面这段描述和双方名字。</small>}</label>
          <small className="soft-note">可以只改其中一项。对方同意前，原记录和双方额度都不变。</small>
        </div>
      : <div className="transaction-warning"><b>{transactionDialog.transaction.amount} {transactionDialog.currency}</b><p>对方同意后，这笔记录按当前额度整笔退回双方，并保留“已撤销”的记录；对方拒绝或你撤回，什么都不会变。</p></div>}
    {transactionError && <p className="account-error" role="alert">{transactionError}</p>}
    <div className="sheet-actions"><button className="secondary-button" disabled={transactionBusy} onClick={() => setTransactionDialog(null)}>取消</button><button className={`primary-button ${transactionDialog.kind === "revoke" ? "danger-button" : ""}`} disabled={transactionBusy} onClick={submitTransactionDialog}>{transactionBusy ? "正在提交…" : transactionDialog.kind === "edit" ? "发送修改申请" : "发送撤销申请"}</button></div>
  </Modal>}
  </>;
}


type CirclePreview = {
  circle: { id: string; name: string; icon: string | null; color: string | null; description: string | null; currency: string | null; joining: "direct" | "approval"; discoverability: string; member_count: number; rules: string[]; references: { name: string; value: string; note?: string }[] };
  membership_status: "active" | "pending" | null;
  can_apply: boolean;
};
function CirclePreviewSheet({ circleId, onClose, onJoin }: { circleId: string; onClose: () => void; onJoin: (circle: DiscoverableCircle) => Promise<void> }) {
  const [data, setData] = useState<CirclePreview | "error" | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/circles/${encodeURIComponent(circleId)}/preview`, { cache: "no-store" })
      .then(async (response) => { const result = await response.json().catch(() => ({})) as CirclePreview; if (alive) setData(response.ok && result.circle ? result : "error"); })
      .catch(() => { if (alive) setData("error"); });
    return () => { alive = false; };
  }, [circleId]);
  if (data === null) return <Modal onClose={onClose} label="圈子介绍"><SheetHeading eyebrow="圈子介绍" title="正在读取…" color="cream"/></Modal>;
  if (data === "error") return <Modal onClose={onClose} label="圈子介绍"><SheetHeading eyebrow="圈子介绍" title="打不开这个圈子" description="它可能只接受邀请，或者已经不存在。" color="cream"/></Modal>;
  const c = data.circle;
  const discoverable: DiscoverableCircle = { id: c.id, name: c.name, short: c.icon || c.name.slice(0, 1), color: "green", currency: c.currency || "积分", members: c.member_count, tagline: c.description || "", joining: c.joining, discoverability: c.discoverability === "public" ? "public" : "invite_only", pending: data.membership_status === "pending" };
  async function act() { try { setBusy(true); await onJoin(discoverable); } finally { setBusy(false); } }
  return <Modal onClose={onClose} label={`${c.name}介绍`} wide>
    <SheetHeading eyebrow="圈子介绍" title={c.name} description={c.description || undefined} meta={`${c.currency || "积分"} · ${c.member_count} 位成员 · ${c.joining === "approval" ? "加入需审批" : "可直接加入"}`} color="green" visual={<CircleGlyph icon={discoverable.short} seed={c.id} size="small"/>}/>
    {c.references.length > 0 && <><SectionTitle title="协商参考"/><div className="reference-detail-grid">{c.references.map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}</div></>}
    {c.rules.length > 0 && <><SectionTitle title="圈子约定"/><section className="rule-list">{c.rules.map((rule, index) => <div key={rule}><b>{String(index + 1).padStart(2, "0")}</b><p>{rule}</p></div>)}</section></>}
    <p className="soft-note">记下的互助立即入账，修改或撤销需要双方同意。{c.joining === "approval" ? "圈主同意前，你看不到圈内成员和记录。" : ""}</p>
    <div className="sheet-actions sheet-actions-single">
      {data.membership_status === "active" ? <button className="secondary-button" onClick={onClose}>你已经在这个圈子里</button>
        : data.membership_status === "pending" ? <button className="secondary-button" disabled={busy} onClick={act}>{busy ? "正在撤回…" : "撤回申请"}</button>
        : data.can_apply ? <button className="primary-button" disabled={busy} onClick={act}>{busy ? "正在提交…" : c.joining === "approval" ? "申请加入" : "加入圈子"}</button>
        : <button className="secondary-button" disabled>这个圈子只接受邀请</button>}
    </div>
  </Modal>;
}

function RulesSheet({ circle, onClose }: { circle: Circle; onClose: () => void }) {
  const { references, rules, allowNegativeBalance, requireConfirmation, allowRejectCorrect } = circle.settings;
  const circleRules = [
    requireConfirmation ? "完成互助后，需对方确认才入账。" : "完成互助后，一方记录就能入账。",
    allowRejectCorrect ? "修改或撤销记录需对方同意。" : "这条圈子暂不支持修改记录。",
    allowNegativeBalance ? "可以先接受帮助，余额可以为负。" : "接受帮助前需要有足够余额。",
    ...rules.filter((rule) => rule.trim() !== "允许负余额"),
  ];
  return <Modal onClose={onClose} label={`${circle.name}介绍与约定`} wide>
    <SheetHeading eyebrow="圈子规则" title={circle.name} description={circle.tagline || undefined} meta={`${circle.currency} · ${circle.members} 位成员 · ${circle.joining === "approval" ? "新成员申请需圈主审批" : "新成员可直接加入"}`} color={circle.color} visual={<CircleGlyph icon={circle.short} seed={circle.id} size="small"/>}/>
    <SectionTitle title="互助参考"/>
    {references.length > 0
      ? <div className="reference-detail-grid">{references.map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}</div>
      : <p className="soft-note">还没有互助参考。具体数量可以由双方商量。</p>}
    <SectionTitle title="圈子规则"/>
    <section className="rule-list">{circleRules.map((rule, index) => <div key={`${index}-${rule}`}><b>{String(index + 1).padStart(2, "0")}</b><p>{rule}</p></div>)}</section>
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

  return <><Modal onClose={onClose} label={`${circle.name}全部成员`} wide><SheetHeading eyebrow={`${circle.members} 位成员`} title={`${circle.name}的成员`} color={circle.color}/>{requests.length > 0 && <section className="request-list"><SectionTitle title={`${requests.length} 个人在等你放行`}/>{requests.map((request) => <article key={request.member.id}><Character member={request.member}/><div><b>{request.member.name}<GenderSymbol member={request.member}/></b><small>{request.member.handle} · {request.requestedAt}</small>{request.note && <p>“{request.note}”</p>}</div><div className="request-actions"><button className="primary-button" disabled={busy} onClick={() => run(() => onResolve(circle.id, request.member.id, "approve"))}>通过</button><button className="secondary-button" disabled={busy} onClick={() => run(() => onResolve(circle.id, request.member.id, "decline"))}>谢绝</button></div></article>)}</section>}<div className="member-list">{circleMembers.map((member,index) => { const account = accountFor(member.id, circle.id); const offer = activeDb.listings.find((listing) => listing.memberId === member.id && listing.type === "offer" && listing.status === "active"); return <button key={member.id || `unknown-${index}`} disabled={!isKnown(member)} onClick={() => onProfile(member.id)}><span className="member-index">0{index+1}</span><Character member={member}/><span><b>{member.name}<GenderSymbol member={member}/></b><small>{member.handle}<GenderSymbol member={member}/></small><p>{offer?.detail || offer?.title || member.bio}</p></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div><button className="primary-button" onClick={onInvite}>＋ 邀请成员</button>
    {isOwner && others.length > 0 && <section className="transfer-owner"><SectionTitle title="转让圈主"/><p className="soft-note">对方将负责审批与设置。</p><div className="transfer-list">{others.map((member) => <button key={member.id} disabled={actionBusy} onClick={() => setMemberAction({ kind: "transfer", member })}><Character member={member} small/><span><b>{member.name}<GenderSymbol member={member}/></b><small>{member.handle}<GenderSymbol member={member}/></small></span><strong>转让 →</strong></button>)}</div></section>}
    <section className="leave-circle"><SectionTitle title="退出圈子"/><p className="soft-note">{blocker || "历史记录保留；余额归零；发布内容关闭。"}</p><button className="text-link danger" disabled={blocker !== "" || actionBusy} onClick={() => setMemberAction({ kind: "leave" })}>退出 {circle.name}</button></section></Modal>
    {memberAction && <Modal onClose={() => { if (!actionBusy) setMemberAction(null); }} label={memberAction.kind === "transfer" ? "确认转让圈主" : "确认退出圈子"}>
      <SheetHeading eyebrow={memberAction.kind === "transfer" ? "转让圈主" : "退出圈子"} title={memberAction.kind === "transfer" ? `转让给 ${memberAction.member.name}？` : `退出 ${circle.name}？`} description={memberAction.kind === "transfer" ? "对方将接管审批和设置；你仍是普通成员。" : "发布内容将关闭，历史记录保留。"} color={memberAction.kind === "transfer" ? "blue" : "coral"}/>
      <div className="sheet-actions"><button className="secondary-button" disabled={actionBusy} onClick={() => setMemberAction(null)}>取消</button><button className={`primary-button ${memberAction.kind === "leave" ? "danger-button" : ""}`} disabled={actionBusy} onClick={confirmMemberAction}>{actionBusy ? "正在处理…" : memberAction.kind === "transfer" ? "确认转让" : "确认退出"}</button></div>
    </Modal>}
  </>;
}

type InviteLink = { id: string; url: string; type: "regular" | "owner_direct"; expiresAt: string };
type ManagedInvite = { id: string; type: "regular" | "owner_direct"; status: string; expires_at: string; used_count: number; created_by_id: string };

function inviteExpiry(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function InviteSheet({ circle, onClose, onNotice }: { circle: Circle; onClose: () => void; onNotice: (message: string) => void }) {
  const isOwner = circle.ownerId === activeDb.currentMemberId;
  const [kind, setKind] = useState<"regular" | "owner_direct">("regular");
  const [invite, setInvite] = useState<InviteLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [managed, setManaged] = useState<ManagedInvite[] | "error" | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  async function loadManaged() {
    try {
      const response = await fetch(`/api/invitations?circleId=${encodeURIComponent(circle.id)}`, { cache: "no-store" });
      const result = await response.json() as { invitations?: ManagedInvite[] };
      if (!response.ok || !result.invitations) throw new Error();
      setManaged(result.invitations);
    } catch { setManaged("error"); }
  }
  useEffect(() => {
    let alive = true;
    fetch(`/api/invitations?circleId=${encodeURIComponent(circle.id)}`, { cache: "no-store" })
      .then(async (response) => { const result = await response.json().catch(() => ({})) as { invitations?: ManagedInvite[] }; if (alive) setManaged(response.ok && result.invitations ? result.invitations : "error"); })
      .catch(() => { if (alive) setManaged("error"); });
    return () => { alive = false; };
  }, [circle.id]);

  // A regular link lasts 7 days and works for any number of people, so one is
  // reused until the person asks for a fresh one or switches type.
  async function ensureInvite(): Promise<InviteLink | null> {
    if (invite && invite.type === kind) return invite;
    try {
      setCreating(true);
      const response = await fetch("/api/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ circleId: circle.id, type: kind }) });
      const result = await response.json() as { id?: string; url?: string; type?: InviteLink["type"]; expiresAt?: string; error?: string };
      if (!response.ok || !result.url || !result.id) throw new Error(result.error || "邀请创建失败");
      const created = { id: result.id, url: result.url, type: result.type || kind, expiresAt: result.expiresAt || "" };
      setInvite(created);
      void loadManaged();
      return created;
    } catch (error) { onNotice(error instanceof Error ? error.message : "邀请创建失败"); return null; }
    finally { setCreating(false); }
  }

  async function copyInvite() { const link = await ensureInvite(); if (!link) return; try { await navigator.clipboard.writeText(link.url); onNotice(isLocalUrl(link.url) ? "已复制本地测试链接，只能在这台电脑打开" : link.type === "owner_direct" ? "专属邀请已复制，持链接可直接加入" : "邀请链接已复制，7 天内可供多人使用"); } catch { onNotice("复制失败，请手动复制链接"); } }
  async function saveImage() { if (!invite) { onNotice("请先生成邀请图"); return; } try { await savePosterImage(posterRef.current, `${circle.name}-邀请`); onNotice("邀请图片已保存"); } catch { onNotice("保存失败，请稍后再试"); } }
  async function revoke(id: string) {
    const response = await fetch(`/api/invitations/${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { onNotice(result.error || "撤销失败"); return; }
    if (invite?.id === id) setInvite(null);
    onNotice("邀请已撤销，这个链接不能再用了");
    void loadManaged();
  }

  const current = invite && invite.type === kind ? invite : null;
  const label = kind === "owner_direct" ? "圈主专属 · 持链接可直接加入，无需审批" : `普通邀请 · 7 天内可供多人使用${circle.joining === "approval" ? " · 加入需审批" : ""}`;

  return <Modal onClose={onClose} label={`邀请加入${circle.name}`}>
    <SheetHeading eyebrow={kind === "owner_direct" ? "圈主专属邀请" : "圈子邀请"} title={`邀请加入 ${circle.name}`} color={circle.color}/>
    {kind === "owner_direct" && <button className="text-link" disabled={creating} onClick={() => setKind("regular")}>← 返回普通邀请</button>}
    <div ref={posterRef} className={`mini-invite-poster hero-${circle.color}${current ? " has-code" : ""}`}><CircleGlyph icon={circle.short} seed={circle.id} size="regular"/><span>{kind === "owner_direct" ? "圈主的专属邀请" : "来自圈内伙伴的邀请"}</span><h3>来 {circle.name}<br/>看看我们还能怎样互相帮助</h3><p>{kind === "owner_direct" ? "持链接可直接加入，无需审批" : circle.joining === "approval" ? "加入需要圈主审批" : "加入无需审批"}</p>{current && <QrCode value={current.url} className="mini-code"/>}</div>
    {current ? <div className="invite-url-box"><span>图片二维码与下方链接相同</span><b>{current.url}</b></div> : <button className="primary-button invite-generate" disabled={creating} onClick={() => void ensureInvite()}>{creating ? "正在生成…" : kind === "owner_direct" ? "生成专属邀请" : "生成邀请"}</button>}
    <p className="invite-limit-note">{label}{current?.expiresAt ? ` · 有效至 ${inviteExpiry(current.expiresAt)}` : ""}</p>
    {current && isLocalUrl(current.url) && <p className="local-link-warning">本地测试地址，仅这台电脑可打开。</p>}
    <div className="sheet-actions invite-sheet-actions"><button className="secondary-button" disabled={creating || !current} onClick={saveImage}>保存图片</button><button className="primary-button" disabled={creating || !current} onClick={copyInvite}>复制链接</button></div>
    {isOwner && kind === "regular" && <button className="text-link invite-owner-link" disabled={creating} onClick={() => setKind("owner_direct")}>无需审批的邀请通道 →</button>}
    <SectionTitle title={isOwner ? "圈内有效邀请" : "我发出的有效邀请"}/>
    {managed === null ? <p className="soft-note">正在读取…</p>
      : managed === "error" ? <p className="soft-note">邀请列表没能读取。</p>
      : managed.length === 0 ? <p className="soft-note">现在没有有效邀请。</p>
      : <ul className="invite-manage">{managed.map((item) => <li key={item.id}><span><b>{item.type === "owner_direct" ? "专属邀请" : "普通邀请"}</b><small>有效至 {inviteExpiry(item.expires_at)} · 已有 {item.used_count} 人使用</small></span><button onClick={() => void revoke(item.id)}>撤销</button></li>)}</ul>}
  </Modal>;
}

// Four-step create wizard. Every field maps to something loop-backend stores:
// Circle identity plus the references and rules kept in `circle.settings`.
type CreateCircleInput = {
  name: string; short: string; currency: string; tagline: string; joining: string; discoverability: "public" | "invite_only";
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
  // New circles start with owner approval and stay out of discovery until the
  // owner says otherwise; the bookkeeping rules are the same for every circle.
  const [joining, setJoining] = useState("approval");
  const [discoverability, setDiscoverability] = useState<"public" | "invite_only">("invite_only");
  const [referenceName, setReferenceName] = useState("");
  const [referenceValue, setReferenceValue] = useState("");
  const [rules, setRules] = useState("");
  const steps = ["圈子身份", "互助设置", "成员与边界", "预览确认"];
  const unit = currency || "社区货币";
  const ruleList = rules.split("\n").map((line) => line.trim()).filter(Boolean);
  // Name and unit are the only things loop requires. They live on step 1, so
  // catch them there rather than letting someone fill in three more screens
  // and get turned away at the end.
  const missing = !name.trim() ? "请先填写圈子名称" : !currency.trim() ? "请先给社区货币起个名字" : "";
  const referenceError = (referenceName.trim() === "") !== (referenceValue.trim() === "") ? "互助参考需要同时填写名称和社区货币数量；也可以两项都留空" : "";
  const ruleError = ruleList.length > 10 ? `圈子约定最多 10 条，目前有 ${ruleList.length} 条` : "";
  const stepError = step === 1 ? missing : step === 2 ? referenceError : step === 3 ? ruleError : "";
  const blocked = stepError !== "";
  const canEnterStep = (target: number) => !(target > 1 && missing) && !(target > 2 && referenceError) && !(target > 3 && ruleError);

  if (saved) return <section className="create-success"><div className="success-burst">✓</div><Pill color="green">已创建</Pill><h2>{name}<br/>准备好了。</h2><div className="created-passport"><CircleGlyph icon={short} seed={name} size="regular"/><div><span>新的圈子</span><h3>{name}</h3><p>{currency} · 加入需圈主审批</p></div><b>已创建</b></div><div className="create-actions"><button className="primary-button" onClick={onExit}>回到我的圈子</button></div></section>;

  return <section className="create-page">
    <div className="create-intro"><div><Pill color="green">创建圈子</Pill><h2>给一段关系，<br/>画出边界。</h2></div><button onClick={onExit}>退出</button></div>

    <nav className="create-progress" aria-label="创建圈子步骤">{steps.map((label, index) => <button key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} disabled={!canEnterStep(index + 1)} onClick={() => setStep(index + 1)}><b>{step > index + 1 ? "✓" : `0${index + 1}`}</b><span>{label}</span></button>)}</nav>

    <div className="create-panel">
      {step === 1 && <><div className="create-heading"><span>STEP 01 · IDENTITY</span><h2>圈子身份</h2></div><div className="create-form-grid"><label className="wide"><span>圈子名称</span><input value={name} maxLength={40} placeholder="例如：周末手作营地" onChange={(event) => setName(event.target.value)}/></label><label><span>社区货币名称</span><input value={currency} maxLength={20} placeholder="例如：泡泡" onChange={(event) => setCurrency(event.target.value)}/></label><label className="wide"><span>一句话介绍</span><textarea value={tagline} maxLength={120} placeholder="一起做东西，也一起分享工具、经验和时间。" onChange={(event) => setTagline(event.target.value)}/></label></div><div className="circle-icon-picker"><div className="circle-icon-picker-heading"><span className="form-label">选择圈子图案</span></div>{CIRCLE_ICON_GROUPS.map((group) => <section key={group.label}><header><b>{group.label}</b></header><div>{group.keys.map((key) => <button key={key} type="button" className={short === key ? "selected" : ""} onClick={() => setShort(key)} aria-label={`选择${CIRCLE_ICON_LABELS[key]}圈子图案`}><CircleGlyph icon={key} seed={key} size="small"/><span>{CIRCLE_ICON_LABELS[key]}</span></button>)}</div></section>)}</div></>}

      {step === 2 && <><div className="create-heading"><span>STEP 02 · MUTUAL CREDIT</span><h2>互助设置</h2></div><div className="mechanism-card"><div className="mechanism-icon">＋<br/>−</div><div><Pill color="yellow">互助账户</Pill><h3>成员共同记账</h3></div></div><div className="reference-editor"><div><span>互助参考</span><input value={referenceName} placeholder="一小时协作" onChange={(event) => setReferenceName(event.target.value)}/></div><div><span>大约多少社区货币</span><input value={referenceValue} placeholder={`约 5 ${unit}`} onChange={(event) => setReferenceValue(event.target.value)}/></div></div><div className="create-rule-note"><b>默认圈子规则</b><p>一方记录即入账；修改需对方同意；可以先接受帮助。</p></div></>}

      {step === 3 && <><div className="create-heading"><span>STEP 03 · GOVERNANCE</span><h2>成员与边界</h2></div><span className="form-label">新成员怎么加入</span><div className="create-choice-row two"><button className={joining === "approval" ? "active" : ""} onClick={() => setJoining("approval")}><b>管理员审批</b></button><button className={joining === "direct" ? "active" : ""} onClick={() => setJoining("direct")}><b>受邀直接加入</b></button></div><span className="form-label">谁能找到这个圈子</span><div className="create-choice-row two"><button className={discoverability === "invite_only" ? "active" : ""} onClick={() => setDiscoverability("invite_only")}><b>仅凭邀请访问</b></button><button className={discoverability === "public" ? "active" : ""} onClick={() => setDiscoverability("public")}><b>在发现页公开展示</b></button></div><label className="typing-box"><span>圈子约定（一行一条，最多 10 条）</span><textarea rows={5} value={rules} onChange={(event) => setRules(event.target.value)} placeholder={"可以开口，也可以拒绝\n敏感互助可以不记录\n成员可以随时暂停或退出"}/><small className={ruleError ? "field-count over" : "field-count"}>{ruleList.length} / 10</small></label></>}

      {step === 4 && <><div className="create-heading"><span>STEP 04 · REVIEW</span><h2>创建前确认</h2></div><article className="circle-draft-preview"><header><CircleGlyph icon={short} seed={name} size="large"/><div><Pill color="cream">新圈预览</Pill><h2>{name || "未命名圈子"}</h2><p>{tagline || "还没有写一句话介绍"}</p></div></header><div className="draft-summary"><div><span>社区货币</span><b>{currency || "未命名"}</b><small>不兑换人民币</small></div><div><span>加入方式</span><b>{joining === "direct" ? "直接加入" : "圈主审批"}</b><small>{discoverability === "public" ? "在发现页公开" : "仅凭邀请"}</small></div><div><span>互助参考</span><b>{referenceName || "暂未设置"}</b><small>{referenceValue}</small></div></div><ul><li>记录已完成的互助，立即入账</li><li>双方可提出修改，需对方同意</li><li>余额可为负，表示曾接受帮助</li>{ruleList.map((rule) => <li key={rule}>{rule}</li>)}</ul><footer><span>可以问，也可以拒绝。</span></footer></article>{error && <div className="review-warning"><b>创建失败</b><p>{error}</p></div>}</>}

      <div className="create-footer">{blocked && <p className="step-hint">{stepError}</p>}<button className="secondary-button" onClick={() => step === 1 ? onExit() : setStep(step - 1)}>{step === 1 ? "取消" : "← 上一步"}</button>{step < 4 ? <button className="primary-button" disabled={blocked} onClick={() => setStep(step + 1)}>继续：{steps[step]} →</button> : <button className="primary-button" disabled={saving} onClick={async () => { try { setSaving(true); setError(""); await onDone({ name: name.trim(), short, currency: currency.trim(), tagline: tagline.trim(), joining, discoverability, references: referenceName.trim() ? [{ name: referenceName.trim(), value: referenceValue.trim(), note: "" }] : [], rules: ruleList }); setSaved(true); } catch(error) { setError(error instanceof Error ? error.message : "创建失败"); } finally { setSaving(false); } }}>{saving ? "正在创建…" : "创建圈子"}</button>}</div>
    </div>
  </section>;
}

function FeedFilterSheet({ active, onSelect, onClose }: { active: FeedFilter; onSelect: (filter: FeedFilter) => void; onClose: () => void }) {
  const options: {id: FeedFilter; title: string; color: Color}[] = [
    {id:"all",title:"全部动态",color:"yellow"},
    {id:"trade",title:"互助记录",color:"blue"},
    {id:"need",title:"我想要",color:"pink"},
    {id:"offer",title:"我可以给",color:"green"},
    {id:"card",title:"好人好事",color:"coral"},
  ];
  return <Modal onClose={onClose} label="筛选圈子动态"><SheetHeading title="筛选动态"/><div className="filter-menu">{options.map((item) => <button key={item.id} className={`${active === item.id ? "active" : ""} filter-${item.color}`} onClick={() => onSelect(item.id)}><span/><div><b>{item.title}</b></div><strong>{active === item.id ? "✓" : "→"}</strong></button>)}</div></Modal>;
}

function PostSheet({ post, contactRequested, onProfile, onShare, onNotice, onClose }: { post: Post; contactRequested: boolean; onProfile: () => void; onShare: () => void; onNotice: (message: string) => void; onClose: () => void }) {
  const [contact, setContact] = useState(contactRequested);
  const author = memberById(post.memberId);
  const otherListing = post.source === "listing" && post.memberId !== activeDb.currentMemberId;
  const shareable = canSharePost(post);
  async function copyContact() {
    try { if (!author.wechat) return; await navigator.clipboard.writeText(author.wechat); onNotice("已复制联系方式"); }
    catch { onNotice("复制失败，请手动复制"); }
  }
  const circle = circleById(post.circleIds[0]) ?? EMPTY_CIRCLE;
  const names = post.circleIds.map((id) => circleById(id)?.name).filter(Boolean);
  const details: { label: string; value: string }[] = [
    { label: names.length > 1 ? "所属圈子" : "所属圈子", value: names.join("、") || "—" },
  ];
  if (post.source === "listing") {
    const listing = activeDb.listings.find((item) => item.id === post.sourceId)!;
    if (listing.reference) details.push({ label: listing.type === "need" ? "愿意给出" : "希望收到", value: listing.reference });
    details.push({ label: "可见范围", value: listing.visibility === "cross-circle" ? "跨圈公开" : "相关圈子" });
  } else if (post.source === "transaction") {
    const transaction = activeDb.transactions.find((item) => item.id === post.sourceId)!;
    const status = transaction.status === "confirmed" ? "已确认" : transaction.status === "corrected" ? "已更正" : transaction.status === "pending" ? "待对方确认" : "已撤销";
    details.push({ label: "记录时间", value: transaction.recordedAt }, { label: "社区货币与状态", value: `${transaction.amount} ${circle.currency} · ${status}` }, { label: "可见范围", value: transaction.visibility === "mystery" ? "圈内神秘记录" : transaction.visibility === "private" ? "仅当事人" : "圈内公开" });
  } else {
    const card = activeDb.goodCards.find((item) => item.id === post.sourceId)!;
    details.push({ label: "写下日期", value: card.date }, { label: "可见范围", value: card.visibility === "cross-circle" ? "跨圈公开" : "接收者已隐藏" }, { label: "余额", value: "不变" });
  }
  return <Modal onClose={onClose} label="动态详情"><SheetHeading eyebrow={post.badge} title={post.person} description={post.caption} color={post.color} visual={<Character member={post.memberId ? author : undefined} text={post.memberId ? undefined : post.avatar} color={post.color} variant={post.avatarVariant} small/>}/><div className={`post-detail detail-${post.color}`}><p className="post-detail-copy">{post.text}</p></div><div className="detail-meta">{details.map((detail) => <div key={detail.label}><span>{detail.label}</span><b>{detail.value}</b></div>)}</div>{otherListing && contact && <div className="contact-reveal post-contact"><span>联系方式</span><b>{author.wechat || "未填写"}</b></div>}<div className={`sheet-actions ${!otherListing && !shareable ? "sheet-actions-single" : ""}`}>{post.memberId && post.memberId !== activeDb.currentMemberId ? <button className="secondary-button" onClick={onProfile}>成员主页</button> : <button className="secondary-button" onClick={onClose}>关闭</button>}{otherListing ? <button className="primary-button" disabled={contact && !author.wechat} onClick={contact ? copyContact : () => setContact(true)}>{contact ? (author.wechat ? "复制联系方式" : "未填写") : `联系${author.name}`}</button> : shareable ? <button className="primary-button" onClick={onShare}>{post.source === "card" ? "分享这件好人好事" : "分享这条内容"}</button> : null}</div></Modal>;
}

function NotificationsSheet({ notifications, onClose, onOpen }: { notifications: AppDatabase["notifications"]; onClose: () => void; onOpen: (destination: NotificationDestination, circleId?: string, recordId?: string) => void }) {
  function describe(n: AppDatabase["notifications"][number]): { badge: string; color: Color; line: string; destination?: NotificationDestination; actionLabel?: string } {
    const actor = memberById(n.actorId);
    const who = isKnown(actor) ? actor.name : "有人";
    const circle = circleById(n.circleId);
    const where = circle?.name;
    const unit = circle?.currency ?? "社区货币";
    // Record events name their record; older ones are matched heuristically below.
    const record = n.recordId ? activeDb.transactions.find((item) => item.id === n.recordId) : undefined;
    const named = record?.title ? `「${record.title}」` : "这笔记录";
    const settled = (t: Transaction | undefined) => {
      if (t?.status === "rejected") return { badge: "已撤销", color: "blue" as Color, line: `${who} 的这笔记录已经撤销，不需要再确认` };
      if (t?.status === "corrected") return { badge: "已更正", color: "green" as Color, line: `${who} 的这笔记录已按更正后的数量入账`, destination: "transactions" as const, actionLabel: "查看记录" };
      if (t?.status === "confirmed") return { badge: "已确认", color: "green" as Color, line: `${who} 的这笔记录已经确认入账`, destination: "transactions" as const, actionLabel: "查看记录" };
      return { badge: "已处理", color: "blue" as Color, line: `${who} 的这笔记录已经处理，不需要再确认` };
    };
    switch (n.kind) {
      case "record_confirmation_requested":
        if (record?.status === "pending") return { badge: "待你处理", color: "yellow", line: `${who} 记了一笔 ${n.amount} ${unit}${n.note ? `：${n.note}` : ""}，等你确认`, destination: "transactions", actionLabel: "去确认" };
        return settled(record);
      case "correction_proposed":
        if (record?.pendingCorrection && record.pendingCorrection.proposedById === n.actorId) return { badge: "更正提议", color: "blue", line: `${who} 提议把${named}改成 ${n.amount} ${unit}，等你确认`, destination: "transactions", actionLabel: "去处理" };
        return { badge: "已处理", color: "blue", line: `${who} 对${named}的更正提议已经处理`, destination: record ? "transactions" : undefined, actionLabel: "查看记录" };
      case "correction_resolved": {
        const outcome = n.text === "accepted" ? `接受了你的更正，${named}按 ${n.amount} ${unit} 入账` : n.text === "declined" ? `谢绝了对${named}的更正，原来记下的数量不变` : `撤回了对${named}的更正提议`;
        return { badge: n.text === "accepted" ? "已更正" : "更正已处理", color: n.text === "accepted" ? "green" : "blue", line: `${who} ${outcome}`, destination: record ? "transactions" : undefined, actionLabel: "查看记录" };
      }
      case "revision_proposed": {
        const open = record?.pendingRevision && record.pendingRevision.id === n.revisionId;
        const what = n.text === "revoke" ? "申请撤销" : "申请修改";
        if (open) return { badge: n.text === "revoke" ? "申请撤销" : "申请修改", color: "blue", line: `${who}${what}${named}，等你同意`, destination: "transactions", actionLabel: "去处理" };
        return { badge: "已处理", color: "blue", line: `${who}对${named}的${n.text === "revoke" ? "撤销" : "修改"}申请已经处理`, destination: record ? "transactions" : undefined, actionLabel: "查看记录" };
      }
      case "revision_resolved": {
        const outcome = n.text === "accepted" ? "同意了你的申请" : n.text === "declined" ? "拒绝了你的申请，记录保持原样" : "撤回了申请";
        const revoked = record?.status === "rejected";
        return { badge: n.text === "accepted" ? (revoked ? "已撤销" : "已修改") : "已处理", color: n.text === "accepted" ? "green" : "blue", line: `${who}${outcome}${n.text === "accepted" ? (revoked ? `，${named}已撤销，额度已退回` : `，${named}已按新内容生效`) : ""}`, destination: record ? "transactions" : undefined, actionLabel: "查看记录" };
      }
      case "record_rejected":
        return { badge: "已撤销", color: "blue", line: `${who} 撤销了${named}，双方的社区货币余额已调整`, destination: record ? "transactions" : undefined, actionLabel: "查看记录" };
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
        const correction = activeDb.transactions.find((item) => item.circleId === n.circleId && item.pendingCorrection?.proposedById === n.actorId && item.pendingCorrection.amount === n.amount);
        if (correction) return { badge: "更正提议", color: "blue", line: `${who} 提议把「${correction.title}」改成 ${n.amount} ${unit}，等你确认`, destination: "transactions", actionLabel: "去处理" };
        const candidates = activeDb.transactions.filter((transaction) => transaction.circleId === n.circleId && transaction.createdById === n.actorId && transaction.amount === n.amount);
        const transaction = candidates.find((item) => item.title === n.note) ?? candidates.find((item) => item.status === "pending") ?? candidates[0];
        if (transaction?.status === "pending") return { badge: "待你处理", color: "yellow", line: `${who} 记了一笔 ${n.amount} ${unit}${n.note ? `：${n.note}` : ""}，等你确认`, destination: "transactions", actionLabel: "去确认" };
        return settled(transaction);
      }
      case "received": return { badge: "互助记录", color: "yellow", line: `${who} 记下了一笔 ${n.amount ?? ""} ${unit}${n.note ? `：${n.note}` : ""}`, destination: "transactions", actionLabel: "查看记录" };
      case "badge": return { badge: "好人好事", color: "coral", line: `${who} 记录了你的一件好事${n.note ? `：“${n.note}”` : ""}`, destination: "cards", actionLabel: "查看好人好事" };
      default: return { badge: "动态", color: "blue", line: n.text || `${who} 有新的动态` };
    }
  }

  return <Modal onClose={onClose} label="通知" wide>
    <SheetHeading eyebrow="通知" title="需要处理的事" color="yellow"/>
    {notifications.length === 0
      ? <div className="empty-archive">还没有通知</div>
      : <div className="archive-list notification-list">{notifications.map((n) => { const { badge, color, line, destination, actionLabel } = describe(n); const open = () => destination && onOpen(destination, n.circleId, n.recordId || undefined); return <article key={n.id} className={n.read ? "" : "unread"}>{destination ? <button className="notification-item" onClick={open}><header><Pill color={color}>{badge}</Pill><small>{n.createdAt}</small></header><p>{line}</p><span className="notification-action">{actionLabel} →</span></button> : <><header><Pill color={color}>{badge}</Pill><small>{n.createdAt}</small></header><p>{line}</p></>}</article>; })}</div>}
  </Modal>;
}

// Owner-only circle settings: the three mutual-aid toggles plus the free-text
// references and rules loop keeps in `circle.settings`.
function CircleSettingsSheet({ circle, onClose, onSaved, onNotice }: { circle: Circle; onClose: () => void; onSaved: () => Promise<void>; onNotice: (message: string) => void }) {
  const [currency, setCurrency] = useState(circle.currency);
  const [joining, setJoining] = useState<"approval" | "direct">(circle.joining);
  const [tagline, setTagline] = useState(circle.tagline);
  // An unknown value is never assumed public.
  const [discoverability, setDiscoverability] = useState<"public" | "invite_only">(circle.discoverability === "public" ? "public" : "invite_only");
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
      if (!nextCurrency) { setError("社区货币名称不能为空"); return; }
      if (incompleteReference) { setError("每条参考物都需要同时填写名称和社区货币数量"); return; }
      if (nextRules.length > 10) { setError("圈子约定最多 10 条，请先合并或删除多余内容"); return; }
      setSaving(true);
      setError("");
      const response = await fetch(`/api/circles/${circle.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({
        currency: nextCurrency, tagline: tagline.trim(), joining, discoverability,
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
    <SheetHeading eyebrow="圈主设置" title={circle.name} color={circle.color}/>
    <div className="manual-form">
      <label><span>社区货币名称</span><input value={currency} maxLength={20} onChange={(e) => setCurrency(e.target.value)}/></label>
      <label><span>一句话介绍</span><textarea value={tagline} rows={2} maxLength={120} onChange={(e) => setTagline(e.target.value)}/></label>
    </div>
    <fieldset className="circle-joining-setting"><legend>新成员如何加入</legend><label><input type="radio" name="joining" checked={joining === "approval"} onChange={() => setJoining("approval")}/><span><b>需要圈主审批</b><small>新成员申请后，由圈主决定是否加入</small></span></label><label><input type="radio" name="joining" checked={joining === "direct"} onChange={() => setJoining("direct")}/><span><b>无需审批，直接加入</b><small>圈子介绍页和普通邀请都可直接加入</small></span></label></fieldset>
    <div className="manual-form">
      <span className="form-label">谁能找到这个圈子</span>
      <div className="manual-choice"><button className={discoverability === "public" ? "active" : ""} onClick={() => setDiscoverability("public")}>在发现页公开展示</button><button className={discoverability === "invite_only" ? "active" : ""} onClick={() => setDiscoverability("invite_only")}>仅凭邀请访问</button></div>
      <small className="soft-note">{discoverability === "public" ? "所有登录的人都能在发现页看到圈名、介绍和约定，并申请加入。" : "不出现在发现页；只有拿到邀请链接的人能看到介绍并加入。"}{circle.discoverability === "unknown" ? " 当前设置没能读取，保存后以这里的选择为准。" : ""}</small>
    </div>
    <span className="form-label">记账规则</span>
    <p className="soft-note">所有圈子统一：记下即入账，允许负余额，修改或撤销需对方同意。圈主不能调整。</p>
    <span className="form-label">互助参考（最多 8 条）</span>
    <div className="reference-editor-list">{references.map((item, index) => <div key={index}>
      <input value={item.name} placeholder="一晚住宿" onChange={(e) => editReference(index, "name", e.target.value)}/>
      <input value={item.value} placeholder={`约 10 ${currency}`} onChange={(e) => editReference(index, "value", e.target.value)}/>
      <input value={item.note} placeholder="说明（可选）" onChange={(e) => editReference(index, "note", e.target.value)}/>
      <button type="button" className="remove-reference" onClick={() => removeReference(index)} aria-label={`删除第 ${index + 1} 条参考物`}>删除</button>
    </div>)}</div>
    {references.length < 8 && <button className="text-link" onClick={() => setReferences([...references, { name: "", value: "", note: "" }])}>＋ 再加一条参考物</button>}
    <label className="typing-box"><span>圈子约定（一行一条，最多 10 条）</span><textarea rows={4} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={"可以开口，也可以拒绝\n敏感互助可以不记录\n成员可以随时退出"}/></label>
    {error && <p className="account-error" role="alert">{error}</p>}
    <div className="sheet-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving} onClick={save}>{saving ? "正在保存…" : "保存设置"}</button></div>
  </Modal>;
}

// The editable part of a loop account: display name, bio and contact handle.
function EditProfileSheet({ member, onClose, onSaved, onNotice }: { member: Member; onClose: () => void; onSaved: () => Promise<void>; onNotice: (message: string) => void }) {
  const [name, setName] = useState(member.name);
  const [bio, setBio] = useState(member.bio);
  const [wechat, setWechat] = useState(member.wechat);
  const [gender, setGender] = useState<Member["gender"]>(member.gender ?? null);
  const [avatar, setAvatar] = useState<AvatarVariant>(member.avatar);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    try {
      if (!name.trim()) { setError("显示名称不能为空"); return; }
      setSaving(true);
      setError("");
      const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), bio: bio.trim(), wechat: wechat.trim(), avatar, gender }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      const checked = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!checked.ok) throw new Error("资料已提交，暂时无法核对性别是否保存。请刷新确认。");
      const world = await checked.json() as AppDatabase;
      if ((world.members.find((item) => item.id === member.id)?.gender ?? null) !== gender)
        throw new Error("性别保存结果不一致，请保留选择并稍后重试。");
      await onSaved();
      onClose();
      onNotice("个人资料已保存");
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  }

  return <Modal onClose={onClose} label="编辑资料">
    <SheetHeading eyebrow={member.handle} title="编辑资料" color="cream"/>
    <div className="manual-form">
      <label><span>显示名称</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)}/></label>
      <label><span>性别</span><select value={gender ?? ""} onChange={(event) => setGender(event.target.value === "male" ? "male" : event.target.value === "female" ? "female" : null)}><option value="">不显示</option><option value="male">男 ♂</option><option value="female">女 ♀</option></select></label>
      <label><span>一句话介绍</span><input value={bio} maxLength={80} onChange={(e) => setBio(e.target.value)} placeholder="例如：喜欢把坏掉的东西拆开"/></label>
      <label><span>联系方式 / 微信号（同圈可见）</span><input value={wechat} maxLength={60} onChange={(e) => setWechat(e.target.value)}/></label>
    </div>
    <AvatarWorkshop value={avatar} seed={member.id} onChange={setAvatar} renderAvatar={(value) => <Character variant={value} color={member.color}/>}/>
    <div className="detail-meta"><div><span>用户名</span><b>{member.handle}</b></div><div><span>地址</span><b>{member.address ? `${member.address.slice(0, 10)}…` : "—"}</b></div></div>
    {error && <p className="account-error" role="alert">{error}</p>}
    <div className="sheet-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving} onClick={save}>{saving ? "正在保存…" : "保存"}</button></div>
  </Modal>;
}
