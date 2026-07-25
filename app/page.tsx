"use client";

import { useEffect, useMemo, useState } from "react";
import type { AvatarVariant, Circle, Color, DiscoverableCircle, Member } from "./types";
import type { AppDatabase } from "../db/runtime";
import type { ComposeInput } from "./api/records/route";

type View = "feed" | "discover" | "circle" | "me" | "about" | "create";
type ComposerType = "record" | "need" | "offer" | "card";
type FeedFilter = "all" | "trade" | "need" | "offer" | "card";
type DiscoverFilter = "all" | "need" | "offer" | "circles";
type ProfileTab = "cards" | "listings" | "transactions";
type Overlay = "share" | "profile" | "rules" | "members" | "invite" | "feedFilter" | "post" | "settings" | "circleSettings" | "editProfile" | null;

type Post = {
  id: number;
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
  circleId: string;
  source: "listing" | "card" | "transaction";
  sourceId: string;
};

// Empty world until the loop-backend session loads — no demo/default user.
const initialDb: AppDatabase = { members: [], circles: [], accounts: [], listings: [], goodCards: [], transactions: [], activity: [], settings: { publicCards: true, publicListings: true, keepHiddenPrivate: true }, session: { authenticated: false }, currentMemberId: "" };
const EMPTY_SETTINGS: Circle["settings"] = { allowNegativeBalance: false, requireConfirmation: false, allowRejectCorrect: false, references: [], rules: [] };
const EMPTY_CIRCLE: Circle = { id: "", name: "", short: "•", color: "green", currency: "积分", members: 0, tagline: "", joining: "direct", settings: EMPTY_SETTINGS, ownerId: "", isMember: false, memberIds: [] };
let activeDb = initialDb;
let members = activeDb.members;
let circles = activeDb.circles;

const AVATAR_VARIANTS: AvatarVariant[] = ["crop", "wave", "cap", "bob", "spike", "curl", "bun", "leaf"];

// Stable face variant for things that aren't people (circles), so a circle chip
// looks the same everywhere without storing a variant loop doesn't have.
function variantFor(seed: string): AvatarVariant {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_VARIANTS[h % AVATAR_VARIANTS.length];
}

function memberById(id?: string) {
  return members.find((member) => member.id === id) ?? members[0];
}

function circleById(id?: string) {
  return circles.find((circle) => circle.id === id) ?? circles[0];
}

function accountFor(memberId: string, circleId: string) {
  return activeDb.accounts.find((account) => account.memberId === memberId && account.circleId === circleId) ?? { memberId, circleId, balance: 0, given: 0, received: 0 };
}

function buildPosts(): Post[] {
  const result: Post[] = [];
  for (const activity of activeDb.activity) {
    if (activity.source === "listing") {
      const listing = activeDb.listings.find((item) => item.id === activity.sourceId);
      const member = activeDb.members.find((item) => item.id === listing?.memberId);
      const circle = activeDb.circles.find((item) => item.id === listing?.circleIds[0]);
      if (!listing || !member || !circle) continue;
      result.push({ id: activity.id, kind: listing.type, badge: listing.type === "need" ? "我想要" : "我可以给", person: member.name, caption: member.handle, memberId: member.id, avatar: member.initial, avatarVariant: member.avatar, color: listing.type === "need" ? "pink" : "green", text: listing.detail || listing.title, meta: [circle.name, listing.location].filter(Boolean).join(" · "), chips: listing.tags, circleId: circle.id, source: activity.source, sourceId: listing.id });
      continue;
    }
    if (activity.source === "card") {
      const card = activeDb.goodCards.find((item) => item.id === activity.sourceId);
      const from = activeDb.members.find((item) => item.id === card?.fromMemberId);
      const to = activeDb.members.find((item) => item.id === card?.toMemberId);
      if (!card || !from || !to) continue;
      result.push({ id: activity.id, kind: "card", badge: "好人卡", person: `${from.name} → ${to.name}`, caption: card.visibility === "cross-circle" ? "跨圈公开" : "已隐藏", memberId: to.id, avatar: to.initial, avatarVariant: to.avatar, color: "coral", text: card.story, meta: `${card.date} · 被好好看见`, chips: [], circleId: card.circleId, source: activity.source, sourceId: card.id });
      continue;
    }
    const transaction = activeDb.transactions.find((item) => item.id === activity.sourceId);
    const provider = activeDb.members.find((item) => item.id === transaction?.providerId);
    const receiver = activeDb.members.find((item) => item.id === transaction?.receiverId);
    const circle = activeDb.circles.find((item) => item.id === transaction?.circleId);
    if (!transaction || !provider || !receiver || !circle) continue;
    const mystery = transaction.visibility === "mystery";
    const pending = transaction.status === "pending";
    result.push({ id: activity.id, kind: mystery ? "mystery" : "trade", badge: mystery ? "神秘记录" : pending ? "待确认" : "互助完成", person: mystery ? "圈里发生了一次互助" : `${provider.name} → ${receiver.name}`, caption: mystery ? "身份与故事已隐藏" : pending ? "等待另一方确认" : transaction.visibility === "private" ? "仅当事人" : "圈内公开", memberId: mystery ? undefined : provider.id, avatar: mystery ? "?" : provider.initial, avatarVariant: mystery ? "crop" : provider.avatar, color: mystery ? "blue" : "yellow", text: transaction.story || transaction.title, meta: `${circle.name} · ${transaction.amount} ${circle.currency}`, chips: transaction.tags, circleId: circle.id, source: activity.source, sourceId: transaction.id });
  }
  return result;
}

let posts = buildPosts();

const intents: { id: ComposerType; label: string; hint: string; color: Color; icon: string }[] = [
  { id: "record", label: "记一笔", hint: "已经完成的互助", color: "yellow", icon: "记" },
  { id: "need", label: "我想要", hint: "向圈子发出请求", color: "pink", icon: "要" },
  { id: "offer", label: "我可以给", hint: "让能力被发现", color: "green", icon: "给" },
  { id: "card", label: "好人卡", hint: "把感谢留下来", color: "blue", icon: "心" },
];

function Character({ member, text, color = "yellow", variant = "crop", small = false }: { member?: Member; text?: string; color?: Color; variant?: AvatarVariant; small?: boolean }) {
  const active = member ?? { initial: text ?? "友", color, avatar: variant };
  const faces: Record<AvatarVariant, { eyes: string; smile: string }> = {
    crop: { eyes: "•  •", smile: "⌣" }, wave: { eyes: "◕  ◕", smile: "⌄" }, cap: { eyes: "•  ◡", smile: "︶" }, bob: { eyes: "^  ^", smile: "⌣" },
    spike: { eyes: "•  •", smile: "ᴗ" }, curl: { eyes: "◠  ◠", smile: "⌄" }, bun: { eyes: "•  •", smile: "◡" }, leaf: { eyes: "˘  ˘", smile: "⌣" },
  };
  const face = faces[active.avatar];
  return <span className={`character character-${active.color} face-${active.avatar} ${small ? "character-small" : ""}`} aria-hidden="true"><i className="character-hair"/><i className="character-eyes">{face.eyes}</i><i className="character-smile">{face.smile}</i><b>{active.initial}</b></span>;
}

function Pill({ children, color = "cream" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill pill-${color}`}>{children}</span>;
}

function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="section-title"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<b>→</b></button>}</div>;
}

function LoginGate({ onDone }: { onDone: () => Promise<void> }) {
  const [step, setStep] = useState<"email" | "code" | "profile">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  return <main className="join-page"><section className="join-card">
    <span>FLOW CIRCLE · 登录流动圈</span>
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
  const [selectedPostId, setSelectedPostId] = useState(0);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>("all");
  const [openCircles, setOpenCircles] = useState<DiscoverableCircle[]>([]);
  const [toast, setToast] = useState("");

  activeDb = db; members = db.members; circles = db.circles; posts = buildPosts();
  const currentMemberId = db.currentMemberId;

  async function refreshData() {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    const payload = await response.json() as AppDatabase & { error?: string };
    if (!response.ok) throw new Error(payload.error || "数据加载失败");
    setDb(payload);
    loadOpenCircles();
  }

  // Circles the user could still join (loop's `GET /circles`, minus their own).
  function loadOpenCircles() {
    fetch("/api/circles", { cache: "no-store" })
      .then(async (r) => { const d = await r.json() as { circles?: DiscoverableCircle[] }; if (r.ok) setOpenCircles(d.circles ?? []); })
      .catch(() => { /* discovery is optional; the rest of the app still works */ });
  }

  async function joinCircle(circle: DiscoverableCircle) {
    try {
      const response = await fetch(`/api/circles/${circle.id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "加入失败");
      await refreshData();
      flash(circle.joining === "approval" ? `已申请加入${circle.name}，等待圈主确认` : `已加入${circle.name}`);
    } catch (error) { flash(error instanceof Error ? error.message : "加入失败"); }
  }

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    setView("feed");
    setDb(initialDb); // session.authenticated=false → the login gate takes over
  }

  useEffect(() => {
    let active=true;
    fetch("/api/bootstrap",{cache:"no-store"}).then(async (response)=>{const payload=await response.json() as AppDatabase&{error?:string};if(!response.ok)throw new Error(payload.error||"数据加载失败");if(active){setDb(payload);loadOpenCircles();}}).catch((error)=>{if(active)flash(error instanceof Error?error.message:"暂时无法连接数据服务");}).finally(()=>{if(active)setLoaded(true);});
    return()=>{active=false;};
  }, []);

  // After signing in, auto-accept a pending invite carried as ?join=<token>
  // (from the invite landing page's "前往登录" link).
  useEffect(() => {
    if (!db.session.authenticated) return;
    const joinToken = new URLSearchParams(window.location.search).get("join");
    if (!joinToken) return;
    window.history.replaceState({}, "", "/");
    fetch(`/api/invitations/${encodeURIComponent(joinToken)}`, { method: "POST" })
      .then(async (r) => { const d = (await r.json().catch(() => ({}))) as { status?: string; error?: string }; if (r.ok) { await refreshData(); flash(d.status === "pending" ? "已申请加入，等待管理员确认" : "已加入圈子"); } else { flash(d.error || "加入失败"); } })
      .catch(() => {});
  }, [db.session.authenticated]);

  const activeCircle = circles.find((item) => item.id === circleId) ?? circles[0] ?? EMPTY_CIRCLE;
  const activeAccount = accountFor(currentMemberId, activeCircle.id);
  const selectedMember = memberById(selectedMemberId);
  const selectedPost = posts.find((post) => post.id === selectedPostId);
  const isCircleOwner = activeCircle.ownerId === currentMemberId && activeCircle.id !== "";
  const feedPosts = useMemo(() => posts.filter((post) => {
    if (feedCircleId !== "all" && post.circleId !== feedCircleId) return false;
    if (feedFilter === "all") return true;
    if (feedFilter === "trade") return post.kind === "trade" || post.kind === "mystery";
    return post.kind === feedFilter;
  }), [feedFilter, feedCircleId]);
  const discoverPosts = useMemo(() => posts.filter((post) => {
    if (post.kind !== "need" && post.kind !== "offer") return false;
    if (discoverFilter === "all" || discoverFilter === "circles") return true;
    return post.kind === discoverFilter;
  }), [discoverFilter]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  // Auth gate: wait for the first bootstrap, then require a loop-backend session.
  if (!loaded) return <main className="world-shell login-splash"><p>正在连接流动圈…</p></main>;
  if (!db.session.authenticated) return <LoginGate onDone={async () => { setLoaded(false); await refreshData(); setLoaded(true); }}/>;

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
    setView("create");
  }

  function openProfile(id?: string, tab: ProfileTab = "cards") {
    if (!id) return;
    setSelectedMemberId(id); setProfileTab(tab); setOverlay("profile");
  }

  function openPost(id: number) {
    setSelectedPostId(id); setOverlay("post");
  }

  async function submitCompose(input: ComposeInput) {
    const response = await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "保存失败");
    await refreshData(); setComposer(false);
    flash(input.intent === "record" ? "记录已进入圈子，对方可以修改或拒绝" : input.intent === "card" ? "好人卡已送到对方的跨圈主页" : "已经发布，可以生成分享图啦");
  }

  if (circles.length === 0 && view !== "create") {
    return <AccountStartView member={memberById(currentMemberId)} openCircles={openCircles} onSaved={refreshData} onJoin={joinCircle} onCreate={openCreateCircle} onLogout={logout}/>;
  }

  return <main className="world-shell">
    <aside className="circle-dock" aria-label="我的圈子地图">
      <button className={`brand-mark ${view === "about" ? "active" : ""}`} onClick={() => setView("about")} aria-label="了解流动圈"><span>流动圈</span><b>FLOW CIRCLE · 了解我们 →</b></button>
      <div className="dock-heading"><span>我的地图</span><b>{String(circles.length).padStart(2,"0")}</b></div>
      <button className={`dock-all ${feedCircleId === "all" && view === "feed" ? "active" : ""}`} onClick={showAllCircles}><span>◎</span><b>全部圈子动态</b><strong>{posts.length}</strong></button>
      <div className="dock-list">{circles.filter((item) => memberById(currentMemberId).circleIds.includes(item.id)).map((item) => { const account = accountFor(currentMemberId, item.id); return <button key={item.id} className={`dock-circle dock-${item.color} ${feedCircleId === item.id ? "active" : ""}`} onClick={() => selectCircle(item.id)}><Character text={item.short} color={item.color} variant={variantFor(item.id)} small/><span><b>{item.name}</b><small>{item.currency}</small></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div>
      <button className="new-circle" onClick={openCreateCircle}><b>＋</b><span>创建新圈子</span></button>
      <p className="dock-note">每个圈子都有自己的成员、规则和互助额度，彼此不合并、不兑换。</p>
    </aside>

    <section className="phone-stage">
      <div className={`app-frame ${view === "about" || view === "create" ? "about-open" : ""}`}>
        <header className="topbar"><button className={`brand-mini ${view === "about" ? "active" : ""}`} onClick={() => setView("about")} aria-label="了解流动圈"><span>流</span><i/></button><div><p>{view === "about" ? "FLOW CIRCLE · 产品概念" : view === "create" ? "NEW CIRCLE · 创建向导" : "我的圈子动态"}</p><h1>{view === "about" ? "关于流动圈" : view === "create" ? "创建新圈子" : `你好，${memberById(currentMemberId).name}！`}</h1></div><button className="avatar-button" onClick={() => setView("me")} aria-label="打开我的主页"><Character member={memberById(currentMemberId)}/></button></header>
        {view !== "about" && view !== "create" && <nav className="circle-switcher" aria-label="切换动态范围"><button className={`all-switch ${feedCircleId === "all" && view === "feed" ? "selected" : ""}`} onClick={showAllCircles}><span className="circle-dot dot-all"/><span>全部圈子</span><b>{posts.length}</b></button>{circles.filter((item) => memberById(currentMemberId).circleIds.includes(item.id)).map((item) => { const account = accountFor(currentMemberId, item.id); return <button key={item.id} className={feedCircleId === item.id ? "selected" : ""} onClick={() => selectCircle(item.id)}><span className={`circle-dot dot-${item.color}`}/><span>{item.name}</span><b>{account.balance > 0 ? "+" : ""}{account.balance}</b></button>; })}</nav>}
        <div className="view-content">
          {view === "about" && <AboutView onExplore={showAllCircles} onCreate={openCreateCircle} onCircle={(id) => selectCircle(id, "circle")}/>}
          {view === "create" && <CreateCircleView onExit={() => setView("me")} onDone={async (input) => {
            const response=await fetch("/api/circles",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)}); const result=await response.json() as {error?:string};
            if(!response.ok) throw new Error(result.error||"创建失败"); await refreshData(); flash(`${input.name}已经创建，可以邀请成员了`);
          }}/>} 
          {view === "feed" && <FeedView activeCircle={activeCircle} activeAccount={activeAccount} isAllCircles={feedCircleId === "all"} posts={feedPosts} filter={feedFilter} onSpeak={openComposer} onCircle={() => setView("circle")} onMe={() => setView("me")} onProfile={openProfile} onShare={() => setOverlay("share")} onFilter={() => setOverlay("feedFilter")} onPost={openPost}/>}
          {view === "discover" && <DiscoverView posts={discoverPosts} filter={discoverFilter} setFilter={setDiscoverFilter} openCircles={openCircles} onJoin={joinCircle} onSpeak={openComposer} onProfile={openProfile} onShare={() => setOverlay("share")} onPost={openPost}/>}
          {view === "circle" && <CircleView circle={activeCircle} account={activeAccount} posts={posts.filter((post) => post.circleId === activeCircle.id)} isOwner={isCircleOwner} onSpeak={openComposer} onProfile={openProfile} onShare={() => setOverlay("share")} onPost={openPost} onRules={() => setOverlay("rules")} onMembers={() => setOverlay("members")} onInvite={() => setOverlay("invite")} onSettings={() => setOverlay("circleSettings")}/>}
          {view === "me" && <MeView onShare={() => setOverlay("share")} onCard={() => openComposer("card")} onCreate={openCreateCircle} onSettings={() => setOverlay("settings")} onEditProfile={() => setOverlay("editProfile")} onCircle={(id) => selectCircle(id, "circle")} onArchive={(tab) => openProfile(currentMemberId, tab)} onLogout={logout}/>}
        </div>
        <nav className="bottom-nav" aria-label="主要导航">
          <button className={view === "feed" ? "active" : ""} onClick={() => setView("feed")}><span className="nav-icon">⌂</span><small>动态</small></button>
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><span className="nav-icon">◇</span><small>发现</small></button>
          <button className="compose-slot" onClick={() => openComposer()} aria-label="记一笔"><span className="compose-orb">＋</span><small>记一笔</small></button>
          <button className={view === "circle" ? "active" : ""} onClick={() => setView("circle")}><span className="nav-icon">▦</span><small>圈子</small></button>
          <button className={view === "me" ? "active" : ""} onClick={() => setView("me")}><span className="nav-icon">☺</span><small>我的</small></button>
        </nav>
      </div>
    </section>

    <aside className="world-panel">
      <div className="world-card world-card-main"><span className="world-kicker">TODAY IN YOUR CIRCLES</span><h2>今天，圈里有<br/><em>{posts.length} 件事</em>在流动</h2><div className="world-stats"><span><b>{posts.filter((post) => post.kind === "need" || post.kind === "offer").length}</b>需要 / 提供</span><span><b>{posts.filter((post) => post.kind === "trade" || post.kind === "mystery").length}</b>互助完成</span><span><b>{posts.filter((post) => post.kind === "card").length}</b>张好人卡</span></div></div>
      <button className="world-card value-card value-card-button" onClick={() => { setView("circle"); setOverlay("rules"); }}><span className="world-kicker">这个圈怎么估量</span><h3>{activeCircle.name}</h3>{activeCircle.settings.references.slice(0,2).map((item) => <div key={item.name}><b>{item.name}</b><span>{item.value}</span></div>)}<p>只是协商参考，不是统一价格。点击查看完整规则。</p></button>
      <div className="world-rule"><b>可以问，<br/>也可以拒绝。</b><span>NO PRESSURE · NO RANKING</span></div>
    </aside>

    {composer && <ComposerSheet circleId={activeCircle.id} intent={intent} setIntent={setIntent} onClose={() => setComposer(false)} onSubmit={submitCompose} onNotice={flash}/>} 
    {overlay === "share" && <ShareSheet onClose={() => setOverlay(null)} onDone={async () => {
      const me=memberById(currentMemberId); const canShare=typeof navigator.share==="function";
      if(canShare) await navigator.share({title:`${me.name}的流动清单`,text:"可以问，也可以拒绝。",url:location.href}); else await navigator.clipboard.writeText(location.href); setOverlay(null); flash(canShare?"已经交给系统分享":"页面链接已复制，可以发到微信群");
    }}/>} 
    {overlay === "profile" && selectedMember && <ProfileSheet member={selectedMember} activeCircleId={circleId} initialTab={profileTab} onClose={() => setOverlay(null)} onNotice={flash} onChanged={refreshData}/>} 
    {overlay === "rules" && <RulesSheet circle={activeCircle} onClose={() => setOverlay(null)}/>}
    {overlay === "members" && <MembersSheet circle={activeCircle} onProfile={openProfile} onInvite={() => setOverlay("invite")} onClose={() => setOverlay(null)}/>}
    {overlay === "invite" && <InviteSheet circle={activeCircle} onClose={() => setOverlay(null)} onNotice={flash}/>}
    {overlay === "feedFilter" && <FeedFilterSheet active={feedFilter} onSelect={(next) => { setFeedFilter(next); setOverlay(null); }} onClose={() => setOverlay(null)}/>}
    {overlay === "post" && selectedPost && <PostSheet post={selectedPost} onProfile={() => selectedPost.memberId && openProfile(selectedPost.memberId)} onShare={() => setOverlay("share")} onClose={() => setOverlay(null)}/>}
    {overlay === "settings" && <SettingsSheet settings={db.settings} onClose={() => setOverlay(null)} onSaved={async () => { await refreshData(); flash("公开设置已经保存"); }}/>} 
    {overlay === "circleSettings" && <CircleSettingsSheet circle={activeCircle} onClose={() => setOverlay(null)} onSaved={refreshData} onNotice={flash}/>}
    {overlay === "editProfile" && <EditProfileSheet member={memberById(currentMemberId)} onClose={() => setOverlay(null)} onSaved={refreshData} onNotice={flash}/>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}

// Shown while the signed-in user belongs to no circle yet: fill in the profile,
// then either create a circle or join an open one.
function AccountStartView({ member, openCircles, onSaved, onJoin, onCreate, onLogout }: { member: Member; openCircles: DiscoverableCircle[]; onSaved: () => Promise<void>; onJoin: (circle: DiscoverableCircle) => Promise<void>; onCreate: () => void; onLogout: () => void }) {
  const [name,setName]=useState(member.name);
  const [bio,setBio]=useState(member.bio);
  const [wechat,setWechat]=useState(member.wechat);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);

  async function saveProfile() {
    try {
      setSaving(true); setError("");
      const response=await fetch("/api/profile",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({name,bio,wechat})});
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
    <div className="account-brand"><span>流</span><b>FLOW CIRCLE</b></div>
    <Pill color="green">{member.handle}</Pill>
    <h1>先完善档案，<br/>再找到你的圈子。</h1>
    <p>这里只记录你愿意公开的社区身份。真实协商仍然发生在微信或线下。</p>
    <div className="account-form">
      <label><span>怎么称呼你</span><input value={name} onChange={(event)=>setName(event.target.value)} placeholder="昵称"/></label>
      <label><span>一句话介绍（可稍后填写）</span><input value={bio} maxLength={80} onChange={(event)=>setBio(event.target.value)} placeholder="例如：喜欢把坏掉的东西拆开"/></label>
      <label><span>联系方式 / 微信号（可稍后填写）</span><input value={wechat} maxLength={60} onChange={(event)=>setWechat(event.target.value)} placeholder="只对同圈成员显示"/></label>
    </div>
    {error&&<p className="account-error">{error}</p>}
    <button className="primary-button" disabled={saving} onClick={saveProfile}>{saving?"正在保存…":saved?"已保存 ✓":"保存档案"}</button>
    <div className="account-next"><button className="secondary-button" onClick={onCreate}>创建第一个圈子</button></div>
    {openCircles.length > 0 && <div className="open-circle-list">
      <b>或者加入一个已经开放的圈子</b>
      {openCircles.map((circle) => <button key={circle.id} onClick={() => onJoin(circle)}><span className={`camp-flag flag-${circle.color}`}>{circle.short}</span><span><b>{circle.name}</b><small>{circle.currency} · {circle.members} 人 · {circle.joining === "approval" ? "需审批" : "可直接加入"}</small></span><strong>加入 →</strong></button>)}
    </div>}
    <div className="account-boundary"><b>还没有圈子，不是错误。</b><span>加入圈子后，这里才会出现对应的成员、余额和互助记录。</span></div>
    <button className="account-signout" onClick={onLogout}>退出登录，换一个账号</button>
  </section></main>;
}

function AboutView({ onExplore, onCreate, onCircle }: { onExplore: () => void; onCreate: () => void; onCircle: (id: string) => void }) {
  const concepts = [
    { number: "01", title: "圈子", color: "pink", text: "每个圈子都有独立的成员、规则、参考物和互助额度。加入多个圈子，也不会把不同关系混成一笔账。" },
    { number: "02", title: "互助额度", color: "yellow", text: "只记录已经完成的互助。正负余额是社区记忆，不是钱、信用分或贡献排名。" },
    { number: "03", title: "需要 / 提供", color: "green", text: "让大家看见彼此正在寻找什么、又能给出什么。发布不会改变余额，答应也从来不是义务。" },
    { number: "04", title: "好人卡", color: "blue", text: "把一段值得记住的善意留给一个人。它可以跨圈展示，但没有金额，不产生债务，也不能兑换。" },
  ];
  const steps = [
    ["先在真实关系里发生", "聊天、协商和确认仍在微信或线下。流动圈不取代人与人的判断。"],
    ["发生之后，记一笔", "填几个字段，生成一份可检查、可修改的草稿。"],
    ["确认后，留下一层记忆", "记录进入对应圈子；另一方仍可修改或拒绝，敏感互助也可以不记录。"],
  ];
  return <div className="about-page">
    <section className="about-hero">
      <div className="about-orbit orbit-one"/><div className="about-orbit orbit-two"/><div className="about-grid-mark"/>
      <Pill color="cream">FLOW CIRCLE · 流动圈</Pill>
      <h2>让帮助被记得，<br/>但不让数字定义关系。</h2>
      <p>现实中的协商仍在微信或线下；流动圈只提供一层轻量的社区记忆，让互助、需要、能力和感谢可以继续流动。</p>
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
      <p className="about-lead">下面是你已经加入的圈子。它们不是不同的产品，而是各自独立的社区关系。</p>
      <div className="about-circles">{circles.map((circle, index) => <button key={circle.id} className={`about-circle about-circle-${circle.color}`} onClick={() => onCircle(circle.id)}><span className="about-circle-number">0{index + 1}</span><Character text={circle.short} color={circle.color} variant={variantFor(circle.id)} small/><div><small>{circle.currency}</small><h3>{circle.name}</h3><p>{circle.tagline}</p></div><b>进入圈子 →</b></button>)}</div>
    </section>

    <section className="about-boundaries">
      <div><span>KEEP IT HUMAN</span><h2>有些事，流动圈明确不做。</h2></div>
      <ul><li>不与人民币兑换，也不是支付工具</li><li>不做贡献榜、信用分或道德排名</li><li>不要求每次帮助都留下记录</li><li>不把不同圈子的额度互相兑换</li><li>可以开口，也可以拒绝、暂停或离开</li><li>敏感互助可以神秘记录，或者完全不记录</li></ul>
    </section>

    <blockquote className="about-manifesto"><span>“</span><p>数字是影子，关系是实体。<br/>没有记录的善意，仍然成立。</p><b>流动圈 · FLOW CIRCLE</b></blockquote>
  </div>;
}

function ComposeHero({ onSpeak }: { onSpeak: (intent?: ComposerType) => void }) {
  return <section className="agent-hero"><div className="hero-decor decor-grid"/><div className="hero-decor decor-square"/><div className="hero-decor decor-circle"/><div className="agent-orb"><i className="agent-antenna"/><span>＋</span><b>记一笔</b></div><div className="agent-copy"><Pill color="cream">FLOW · 社区记忆</Pill><h2>事情发生之后，<br/>留下一层记忆。</h2><p>填几个字段就好，确认之前都可以修改。</p></div><button className="speak-button" onClick={() => onSpeak()}><span>●</span><b>记一笔</b><small>互助 · 需要 · 提供 · 好人卡</small></button></section>;
}

function FeedView({ activeCircle, activeAccount, isAllCircles, posts: list, filter, onSpeak, onCircle, onMe, onProfile, onShare, onFilter, onPost }: { activeCircle: Circle; activeAccount: ReturnType<typeof accountFor>; isAllCircles: boolean; posts: Post[]; filter: FeedFilter; onSpeak: (intent?: ComposerType) => void; onCircle: () => void; onMe: () => void; onProfile: (id?: string) => void; onShare: () => void; onFilter: () => void; onPost: (id: number) => void }) {
  const labels: Record<FeedFilter,string> = { all: "全部动态", trade: "互助记录", need: "只看需要", offer: "只看提供", card: "好人卡" };
  const myCards = activeDb.goodCards.filter((card) => card.toMemberId === activeDb.currentMemberId && card.visibility === "cross-circle").length;
  const totalGiven = activeDb.accounts.filter((account) => account.memberId === activeDb.currentMemberId).reduce((sum, account) => sum + account.given, 0);
  const scopeTitle = isAllCircles ? "全部圈子" : activeCircle.name;
  return <><ComposeHero onSpeak={onSpeak}/><section className="scope-banner"><span>{isAllCircles ? "综合动态" : "当前圈子"}</span><b>{scopeTitle}</b><small>{list.length} 条符合当前筛选的动态</small></section><section className="stats-grid" aria-label="当前动态范围概览"><button className="stat-card stat-yellow" onClick={isAllCircles ? onMe : onCircle}><span>{isAllCircles ? "已加入圈子" : "当前额度"}</span><strong>{isAllCircles ? memberById(activeDb.currentMemberId).circleIds.length : `${activeAccount.balance > 0 ? "+" : ""}${activeAccount.balance}`}</strong><small>{isAllCircles ? "每个圈有独立账户" : `${activeCircle.currency} · ${activeCircle.name}`}</small></button><button className="stat-card stat-pink" onClick={onMe}><span>我给出过</span><strong>{isAllCircles ? totalGiven : activeAccount.given}</strong><small>{isAllCircles ? "各圈的社区记忆" : "不是排名，是记忆"}</small></button><button className="stat-card stat-blue" onClick={() => onProfile(activeDb.currentMemberId)}><span>好人卡</span><strong>{myCards}</strong><small>跨圈跟着我</small></button></section><SectionTitle eyebrow="LIVE FROM THE CIRCLE" title={`${scopeTitle} · ${labels[filter]}`} action={`筛选 · ${list.length}`} onAction={onFilter}/><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>;
}

function DiscoverView({ posts: list, filter, setFilter, openCircles, onJoin, onSpeak, onProfile, onShare, onPost }: { posts: Post[]; filter: DiscoverFilter; setFilter: (filter: DiscoverFilter) => void; openCircles: DiscoverableCircle[]; onJoin: (circle: DiscoverableCircle) => Promise<void>; onSpeak: (intent?: ComposerType) => void; onProfile: (id?: string) => void; onShare: () => void; onPost: (id: number) => void }) {
  const options: {id: DiscoverFilter; label: string}[] = [{id:"all",label:"全部"},{id:"need",label:"我想要"},{id:"offer",label:"我可以给"},{id:"circles",label:`可加入的圈子 ${openCircles.length}`}];
  return <><section className="page-hero discover-hero"><div><Pill color="pink">跨圈发现</Pill><h2>有人在寻找，<br/>也有人正好可以给。</h2><p>看到“可以提供”，不代表对方必须答应。先问问就好。</p></div><button onClick={() => onSpeak("need")}>＋ 发布</button></section>
    <div className="filter-row" aria-label="发现筛选">{options.map((item) => <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
    {filter === "circles"
      ? (openCircles.length === 0
          ? <p className="result-note">目前没有可以直接加入的圈子。圈子大多靠熟人邀请——找一个认识的人要一条邀请链接。</p>
          : <><p className="result-note">{openCircles.length} 个你还没加入的圈子</p><div className="open-circle-list">{openCircles.map((circle) => <button key={circle.id} onClick={() => onJoin(circle)}><span className={`camp-flag flag-${circle.color}`}>{circle.short}</span><span><b>{circle.name}</b><small>{circle.tagline || `${circle.currency} · ${circle.members} 人`}</small></span><strong>{circle.joining === "approval" ? "申请 →" : "加入 →"}</strong></button>)}</div></>)
      : <><p className="result-note">找到 {list.length} 条仍然有效的内容</p><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>}</>;
}

function CircleView({ circle, account, posts: circlePosts, isOwner, onSpeak, onProfile, onShare, onPost, onRules, onMembers, onInvite, onSettings }: { circle: Circle; account: ReturnType<typeof accountFor>; posts: Post[]; isOwner: boolean; onSpeak: (intent?: ComposerType) => void; onProfile: (id?: string) => void; onShare: () => void; onPost: (id: number) => void; onRules: () => void; onMembers: () => void; onInvite: () => void; onSettings: () => void }) {
  const { references } = circle.settings;
  return <><section className={`page-hero circle-hero hero-${circle.color}`}><div><Pill color="cream">我的营地 · {circle.currency}</Pill><h2>{circle.name}</h2><p>{circle.tagline}</p></div><div className="coin-badge"><span>{account.balance > 0 ? "+" : ""}{account.balance}</span><small>{circle.currency}</small></div></section>
    <div className="circle-actions"><button onClick={() => onSpeak()}>＋ 记一笔</button><button onClick={onInvite}>邀请成员</button><button onClick={onRules}>圈子介绍</button>{isOwner && <button onClick={onSettings}>圈子设置</button>}</div>
    <button className="camp-preview" onClick={onRules}><span className={`camp-flag flag-${circle.color}`}>{circle.short}</span><div><small>CAMP PROFILE</small><h3>{circle.tagline || "还没有写圈子介绍"}</h3><p>{circle.joining === "approval" ? "加入需管理员审批" : "受邀可直接加入"} · {circle.members} 位成员</p></div><b>进入介绍 →</b></button>
    <section className="balance-panel"><div><span>当前额度</span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong><small>我在这个圈的流动额度</small></div><div><span>给出过</span><strong>{account.given}</strong><small>来自真实互助</small></div><div><span>收到过</span><strong>{account.received}</strong><small>接受帮助也很好</small></div></section>
    <SectionTitle eyebrow="REFERENCE" title="圈内参考物" action={isOwner ? "编辑" : "查看规则"} onAction={isOwner ? onSettings : onRules}/>
    {references.length > 0
      ? <div className="reference-grid">{references.map((item) => <button key={item.name} onClick={onRules}><b>{item.name}</b><span>{item.value}</span></button>)}</div>
      : <p className="soft-note">{isOwner ? `还没有协商参考物。可以在「圈子设置」里加上，例如「一晚住宿 · 约 10 ${circle.currency}」。` : "这个圈还没有设置协商参考物。参考物只是协商辅助，不是统一价格。"}</p>}
    <SectionTitle eyebrow="PEOPLE" title="最近活跃的成员" action="全部成员" onAction={onMembers}/>
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
  return <><section className="profile-hero"><Character member={me}/><div><Pill color="cream">{me.handle}</Pill><h2>{me.name}</h2><p>{me.bio || "还没有写介绍"}</p></div><button onClick={onEditProfile}>编辑资料</button></section><section className="passport-card"><div><span>COMMUNITY PASSPORT</span><h3>{cardCount} 张好人卡，完整故事都在档案里</h3><p>“{activeDb.goodCards.find((card) => card.toMemberId === me.id)?.story ?? "新的感谢故事会出现在这里。"}”</p></div><button onClick={onCard}>＋ 发一张卡</button></section><SectionTitle eyebrow="FULL ARCHIVE" title="我的完整社区档案"/><div className="archive-grid"><button onClick={() => onArchive("cards")}><strong>{cardCount}</strong><span>好人卡故事</span><small>查看谁写下了什么</small></button><button onClick={() => onArchive("listings")}><strong>{myListings.length}</strong><span>需要 / 提供</span><small>包含暂停与过往内容</small></button><button onClick={() => onArchive("transactions")}><strong>{transactionCount}</strong><span>互助记录</span><small>公开、私密与更正状态</small></button></div><SectionTitle eyebrow="OPEN NOW" title="我目前的需要 / 提供" action="公开设置" onAction={onSettings}/><div className="my-board"><button className="my-need" onClick={() => onArchive("listings")}><Pill color="pink">我想要</Pill><h3>{activeNeed?.title ?? "还没有发布中的需要"}</h3><span>{activeNeed ? `${activeNeed.visibility === "cross-circle" ? "跨圈公开" : "圈内可见"} · 查看完整内容` : "可以从“说一句”开始"}</span></button><button className="my-offer" onClick={() => onArchive("listings")}><Pill color="green">我可以给</Pill><h3>{activeOffer?.title ?? "还没有发布中的提供"}</h3><span>{activeOffer ? `${activeOffer.circleIds.length} 个圈可见 · 查看完整内容` : "让大家发现你的能力"}</span></button></div><SectionTitle eyebrow="MY CIRCLES" title="我的圈子" action="创建新圈" onAction={onCreate}/><div className="my-circles">{circles.filter((circle) => me.circleIds.includes(circle.id)).map((circle) => { const account = accountFor(me.id, circle.id); return <button className="my-circle" key={circle.id} onClick={() => onCircle(circle.id)}><Character text={circle.short} color={circle.color} variant={variantFor(circle.id)} small/><span><b>{circle.name}</b><small>{circle.currency} · {circle.members} 人</small></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div><div className="me-actions"><button className="secondary-button" onClick={onShare}>生成分享图</button><button className="text-link" onClick={onLogout}>退出登录</button></div></>;
}

function FeedList({ posts: list, onProfile, onShare, onPost }: { posts: Post[]; onProfile: (id?: string) => void; onShare: () => void; onPost: (id: number) => void }) {
  return <div className="feed-list">{list.map((post) => <article key={post.id} className={`feed-card feed-${post.kind}`}><header><button className="feed-person" onClick={() => post.memberId ? onProfile(post.memberId) : onPost(post.id)}><Character text={post.avatar} color={post.color} variant={post.avatarVariant} small/><span><b>{post.person}</b><small>{post.caption}</small></span></button><Pill color={post.color}>{post.badge}</Pill></header><button className="feed-open" onClick={() => onPost(post.id)}><span className="feed-text">{post.text}</span><span className="chip-row">{post.chips.map((chip) => <i key={chip}>#{chip}</i>)}</span></button><footer><span>{post.meta}</span><span><button onClick={() => onPost(post.id)}>详情</button><button onClick={onShare}>分享 ↗</button></span></footer></article>)}</div>;
}

function Modal({ children, onClose, label, wide = false }: { children: React.ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className={`sheet ${wide ? "sheet-wide" : ""}`} role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()}><button className="close-button" onClick={onClose} aria-label="关闭">×</button>{children}</section></div>;
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

  const circle = circleById(circleId) ?? EMPTY_CIRCLE;
  const myCircles = circles.filter((item) => memberById(activeDb.currentMemberId)?.circleIds.includes(item.id));
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
        const amt = Math.trunc(Number(amount));
        if (!Number.isFinite(amt) || amt <= 0) { onNotice("请填写大于 0 的额度"); return; }
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
    <div className="sheet-heading"><Pill color={accent}>{review ? "草稿 · 可修改" : "记录一件已经发生的事"}</Pill><h2>{review ? "确认前，先看一遍。" : "你想让什么流动起来？"}</h2><p>{review ? "发布后另一方会收到通知，也可以提出修改或拒绝。" : "先选一种，再把字段填好。"}</p></div>

    {!review ? <>
      <div className="intent-grid">{intents.map((item) => <button key={item.id} className={`intent intent-${item.color} ${intent === item.id ? "selected" : ""}`} onClick={() => setIntent(item.id)}><b>{item.icon}</b><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}</div>

      {(isLedger || isCard) && (circle.id === "" ? <p className="soft-note">先选择一个圈子，再记录互助。</p> : others.length === 0
        ? <p className="soft-note">「{circle.name}」还没有其他成员。先到圈子页「邀请成员」，对方加入后就可以互相记录了。</p>
        : <div className="manual-form">
            <label><span>{isLedger ? "和谁的互助" : "把好人卡送给谁"}</span><select value={otherId} onChange={(e) => setOtherId(e.target.value)}><option value="">选择一位成员</option>{others.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>

            {isLedger && <>
              <div className="manual-choice"><button className={direction === "received" ? "active" : ""} onClick={() => setDirection("received")}>对方帮了我</button><button className={direction === "given" ? "active" : ""} onClick={() => setDirection("given")}>我帮了对方</button></div>
              <label><span>额度（{circle.currency}）</span><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例如 5"/></label>
              <label><span>一句话标题</span><input value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} placeholder="例如：厦门借住一晚"/></label>
              <label><span>发生了什么（可选）</span><textarea value={story} rows={2} onChange={(e) => setStory(e.target.value)} placeholder="聊到半夜，第二天一起吃了早饭"/></label>
              <label><span>让谁看见</span><select value={recordVisibility} onChange={(e) => setRecordVisibility(e.target.value as typeof recordVisibility)}><option value="public">圈内公开</option><option value="mystery">神秘记录（隐藏双方与故事）</option><option value="private">仅当事人</option></select></label>
              {!circle.settings.allowNegativeBalance && <p className="soft-note">这个圈子没有开启「允许负余额」，接收方的额度不能记成负数。</p>}
            </>}

            {isCard && <>
              <label><span>发生了什么</span><textarea value={story} rows={3} onChange={(e) => setStory(e.target.value)} placeholder="下雨那天他发现公共厨房漏水，默默修好了。"/></label>
              <label><span>让谁看见</span><select value={cardVisibility} onChange={(e) => setCardVisibility(e.target.value as typeof cardVisibility)}><option value="cross-circle">跨圈公开，跟着 TA 走</option><option value="hidden">只给对方看</option></select></label>
              <p className="soft-note">好人卡不产生余额，也不需要偿还。</p>
            </>}

            <button className="primary-button" onClick={buildDraft}>生成草稿 <b>→</b></button>
          </div>)}

      {isListing && (myCircles.length === 0 ? <p className="soft-note">先加入或创建一个圈子，才能发布需要 / 提供。</p> : <div className="manual-form">
        <label><span>标题</span><input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={intent === "need" ? "例如：泉州的一晚住宿" : "例如：一起修小家电"}/></label>
        <label><span>完整说明</span><textarea value={detail} rows={3} onChange={(e) => setDetail(e.target.value)} placeholder={intent === "need" ? "下周在泉州停留一晚，想找一个可以睡觉、也可以一起聊天的地方。" : "这周可以帮忙修小家电，也可以一起研究怎么修。"}/></label>
        <label><span>时间（可选）</span><input value={time} onChange={(e) => setTime(e.target.value)} placeholder="7 月 23 日 / 本周三至周日"/></label>
        <label><span>地点（可选）</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="泉州 / 线上"/></label>
        <label><span>参考额度（可选）</span><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={`约 10 ${circle.currency}，也可以协商`}/></label>
        <span className="form-label">在哪些圈子里出现</span>
        <div className="circle-picker">{myCircles.map((item) => <button key={item.id} className={listingCircleIds.includes(item.id) ? "active" : ""} onClick={() => toggleListingCircle(item.id)}><span className={`circle-dot dot-${item.color}`}/>{item.name}</button>)}</div>
        <label className="inline-check"><input type="checkbox" checked={crossCircle} onChange={(e) => setCrossCircle(e.target.checked)}/><span><b>跨圈公开</b><small>让不同圈子的人也能看到这条内容</small></span></label>
        <button className="primary-button" onClick={buildDraft}>生成草稿 <b>→</b></button>
      </div>)}
    </> : <>
      <div className={`draft-card draft-${accent}`}><Pill color="cream">草稿 · 可修改</Pill><h3>{review.title}</h3><p>{review.detail}</p><div>{review.footer}</div></div>
      <p className="soft-note">发布不等于强制履约。任何人都可以拒绝、修改或撤回。</p>
      <div className="sheet-actions"><button className="secondary-button" onClick={() => setReview(null)}>返回修改</button><button className="primary-button" disabled={saving} onClick={publish}>{saving ? "正在保存…" : "确认发布"} <b>→</b></button></div>
    </>}
  </Modal>;
}

function ShareSheet({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const cells = Array.from({length:81},(_,index)=>(index*7+Math.floor(index/9)*3)%5<2);
  const myListings = activeDb.listings.filter((listing) => listing.memberId === activeDb.currentMemberId && listing.status === "active");
  const me=memberById(activeDb.currentMemberId);
  return <Modal onClose={onClose} label="分享预览"><span className="sheet-kicker">微信群分享预览</span><div className="share-poster"><div className="poster-top"><Character member={me}/><div><span>{me.handle}</span><h2>{me.name}的流动清单</h2></div></div><div className="poster-panel poster-need"><b>我目前想要</b>{myListings.filter((item) => item.type === "need").map((item) => <p key={item.id}>{item.title}</p>)}</div><div className="poster-panel poster-offer"><b>我目前可以给</b>{myListings.filter((item) => item.type === "offer").map((item) => <p key={item.id}>{item.title}</p>)}</div><div className="poster-bottom"><div><b>可以问，也可以拒绝。</b><span>来看看我们还能怎样交换</span></div><div className="fake-qr">{cells.map((on,index) => <i key={index} className={on ? "on" : ""}/>)}</div></div></div><button className="primary-button" onClick={onDone}>分享这份流动清单</button></Modal>;
}

function ProfileSheet({ member, activeCircleId, initialTab, onClose, onNotice, onChanged }: { member: Member; activeCircleId: string; initialTab: ProfileTab; onClose: () => void; onNotice: (message: string) => void; onChanged: () => Promise<void> }) {
  const [contact, setContact] = useState(false);
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const isSelf = member.id === activeDb.currentMemberId;
  const accounts = activeDb.accounts.filter((item) => item.memberId === member.id);
  const activeAccount = accounts.find((item) => item.circleId === activeCircleId) ?? accounts[0] ?? accountFor(member.id, activeCircleId);
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

  async function amendTransaction(id: string, body: Record<string, unknown>, done: string) {
    const response = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { onNotice(result.error || "更新失败"); return; }
    await onChanged();
    onNotice(done);
  }

  function rejectTransaction(id: string) {
    if (!window.confirm("确认拒绝或撤销这笔记录？双方额度会恢复。")) return;
    amendTransaction(id, { action: "reject" }, "记录已撤销，双方额度已经恢复");
  }

  function correctTransaction(id: string, current: number) {
    const next = window.prompt("更正后的额度是多少？", String(current));
    if (next === null) return;
    const amount = Math.trunc(Number(next));
    if (!Number.isFinite(amount) || amount <= 0) { onNotice("额度必须是大于 0 的整数"); return; }
    if (amount === current) return;
    amendTransaction(id, { action: "correct", amount }, "额度已更正，双方账户已重算");
  }

  async function confirmTransaction(id: string) {
    const response = await fetch(`/api/records/${id}/confirm`, { method: "POST" });
    const result = await response.json() as { error?: string };
    if (!response.ok) { onNotice(result.error || "确认失败"); return; }
    await onChanged();
    onNotice("已确认，额度已经入账");
  }

  const statusLabel = { active: "进行中", paused: "已暂停", closed: "已结束" } as const;
  const transactionStatus = { pending: "待确认", confirmed: "已确认", corrected: "已更正", rejected: "已撤销" } as const;

  return <Modal onClose={onClose} label={`${member.name}的完整社区档案`} wide>
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
      return <article key={transaction.id}>
        <header><div>
          <Pill color={transaction.visibility === "private" ? "blue" : "yellow"}>{transaction.visibility === "private" ? "仅自己可见" : transaction.visibility === "mystery" ? "神秘记录" : "圈内公开"}</Pill>
          <span className={`status status-${transaction.status}`}>{transactionStatus[transaction.status]}</span>
          {isSelf && transaction.status === "pending" && <button onClick={() => confirmTransaction(transaction.id)}>确认入账</button>}
          {canAmend && <button onClick={() => correctTransaction(transaction.id, transaction.amount)}>更正额度</button>}
          {canAmend && <button onClick={() => rejectTransaction(transaction.id)}>拒绝 / 撤销</button>}
        </div><strong>{transaction.amount} {circle.currency}</strong></header>
        <h3>{transaction.title}</h3><p>{transaction.story}</p>
        <footer><span>{provider?.name} → {receiver?.name}</span><span>{transaction.happenedAt} · {circle.name}</span></footer>
      </article>;
    })}{transactions.length === 0 && <div className="empty-archive">当前没有可以向你公开的交易记录。</div>}</div>}

    <SectionTitle eyebrow="CIRCLE ACCOUNTS" title="各圈额度"/>
    <div className="account-strip">{accounts.map((account) => { const circle = circleById(account.circleId) ?? EMPTY_CIRCLE; return <div key={account.circleId}><span>{circle.name}</span><b>{account.balance > 0 ? "+" : ""}{account.balance} {circle.currency}</b><small>给出 {account.given} · 收到 {account.received}</small></div>; })}</div>

    {contact
      ? <div className="contact-reveal"><span>{member.wechat ? "联系方式" : "账号"}</span><b>{member.wechat || member.handle}</b><button onClick={async () => { await navigator.clipboard.writeText(member.wechat || member.handle); onNotice("已复制"); }}>复制</button></div>
      : <button className="primary-button" onClick={() => setContact(true)}>联系{member.name}{member.wechat ? "，查看联系方式" : ""}</button>}
    {contact && !member.wechat && <p className="soft-note">{isSelf ? "你还没有填写联系方式，可以在「我的 → 编辑资料」补上。" : "TA 还没有填写联系方式，可以先在圈子里留言。"}</p>}
    <p className="soft-note">看到“可以提供”不代表对方必须答应。私密交易与隐藏内容只对本人可见。</p>
  </Modal>;
}

// The circle's public agreement page: what it is, how to get in, what the
// negotiation references are, and which mutual-aid toggles are on.
function RulesSheet({ circle, onClose }: { circle: Circle; onClose: () => void }) {
  const { references, rules, allowNegativeBalance, requireConfirmation, allowRejectCorrect } = circle.settings;
  const toggles = [
    { on: allowNegativeBalance, title: "允许负余额", note: "接受帮助的人可以先记成负数——负余额不是信用污点。" },
    { on: requireConfirmation, title: "记录需对方确认", note: "新记录会先挂起，等另一方确认后才入账。" },
    { on: allowRejectCorrect, title: "允许拒绝 / 更正", note: "任一方都可以撤销或更正一笔记录，额度自动重算。" },
  ];
  return <Modal onClose={onClose} label={`${circle.name}介绍与约定`} wide>
    <header className={`detail-hero hero-${circle.color}`}><div className={`camp-flag flag-${circle.color}`}>{circle.short}</div><h2>{circle.name}</h2><p>{circle.tagline || "这个圈子还没有写介绍。"}</p><small>{circle.currency} · {circle.members} 位成员 · {circle.joining === "approval" ? "加入需审批" : "受邀可直接加入"}</small></header>
    <SectionTitle eyebrow="REFERENCE OBJECTS" title="参考物，不是价格表"/>
    {references.length > 0
      ? <div className="reference-detail-grid">{references.map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}</div>
      : <p className="soft-note">这个圈还没有设置参考物。协商仍然由双方决定。</p>}
    <SectionTitle eyebrow="HOW IT RUNS" title="记账规则"/>
    <div className="toggle-summary">{toggles.map((item) => <div key={item.title} className={item.on ? "on" : ""}><b>{item.on ? "✓" : "—"} {item.title}</b><span>{item.on ? item.note : "未开启"}</span></div>)}</div>
    {rules.length > 0 && <><SectionTitle eyebrow="AGREEMENTS" title="圈子约定"/><section className="rule-list">{rules.map((rule, index) => <div key={rule}><b>{String(index + 1).padStart(2, "0")}</b><p>{rule}</p></div>)}</section></>}
    <div className="boundary-card"><b>始终可以不记录</b><p>健康、住址、照料责任和经济困难等敏感信息，默认不进入公开动态。任何人都可以拒绝具体请求，也可以暂停或退出圈子。</p></div>
  </Modal>;
}

function MembersSheet({ circle, onProfile, onInvite, onClose }: { circle: Circle; onProfile: (id?: string) => void; onInvite: () => void; onClose: () => void }) {
  const circleMembers = circle.memberIds.map((id) => memberById(id));
  return <Modal onClose={onClose} label={`${circle.name}全部成员`} wide><div className="sheet-heading member-heading"><Pill color={circle.color}>{circle.members} 位成员</Pill><h2>{circle.name}的成员地图</h2><p>这里展示的是最近活跃的角色。点击任意成员，可以看到对方愿意公开的需要、提供、好人卡与联系方式。</p></div><div className="member-list">{circleMembers.map((member,index) => { const account = accountFor(member.id, circle.id); const offer = activeDb.listings.find((listing) => listing.memberId === member.id && listing.type === "offer" && listing.status === "active"); return <button key={member.id} onClick={() => onProfile(member.id)}><span className="member-index">0{index+1}</span><Character member={member}/><span><b>{member.name}</b><small>{member.handle}</small><p>{offer?.title ?? member.bio}</p></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div><button className="primary-button" onClick={onInvite}>＋ 邀请一位新成员</button></Modal>;
}

function InviteSheet({ circle, onClose, onNotice }: { circle: Circle; onClose: () => void; onNotice: (message: string) => void }) {
  const [method, setMethod] = useState<"link" | "poster">("link");
  const [inviteUrl,setInviteUrl]=useState(""); const [creating,setCreating]=useState(false);
  async function createInvite(){try{setCreating(true);const response=await fetch("/api/invitations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({circleId:circle.id})});const result=await response.json() as {url?:string;error?:string};if(!response.ok||!result.url)throw new Error(result.error||"邀请创建失败");setInviteUrl(result.url);return result.url;}catch(error){onNotice(error instanceof Error?error.message:"邀请创建失败");return "";}finally{setCreating(false);}}
  async function copyInvite(){const url=inviteUrl||await createInvite();if(!url)return;await navigator.clipboard.writeText(url);onNotice("邀请链接已复制");}
  async function shareInvite(){const url=inviteUrl||await createInvite();if(!url)return;const canShare=typeof navigator.share==="function";if(canShare)await navigator.share({title:`加入${circle.name}`,text:circle.tagline,url});else await navigator.clipboard.writeText(url);onNotice(canShare?"邀请已经交给系统分享":"邀请链接已复制，可以粘贴到微信");}
  return <Modal onClose={onClose} label={`邀请加入${circle.name}`}><div className="sheet-heading"><Pill color={circle.color}>{circle.joining === "approval" ? "加入需审批" : "受邀可直接加入"}</Pill><h2>邀请一个认识的人，加入 {circle.name}</h2><p>邀请链接 7 天有效、仅可使用一次。</p></div><div className="invite-tabs"><button className={method === "link" ? "active" : ""} onClick={() => setMethod("link")}>邀请链接</button><button className={method === "poster" ? "active" : ""} onClick={() => setMethod("poster")}>微信邀请图</button></div>{method === "link" ? <div className="invite-link"><span>7 天有效 · 仅可使用 1 次</span><b>{inviteUrl||"点击下方按钮生成安全邀请链接"}</b><button disabled={creating} onClick={copyInvite}>{creating?"正在生成…":inviteUrl?"复制链接":"生成并复制"}</button></div> : <div className={`mini-invite-poster hero-${circle.color}`}><div className={`camp-flag flag-${circle.color}`}>{circle.short}</div><span>来自圈内伙伴的邀请</span><h3>来 {circle.name}<br/>看看我们还能怎样互相帮助</h3><p>可以问，也可以拒绝。</p><div className="mini-code">▦</div></div>}<div className="invite-checklist"><b>受邀者会先看到</b><span>✓ 圈子介绍与运行方式</span><span>✓ 什么会被记录、谁能看见</span><span>✓ 可以拒绝具体请求，也可以退出</span></div><button className="primary-button" disabled={creating} onClick={shareInvite}>{method === "link" ? "分享邀请" : "分享邀请图与链接"}</button></Modal>;
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
  const [short, setShort] = useState("");
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

  if (saved) return <section className="create-success"><div className="success-burst">✓</div><Pill color="green">圈子已创建 · READY</Pill><h2>{name}<br/>准备好了。</h2><p>成员关系、初始账户和圈子规则已经保存。回到圈子后，可以生成一条真实的限时邀请链接。</p><div className="created-passport"><Character text={short || "圈"} color="green" variant="wave"/><div><span>新的圈子</span><h3>{name}</h3><p>{currency} · {joining === "direct" ? "受邀直接加入" : "管理员审批"}</p></div><b>已创建</b></div><div className="create-actions"><button className="primary-button" onClick={onExit}>回到我的圈子</button></div></section>;

  return <section className="create-page">
    <div className="create-intro"><div><Pill color="green">任何人都可以创建</Pill><h2>给一段真实关系，<br/>画出清楚的边界。</h2><p>圈子不是一种新产品，而是一组独立的成员、规则和互助账户。</p></div><button onClick={onExit}>暂时退出</button></div>

    <nav className="create-progress" aria-label="创建圈子步骤">{steps.map((label, index) => <button key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} onClick={() => setStep(index + 1)}><b>{step > index + 1 ? "✓" : `0${index + 1}`}</b><span>{label}</span></button>)}</nav>

    <div className="create-panel">
      {step === 1 && <><div className="create-heading"><span>STEP 01 · IDENTITY</span><h2>这个圈子，连接着谁？</h2><p>先写清楚共同场景，不需要把它包装成一个宏大的社区。</p></div><div className="create-form-grid"><label className="wide"><span>圈子名称</span><input value={name} maxLength={40} placeholder="例如：周末手作营地" onChange={(event) => setName(event.target.value)}/></label><label><span>地图上的简称</span><input maxLength={2} value={short} placeholder="作" onChange={(event) => setShort(event.target.value)}/></label><label><span>互助额度名称</span><input value={currency} maxLength={20} placeholder="例如：泡泡" onChange={(event) => setCurrency(event.target.value)}/></label><label className="wide"><span>一句话介绍</span><textarea value={tagline} maxLength={120} placeholder="一起做东西，也一起把工具、经验和时间分享出来。" onChange={(event) => setTagline(event.target.value)}/></label></div></>}

      {step === 2 && <><div className="create-heading"><span>STEP 02 · MUTUAL CREDIT</span><h2>互助怎么被记住？</h2><p>额度只记录已经完成的帮助；需要、提供和好人卡是不同的记录。</p></div><div className="mechanism-card"><div className="mechanism-icon">＋<br/>−</div><div><Pill color="yellow">互助账户 · 默认机制</Pill><h3>成员之间共同记账</h3><p>提供帮助的人增加额度，接受帮助的人减少额度。正负都不是排名，也不与人民币兑换。</p></div><b>已选择</b></div><div className="reference-editor"><div><span>第一项协商参考</span><input value={referenceName} placeholder="一小时协作" onChange={(event) => setReferenceName(event.target.value)}/></div><div><span>大约多少额度</span><input value={referenceValue} placeholder={`约 5 ${unit}`} onChange={(event) => setReferenceValue(event.target.value)}/></div><small>只是第一次协商的参照，不是统一价格。创建后可以在「圈子设置」里继续增加、修改或删除。</small></div><span className="form-label">记账规则</span><div className="toggle-list"><label><span><b>允许负余额</b><small>接受帮助的人可以先记成负数。关掉的话，成员必须先贡献才能支取——新圈的第一笔记录会失败。</small></span><input type="checkbox" checked={allowNegative} onChange={(event) => setAllowNegative(event.target.checked)}/></label><label><span><b>记录需要对方确认</b><small>新记录先挂起，等另一方确认后才入账。默认关闭：先记录、后纠正。</small></span><input type="checkbox" checked={requireConfirmation} onChange={(event) => setRequireConfirmation(event.target.checked)}/></label><label><span><b>允许拒绝 / 更正</b><small>任一方都可以撤销或更正一笔记录，额度自动重算。</small></span><input type="checkbox" checked={allowRejectCorrect} onChange={(event) => setAllowRejectCorrect(event.target.checked)}/></label></div></>}

      {step === 3 && <><div className="create-heading"><span>STEP 03 · GOVERNANCE</span><h2>谁能加入，约定是什么？</h2><p>先把拒绝、隐私和退出写进规则，再开始邀请成员。</p></div><span className="form-label">新成员怎么加入</span><div className="create-choice-row two"><button className={joining === "direct" ? "active" : ""} onClick={() => setJoining("direct")}><b>种子期 · 受邀直接加入</b><small>适合彼此认识的小范围启动</small></button><button className={joining === "approval" ? "active" : ""} onClick={() => setJoining("approval")}><b>扩大期 · 管理员审批</b><small>适合关系正在向外扩展的圈子</small></button></div><label className="typing-box"><span>圈子约定（一行一条，最多 10 条）</span><textarea rows={5} value={rules} onChange={(event) => setRules(event.target.value)} placeholder={"可以开口，也可以拒绝\n负余额不是信用污点\n敏感互助可以不记录\n成员可以随时暂停或退出"}/></label><div className="boundary-card"><b>有两条不能关闭</b><p>不与人民币兑换，也不做贡献排名。它们是创建圈子的必要边界。</p></div></>}

      {step === 4 && <><div className="create-heading"><span>STEP 04 · REVIEW</span><h2>邀请别人之前，先完整看一遍。</h2><p>这张预览只展示建圈所需的最小规则；创建后仍可以在「圈子设置」里继续修改。</p></div><article className="circle-draft-preview"><header><div className="draft-flag"><span>{short || "圈"}</span></div><div><Pill color="cream">新圈预览</Pill><h2>{name || "未命名圈子"}</h2><p>{tagline || "还没有写一句话介绍"}</p></div></header><div className="draft-summary"><div><span>互助额度</span><b>{currency || "未命名"}</b><small>互助账户 · 不兑换人民币</small></div><div><span>加入方式</span><b>{joining === "direct" ? "受邀直接加入" : "管理员审批"}</b><small>{allowNegative ? "允许负余额" : "必须先贡献才能支取"}</small></div><div><span>第一项参考</span><b>{referenceName || "暂未设置"}</b><small>{referenceValue}</small></div></div><ul><li>只记录已经完成的互助</li>{requireConfirmation ? <li>记录需要另一方确认后才入账</li> : <li>任一方记录即入账，另一方可事后纠正</li>}{allowRejectCorrect && <li>允许拒绝或更正记录，额度自动重算</li>}{ruleList.map((rule) => <li key={rule}>{rule}</li>)}</ul><footer><span>可以开口，也可以拒绝。</span><b>NO PRESSURE · NO RANKING</b></footer></article>{error && <div className="review-warning"><b>还没有创建成功</b><p>{error}</p></div>}</>}

      <div className="create-footer"><button className="secondary-button" onClick={() => step === 1 ? onExit() : setStep(step - 1)}>{step === 1 ? "取消" : "← 上一步"}</button>{step < 4 ? <button className="primary-button" onClick={() => setStep(step + 1)}>继续：{steps[step]} →</button> : <button className="primary-button" disabled={saving} onClick={async () => { try { setSaving(true); setError(""); await onDone({ name: name.trim(), short, currency: currency.trim(), tagline, joining, allowNegative, requireConfirmation, allowRejectCorrect, references: referenceName.trim() ? [{ name: referenceName.trim(), value: referenceValue.trim(), note: "" }] : [], rules: ruleList }); setSaved(true); } catch(error) { setError(error instanceof Error ? error.message : "创建失败"); } finally { setSaving(false); } }}>{saving ? "正在创建…" : "创建圈子"}</button>}</div>
    </div>
  </section>;
}

function FeedFilterSheet({ active, onSelect, onClose }: { active: FeedFilter; onSelect: (filter: FeedFilter) => void; onClose: () => void }) {
  const options: {id: FeedFilter; title: string; note: string; color: Color}[] = [
    {id:"all",title:"全部动态",note:"需要、提供、互助和好人卡混合出现",color:"yellow"},
    {id:"trade",title:"互助记录",note:"公开交易与神秘记录",color:"blue"},
    {id:"need",title:"我想要",note:"看看谁正在开口求助",color:"pink"},
    {id:"offer",title:"我可以给",note:"发现成员愿意提供什么",color:"green"},
    {id:"card",title:"好人卡",note:"看见不产生余额的感谢故事",color:"coral"},
  ];
  return <Modal onClose={onClose} label="筛选圈子动态"><div className="sheet-heading"><Pill color="yellow">FILTER</Pill><h2>这次想先看什么？</h2><p>筛选只改变眼前的信息流，不会改变记录的可见范围。</p></div><div className="filter-menu">{options.map((item) => <button key={item.id} className={`${active === item.id ? "active" : ""} filter-${item.color}`} onClick={() => onSelect(item.id)}><span/><div><b>{item.title}</b><small>{item.note}</small></div><strong>{active === item.id ? "✓" : "→"}</strong></button>)}</div></Modal>;
}

function PostSheet({ post, onProfile, onShare, onClose }: { post: Post; onProfile: () => void; onShare: () => void; onClose: () => void }) {
  const circle = circles.find((item) => item.id === post.circleId) ?? circles[0];
  const details: { label: string; value: string }[] = [{ label: "所属圈子", value: circle.name }];
  if (post.source === "listing") {
    const listing = activeDb.listings.find((item) => item.id === post.sourceId)!;
    details.push({ label: "时间 / 地点", value: `${listing.time} · ${listing.location}` }, { label: "参考", value: listing.reference }, { label: "可见范围", value: listing.visibility === "cross-circle" ? "跨圈公开" : "相关圈子" });
  } else if (post.source === "transaction") {
    const transaction = activeDb.transactions.find((item) => item.id === post.sourceId)!;
    const status = transaction.status === "confirmed" ? "已确认" : transaction.status === "corrected" ? "已更正" : "已撤销";
    details.push({ label: "发生 / 记录", value: `${transaction.happenedAt} · ${transaction.recordedAt} 记录` }, { label: "额度与状态", value: `${transaction.amount} ${circle.currency} · ${status}` }, { label: "可见范围", value: transaction.visibility === "mystery" ? "圈内神秘记录" : transaction.visibility === "private" ? "仅当事人" : "圈内公开" });
  } else {
    const card = activeDb.goodCards.find((item) => item.id === post.sourceId)!;
    details.push({ label: "写下日期", value: card.date }, { label: "可见范围", value: card.visibility === "cross-circle" ? "跨圈公开" : "接收者已隐藏" }, { label: "余额影响", value: "不产生余额，也不需要偿还" });
  }
  return <Modal onClose={onClose} label="动态详情"><div className={`post-detail detail-${post.color}`}><div className="post-detail-head"><Character text={post.avatar} color={post.color} variant={post.avatarVariant}/><div><Pill color="cream">{post.badge}</Pill><h2>{post.person}</h2><p>{post.caption}</p></div></div><p className="post-detail-copy">{post.text}</p><div className="chip-row">{post.chips.map((chip) => <span key={chip}>#{chip}</span>)}</div></div><div className="detail-meta">{details.map((detail) => <div key={detail.label}><span>{detail.label}</span><b>{detail.value}</b></div>)}<div><span>下一步</span><b>{post.kind === "need" || post.kind === "offer" ? "进入主页后微信联系" : "可以查看成员完整档案"}</b></div></div><div className="sheet-actions">{post.memberId ? <button className="secondary-button" onClick={onProfile}>查看成员主页</button> : <button className="secondary-button" onClick={onClose}>知道了</button>}<button className="primary-button" onClick={onShare}>生成分享图</button></div></Modal>;
}

function SettingsSheet({ settings, onClose, onSaved }: { settings: AppDatabase["settings"]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [cards, setCards] = useState(settings.publicCards); const [needs, setNeeds] = useState(settings.publicListings); const [hidden, setHidden] = useState(settings.keepHiddenPrivate); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  async function save(){try{setSaving(true);setError("");const response=await fetch("/api/settings",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({publicCards:cards,publicListings:needs,keepHiddenPrivate:hidden})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"保存失败");await onSaved();onClose();}catch(error){setError(error instanceof Error?error.message:"保存失败");}finally{setSaving(false);}}
  return <Modal onClose={onClose} label="跨圈公开设置"><div className="sheet-heading"><Pill color="blue">我的公开边界</Pill><h2>哪些内容跟着我跨圈出现</h2><p>圈内余额和交易不会自动跨圈。你也可以随时隐藏某一张好人卡或一条帖子。</p></div><div className="toggle-list"><label><span><b>未隐藏的好人卡</b><small>让具体的感谢故事跟着我</small></span><input type="checkbox" checked={cards} onChange={(event) => setCards(event.target.checked)}/></label><label><span><b>标记为跨圈的需要 / 提供</b><small>只有我主动选择的内容会出现</small></span><input type="checkbox" checked={needs} onChange={(event) => setNeeds(event.target.checked)}/></label><label><span><b>隐藏内容也仅自己可见</b><small>保留隐藏内容的私人存档</small></span><input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)}/></label></div>{error&&<p className="soft-note">{error}</p>}<button className="primary-button" disabled={saving} onClick={save}>{saving?"正在保存…":"保存设置"}</button></Modal>;
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

  function editReference(index: number, field: "name" | "value" | "note", value: string) {
    setReferences((current) => current.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  async function save() {
    try {
      setSaving(true);
      const response = await fetch(`/api/circles/${circle.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({
        currency, tagline, joining,
        allowNegativeBalance: negative, requireConfirmation: confirmation, allowRejectCorrect: amend,
        references: references.filter((item) => item.name.trim()),
        rules: rules.split("\n").map((line) => line.trim()).filter(Boolean),
      }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      await onSaved();
      onClose();
    } catch (error) { onNotice(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  }

  return <Modal onClose={onClose} label={`${circle.name}设置`} wide>
    <div className="sheet-heading"><Pill color={circle.color}>圈主设置</Pill><h2>{circle.name}怎么一起运行</h2><p>这些规则对全圈生效。改动会立刻影响之后的记录，不会改写已有账目。</p></div>
    <div className="manual-form">
      <label><span>互助额度名称</span><input value={currency} maxLength={20} onChange={(e) => setCurrency(e.target.value)}/></label>
      <label><span>一句话介绍</span><textarea value={tagline} rows={2} maxLength={120} onChange={(e) => setTagline(e.target.value)}/></label>
      <span className="form-label">新成员怎么加入</span>
      <div className="manual-choice"><button className={joining === "direct" ? "active" : ""} onClick={() => setJoining("direct")}>受邀直接加入</button><button className={joining === "approval" ? "active" : ""} onClick={() => setJoining("approval")}>需要圈主审批</button></div>
    </div>
    <span className="form-label">记账规则</span>
    <div className="toggle-list">
      <label><span><b>允许负余额</b><small>接受帮助的人可以先记成负数。关掉的话，第一笔记录会因为对方额度不足而失败。</small></span><input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)}/></label>
      <label><span><b>记录需要对方确认</b><small>新记录先挂起，等另一方确认后才入账。</small></span><input type="checkbox" checked={confirmation} onChange={(e) => setConfirmation(e.target.checked)}/></label>
      <label><span><b>允许拒绝 / 更正</b><small>任一方都可以撤销或更正一笔记录，额度自动重算。</small></span><input type="checkbox" checked={amend} onChange={(e) => setAmend(e.target.checked)}/></label>
    </div>
    <span className="form-label">协商参考物（最多 8 条）</span>
    <div className="reference-editor-list">{references.map((item, index) => <div key={index}>
      <input value={item.name} placeholder="一晚住宿" onChange={(e) => editReference(index, "name", e.target.value)}/>
      <input value={item.value} placeholder={`约 10 ${currency}`} onChange={(e) => editReference(index, "value", e.target.value)}/>
      <input value={item.note} placeholder="说明（可选）" onChange={(e) => editReference(index, "note", e.target.value)}/>
    </div>)}</div>
    {references.length < 8 && <button className="text-link" onClick={() => setReferences([...references, { name: "", value: "", note: "" }])}>＋ 再加一条参考物</button>}
    <label className="typing-box"><span>圈子约定（一行一条，最多 10 条）</span><textarea rows={4} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={"可以开口，也可以拒绝\n负余额不是信用污点\n敏感互助可以不记录"}/></label>
    <div className="sheet-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving} onClick={save}>{saving ? "正在保存…" : "保存设置"}</button></div>
  </Modal>;
}

// The editable part of a loop account: display name, bio and contact handle.
function EditProfileSheet({ member, onClose, onSaved, onNotice }: { member: Member; onClose: () => void; onSaved: () => Promise<void>; onNotice: (message: string) => void }) {
  const [name, setName] = useState(member.name);
  const [bio, setBio] = useState(member.bio);
  const [wechat, setWechat] = useState(member.wechat);
  const [saving, setSaving] = useState(false);

  async function save() {
    try {
      setSaving(true);
      const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, bio, wechat }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      await onSaved();
      onClose();
    } catch (error) { onNotice(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  }

  return <Modal onClose={onClose} label="编辑资料">
    <div className="sheet-heading"><Pill color="cream">{member.handle}</Pill><h2>我的跨圈身份</h2><p>用户名和地址由系统生成，不能修改。联系方式只对同圈成员显示。</p></div>
    <div className="manual-form">
      <label><span>显示名称</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)}/></label>
      <label><span>一句话介绍</span><input value={bio} maxLength={80} onChange={(e) => setBio(e.target.value)} placeholder="例如：喜欢把坏掉的东西拆开"/></label>
      <label><span>联系方式 / 微信号</span><input value={wechat} maxLength={60} onChange={(e) => setWechat(e.target.value)} placeholder="只对同圈成员显示"/></label>
    </div>
    <div className="detail-meta"><div><span>用户名</span><b>{member.handle}</b></div><div><span>地址</span><b>{member.address ? `${member.address.slice(0, 10)}…` : "—"}</b></div></div>
    <div className="sheet-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving} onClick={save}>{saving ? "正在保存…" : "保存"}</button></div>
  </Modal>;
}
