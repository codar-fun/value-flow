"use client";

import { useMemo, useState } from "react";
import { demoDb, type AvatarVariant, type Circle, type Color, type Member } from "./demo-data";

type View = "feed" | "discover" | "circle" | "me" | "about" | "create";
type ComposerType = "record" | "need" | "offer" | "card";
type FeedFilter = "all" | "trade" | "need" | "offer" | "card";
type DiscoverFilter = "all" | "need" | "offer" | "nearby";
type ProfileTab = "cards" | "listings" | "transactions";
type Overlay = "share" | "profile" | "intro" | "rules" | "members" | "invite" | "feedFilter" | "post" | "settings" | null;

type Post = {
  id: number;
  kind: "offer" | "need" | "trade" | "mystery" | "card";
  badge: string;
  person: string;
  role: string;
  memberId?: string;
  avatar: string;
  avatarVariant: AvatarVariant;
  color: Color;
  text: string;
  meta: string;
  chips: string[];
  circleId: string;
  nearby?: boolean;
  source: "listing" | "card" | "transaction";
  sourceId: string;
};

const { members, circles } = demoDb;

function memberById(id?: string) {
  return members.find((member) => member.id === id) ?? members[0];
}

function circleById(id?: string) {
  return circles.find((circle) => circle.id === id) ?? circles[0];
}

function accountFor(memberId: string, circleId: string) {
  return demoDb.accounts.find((account) => account.memberId === memberId && account.circleId === circleId) ?? { memberId, circleId, balance: 0, given: 0, received: 0 };
}

function buildPosts(): Post[] {
  return demoDb.activity.map((activity) => {
    if (activity.source === "listing") {
      const listing = demoDb.listings.find((item) => item.id === activity.sourceId)!;
      const member = memberById(listing.memberId);
      const circle = circleById(listing.circleIds[0]);
      return { id: activity.id, kind: listing.type, badge: listing.type === "need" ? "我想要" : "我可以给", person: member.name, role: member.role, memberId: member.id, avatar: member.initial, avatarVariant: member.avatar, color: listing.type === "need" ? "pink" : "green", text: listing.detail, meta: `${circle.name} · ${listing.location}`, chips: listing.tags, circleId: circle.id, nearby: listing.nearby, source: activity.source, sourceId: listing.id };
    }
    if (activity.source === "card") {
      const card = demoDb.goodCards.find((item) => item.id === activity.sourceId)!;
      const from = memberById(card.fromMemberId); const to = memberById(card.toMemberId);
      return { id: activity.id, kind: "card", badge: "好人卡", person: `${from.name} → ${to.name}`, role: "跨圈公开", memberId: to.id, avatar: to.initial, avatarVariant: to.avatar, color: "coral", text: card.story, meta: `${card.date} · 被好好看见`, chips: card.tags, circleId: card.circleId, source: activity.source, sourceId: card.id };
    }
    const transaction = demoDb.transactions.find((item) => item.id === activity.sourceId)!;
    const provider = memberById(transaction.providerId); const receiver = memberById(transaction.receiverId); const circle = circleById(transaction.circleId);
    const mystery = transaction.visibility === "mystery";
    return { id: activity.id, kind: mystery ? "mystery" : "trade", badge: mystery ? "神秘记录" : "互助完成", person: mystery ? "圈里发生了一次互助" : `${provider.name} → ${receiver.name}`, role: mystery ? "身份与故事已隐藏" : "圈内公开", memberId: mystery ? undefined : provider.id, avatar: mystery ? "?" : provider.initial, avatarVariant: mystery ? "crop" : provider.avatar, color: mystery ? "blue" : "yellow", text: transaction.story, meta: `${circle.name} · ${transaction.amount} ${circle.currency}`, chips: transaction.tags, circleId: circle.id, nearby: circle.id === "village", source: activity.source, sourceId: transaction.id };
  });
}

const posts = buildPosts();

const intents: { id: ComposerType; label: string; hint: string; color: Color; icon: string }[] = [
  { id: "record", label: "记一笔", hint: "已经完成的互助", color: "yellow", icon: "记" },
  { id: "need", label: "我想要", hint: "向圈子发出请求", color: "pink", icon: "要" },
  { id: "offer", label: "我可以给", hint: "让能力被发现", color: "green", icon: "给" },
  { id: "card", label: "好人卡", hint: "把感谢留下来", color: "blue", icon: "心" },
];

const draftCopy: Record<ComposerType, { spoken: string; title: string; detail: string; footer: string }> = {
  record: { spoken: "记一下，昨天小王让我在厦门住了一晚，算 10 个泡泡。", title: "住宿互助 · 已完成", detail: "小王为俏也提供了一晚住宿", footer: "小王 +10 · 俏也 -10" },
  need: { spoken: "我最近需要一个人帮我看看活动文案，半小时就好。", title: "我想要 · 文案伙伴", detail: "帮忙看一遍活动介绍，给一点真实反应", footer: "做人共学 · 跨圈可见" },
  offer: { spoken: "我可以给大家做肩颈按摩，这周在杭州。", title: "我可以给 · 肩颈按摩", detail: "这周有两个空档，也欢迎用别的东西交换", footer: "俏也交换圈 · 杭州" },
  card: { spoken: "给阿树一张好人卡，他下雨那天把厨房漏水修好了。", title: "给阿树一张好人卡", detail: "下雨那天，他默默修好了公共厨房的漏水", footer: "署名：俏也 · 默认跨圈公开" },
};

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

export default function Home() {
  const [view, setView] = useState<View>("feed");
  const [circleId, setCircleId] = useState("qiao");
  const [feedCircleId, setFeedCircleId] = useState("all");
  const [composer, setComposer] = useState(false);
  const [intent, setIntent] = useState<ComposerType>("record");
  const [draft, setDraft] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("ashu");
  const [profileTab, setProfileTab] = useState<ProfileTab>("cards");
  const [selectedPostId, setSelectedPostId] = useState(1);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>("all");
  const [toast, setToast] = useState("");

  const activeCircle = circles.find((item) => item.id === circleId) ?? circles[0];
  const activeAccount = accountFor("qiaoye", activeCircle.id);
  const selectedMember = memberById(selectedMemberId);
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? posts[0];
  const currentDraft = draftCopy[intent];
  const feedPosts = useMemo(() => posts.filter((post) => {
    if (feedCircleId !== "all" && post.circleId !== feedCircleId) return false;
    if (feedFilter === "all") return true;
    if (feedFilter === "trade") return post.kind === "trade" || post.kind === "mystery";
    return post.kind === feedFilter;
  }), [feedFilter, feedCircleId]);
  const discoverPosts = useMemo(() => posts.filter((post) => {
    if (post.kind !== "need" && post.kind !== "offer") return false;
    if (discoverFilter === "all") return true;
    if (discoverFilter === "nearby") return Boolean(post.nearby);
    return post.kind === discoverFilter;
  }), [discoverFilter]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function openComposer(nextIntent: ComposerType = "record") {
    setIntent(nextIntent); setDraft(false); setComposer(true);
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
    setSelectedMemberId(id ?? "ashu"); setProfileTab(tab); setOverlay("profile");
  }

  function openPost(id: number) {
    setSelectedPostId(id); setOverlay("post");
  }

  function confirmDraft() {
    setComposer(false); setDraft(false);
    flash(intent === "record" ? "记录已进入圈子，对方可以修改或拒绝" : intent === "card" ? "好人卡已送到对方的跨圈主页" : "已经发布，可以生成分享图啦");
  }

  return <main className="world-shell">
    <aside className="circle-dock" aria-label="我的圈子地图">
      <button className={`brand-mark ${view === "about" ? "active" : ""}`} onClick={() => setView("about")} aria-label="了解流动圈"><span>流动圈</span><b>FLOW CIRCLE · 了解我们 →</b></button>
      <div className="dock-heading"><span>我的地图</span><b>{String(circles.length).padStart(2,"0")}</b></div>
      <button className={`dock-all ${feedCircleId === "all" && view === "feed" ? "active" : ""}`} onClick={showAllCircles}><span>◎</span><b>全部圈子动态</b><strong>{posts.length}</strong></button>
      <div className="dock-list">{circles.map((item) => { const account = accountFor("qiaoye", item.id); return <button key={item.id} className={`dock-circle dock-${item.color} ${feedCircleId === item.id ? "active" : ""}`} onClick={() => selectCircle(item.id)}><Character text={item.short} color={item.color} variant={item.id === "qiao" ? "wave" : item.id === "human" ? "crop" : "leaf"} small/><span><b>{item.name}</b><small>{item.role}</small></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div>
      <button className="new-circle" onClick={openCreateCircle}><b>＋</b><span>创建新圈子</span></button>
      <p className="dock-note">三个圈子只是俏也加入的三个社区。每个圈子都有自己的成员、规则和互助额度。</p>
    </aside>

    <section className="phone-stage">
      <div className={`app-frame ${view === "about" || view === "create" ? "about-open" : ""}`}>
        <header className="topbar"><button className={`brand-mini ${view === "about" ? "active" : ""}`} onClick={() => setView("about")} aria-label="了解流动圈"><span>流</span><i/></button><div><p>{view === "about" ? "FLOW CIRCLE · 产品概念" : view === "create" ? "NEW CIRCLE · 创建向导" : "我的圈子动态"}</p><h1>{view === "about" ? "关于流动圈" : view === "create" ? "创建新圈子" : "早上好，俏也！"}</h1></div><button className="avatar-button" onClick={() => setView("me")} aria-label="打开我的主页"><Character member={memberById("qiaoye")}/></button></header>
        {view !== "about" && view !== "create" && <nav className="circle-switcher" aria-label="切换动态范围"><button className={`all-switch ${feedCircleId === "all" && view === "feed" ? "selected" : ""}`} onClick={showAllCircles}><span className="circle-dot dot-all"/><span>全部圈子</span><b>{posts.length}</b></button>{circles.map((item) => { const account = accountFor("qiaoye", item.id); return <button key={item.id} className={feedCircleId === item.id ? "selected" : ""} onClick={() => selectCircle(item.id)}><span className={`circle-dot dot-${item.color}`}/><span>{item.name}</span><b>{account.balance > 0 ? "+" : ""}{account.balance}</b></button>; })}</nav>}
        <div className="view-content">
          {view === "about" && <AboutView onExplore={showAllCircles} onCreate={openCreateCircle} onCircle={(id) => selectCircle(id, "circle")}/>}
          {view === "create" && <CreateCircleView onExit={() => setView("me")} onDone={(name) => flash(`${name}的草稿已保存（静态演示）`)}/>}
          {view === "feed" && <FeedView activeCircle={activeCircle} activeAccount={activeAccount} isAllCircles={feedCircleId === "all"} posts={feedPosts} filter={feedFilter} onSpeak={openComposer} onCircle={() => setView("circle")} onMe={() => setView("me")} onProfile={openProfile} onShare={() => setOverlay("share")} onFilter={() => setOverlay("feedFilter")} onPost={openPost}/>}
          {view === "discover" && <DiscoverView posts={discoverPosts} filter={discoverFilter} setFilter={setDiscoverFilter} onSpeak={openComposer} onProfile={openProfile} onShare={() => setOverlay("share")} onPost={openPost}/>}
          {view === "circle" && <CircleView circle={activeCircle} account={activeAccount} posts={posts.filter((post) => post.circleId === activeCircle.id)} onSpeak={openComposer} onProfile={openProfile} onShare={() => setOverlay("share")} onPost={openPost} onIntro={() => setOverlay("intro")} onRules={() => setOverlay("rules")} onMembers={() => setOverlay("members")} onInvite={() => setOverlay("invite")}/>}
          {view === "me" && <MeView onShare={() => setOverlay("share")} onCard={() => openComposer("card")} onCreate={openCreateCircle} onSettings={() => setOverlay("settings")} onCircle={(id) => selectCircle(id, "circle")} onArchive={(tab) => openProfile("qiaoye", tab)}/>}
        </div>
        <nav className="bottom-nav" aria-label="主要导航">
          <button className={view === "feed" ? "active" : ""} onClick={() => setView("feed")}><span className="nav-icon">⌂</span><small>动态</small></button>
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><span className="nav-icon">◇</span><small>发现</small></button>
          <button className="compose-slot" onClick={() => openComposer()} aria-label="说一句"><span className="compose-orb">●</span><small>说一句</small></button>
          <button className={view === "circle" ? "active" : ""} onClick={() => setView("circle")}><span className="nav-icon">▦</span><small>圈子</small></button>
          <button className={view === "me" ? "active" : ""} onClick={() => setView("me")}><span className="nav-icon">☺</span><small>我的</small></button>
        </nav>
      </div>
    </section>

    <aside className="world-panel">
      <div className="world-card world-card-main"><span className="world-kicker">TODAY IN YOUR CIRCLES</span><h2>今天，圈里有<br/><em>{posts.length} 件事</em>在流动</h2><div className="world-stats"><span><b>{posts.filter((post) => post.kind === "need" || post.kind === "offer").length}</b>需要 / 提供</span><span><b>{posts.filter((post) => post.kind === "trade" || post.kind === "mystery").length}</b>互助完成</span><span><b>{posts.filter((post) => post.kind === "card").length}</b>张好人卡</span></div></div>
      <button className="world-card value-card value-card-button" onClick={() => { setView("circle"); setOverlay("rules"); }}><span className="world-kicker">这个圈怎么估量</span><h3>{activeCircle.name}</h3>{activeCircle.references.slice(0,2).map((item) => <div key={item.name}><b>{item.name}</b><span>{item.value}</span></div>)}<p>只是协商参考，不是统一价格。点击查看完整规则。</p></button>
      <div className="world-rule"><b>可以问，<br/>也可以拒绝。</b><span>NO PRESSURE · NO RANKING</span></div>
    </aside>

    {composer && <ComposerSheet intent={intent} setIntent={(next) => { setIntent(next); setDraft(false); }} draft={draft} setDraft={setDraft} currentDraft={currentDraft} onClose={() => setComposer(false)} onConfirm={confirmDraft} onNotice={flash}/>}
    {overlay === "share" && <ShareSheet onClose={() => setOverlay(null)} onDone={() => { setOverlay(null); flash("分享图已准备好，可以发到微信群"); }}/>}
    {overlay === "profile" && <ProfileSheet member={selectedMember} activeCircleId={circleId} initialTab={profileTab} onClose={() => setOverlay(null)} onNotice={flash}/>}
    {overlay === "intro" && <CircleIntroSheet circle={activeCircle} onRules={() => setOverlay("rules")} onInvite={() => setOverlay("invite")} onClose={() => setOverlay(null)}/>}
    {overlay === "rules" && <RulesSheet circle={activeCircle} onClose={() => setOverlay(null)}/>}
    {overlay === "members" && <MembersSheet circle={activeCircle} onProfile={openProfile} onInvite={() => setOverlay("invite")} onClose={() => setOverlay(null)}/>}
    {overlay === "invite" && <InviteSheet circle={activeCircle} onClose={() => setOverlay(null)} onNotice={flash}/>}
    {overlay === "feedFilter" && <FeedFilterSheet active={feedFilter} onSelect={(next) => { setFeedFilter(next); setOverlay(null); }} onClose={() => setOverlay(null)}/>}
    {overlay === "post" && <PostSheet post={selectedPost} onProfile={() => selectedPost.memberId && openProfile(selectedPost.memberId)} onShare={() => setOverlay("share")} onClose={() => setOverlay(null)}/>}
    {overlay === "settings" && <SettingsSheet onClose={() => setOverlay(null)} onNotice={flash}/>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
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
    ["发生之后，说一句", "告诉泡泡助手发生了什么，它会整理成一份可检查、可修改的草稿。"],
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
      <p className="about-lead">下面是俏也已经加入的三个示例圈子。它们不是三种产品，而是三段各自独立的社区关系。</p>
      <div className="about-circles">{circles.map((circle, index) => <button key={circle.id} className={`about-circle about-circle-${circle.color}`} onClick={() => onCircle(circle.id)}><span className="about-circle-number">0{index + 1}</span><Character text={circle.short} color={circle.color} variant={circle.id === "qiao" ? "wave" : circle.id === "human" ? "crop" : "leaf"} small/><div><small>{circle.location}</small><h3>{circle.name}</h3><p>{circle.tagline}</p></div><b>进入圈子 →</b></button>)}</div>
    </section>

    <section className="about-boundaries">
      <div><span>KEEP IT HUMAN</span><h2>有些事，流动圈明确不做。</h2></div>
      <ul><li>不与人民币兑换，也不是支付工具</li><li>不做贡献榜、信用分或道德排名</li><li>不要求每次帮助都留下记录</li><li>不把不同圈子的额度互相兑换</li><li>可以开口，也可以拒绝、暂停或离开</li><li>敏感互助可以神秘记录，或者完全不记录</li></ul>
    </section>

    <blockquote className="about-manifesto"><span>“</span><p>数字是影子，关系是实体。<br/>没有记录的善意，仍然成立。</p><b>流动圈 · FLOW CIRCLE</b></blockquote>
  </div>;
}

function AgentHero({ onSpeak }: { onSpeak: (intent?: ComposerType) => void }) {
  return <section className="agent-hero"><div className="hero-decor decor-grid"/><div className="hero-decor decor-square"/><div className="hero-decor decor-circle"/><div className="agent-orb"><i className="agent-antenna"/><span>◕‿◕</span><b>泡泡助手</b></div><div className="agent-copy"><Pill color="cream">在线 · ONLINE</Pill><h2>说一句，<br/>让互助流动起来。</h2><p>我会帮你整理成可检查、可修改的草稿。</p></div><button className="speak-button" onClick={() => onSpeak()}><span>●</span><b>说一句</b><small>交易 · 需要 · 提供 · 好人卡</small></button></section>;
}

function FeedView({ activeCircle, activeAccount, isAllCircles, posts: list, filter, onSpeak, onCircle, onMe, onProfile, onShare, onFilter, onPost }: { activeCircle: Circle; activeAccount: ReturnType<typeof accountFor>; isAllCircles: boolean; posts: Post[]; filter: FeedFilter; onSpeak: (intent?: ComposerType) => void; onCircle: () => void; onMe: () => void; onProfile: (id?: string) => void; onShare: () => void; onFilter: () => void; onPost: (id: number) => void }) {
  const labels: Record<FeedFilter,string> = { all: "全部动态", trade: "互助记录", need: "只看需要", offer: "只看提供", card: "好人卡" };
  const myCards = demoDb.goodCards.filter((card) => card.toMemberId === "qiaoye" && card.visibility === "cross-circle").length;
  const totalGiven = demoDb.accounts.filter((account) => account.memberId === "qiaoye").reduce((sum, account) => sum + account.given, 0);
  const scopeTitle = isAllCircles ? "全部圈子" : activeCircle.name;
  return <><AgentHero onSpeak={onSpeak}/><section className="scope-banner"><span>{isAllCircles ? "综合动态" : "当前圈子"}</span><b>{scopeTitle}</b><small>{list.length} 条符合当前筛选的动态</small></section><section className="stats-grid" aria-label="当前动态范围概览"><button className="stat-card stat-yellow" onClick={isAllCircles ? onMe : onCircle}><span>{isAllCircles ? "已加入圈子" : "当前额度"}</span><strong>{isAllCircles ? circles.length : `${activeAccount.balance > 0 ? "+" : ""}${activeAccount.balance}`}</strong><small>{isAllCircles ? "每个圈有独立账户" : `${activeCircle.currency} · ${activeCircle.name}`}</small></button><button className="stat-card stat-pink" onClick={onMe}><span>我给出过</span><strong>{isAllCircles ? totalGiven : activeAccount.given}</strong><small>{isAllCircles ? "三个圈的社区记忆" : "不是排名，是记忆"}</small></button><button className="stat-card stat-blue" onClick={() => onProfile("qiaoye")}><span>好人卡</span><strong>{myCards}</strong><small>跨圈跟着我</small></button></section><SectionTitle eyebrow="LIVE FROM THE CIRCLE" title={`${scopeTitle} · ${labels[filter]}`} action={`筛选 · ${list.length}`} onAction={onFilter}/><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>;
}

function DiscoverView({ posts: list, filter, setFilter, onSpeak, onProfile, onShare, onPost }: { posts: Post[]; filter: DiscoverFilter; setFilter: (filter: DiscoverFilter) => void; onSpeak: (intent?: ComposerType) => void; onProfile: (id?: string) => void; onShare: () => void; onPost: (id: number) => void }) {
  const options: {id: DiscoverFilter; label: string}[] = [{id:"all",label:"全部"},{id:"need",label:"我想要"},{id:"offer",label:"我可以给"},{id:"nearby",label:"附近"}];
  return <><section className="page-hero discover-hero"><div><Pill color="pink">跨圈发现</Pill><h2>有人在寻找，<br/>也有人正好可以给。</h2><p>看到“可以提供”，不代表对方必须答应。先问问就好。</p></div><button onClick={() => onSpeak("need")}>＋ 发布</button></section><div className="filter-row" aria-label="发现筛选">{options.map((item) => <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div><p className="result-note">找到 {list.length} 条仍然有效的内容</p><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>;
}

function CircleView({ circle, account, posts: circlePosts, onSpeak, onProfile, onShare, onPost, onIntro, onRules, onMembers, onInvite }: { circle: Circle; account: ReturnType<typeof accountFor>; posts: Post[]; onSpeak: (intent?: ComposerType) => void; onProfile: (id?: string) => void; onShare: () => void; onPost: (id: number) => void; onIntro: () => void; onRules: () => void; onMembers: () => void; onInvite: () => void }) {
  return <><section className={`page-hero circle-hero hero-${circle.color}`}><div><Pill color="cream">我的营地 · {circle.location}</Pill><h2>{circle.name}</h2><p>{circle.tagline}</p></div><div className="coin-badge"><span>{account.balance > 0 ? "+" : ""}{account.balance}</span><small>{circle.currency}</small></div></section><div className="circle-actions"><button onClick={() => onSpeak()}>● 说一句</button><button onClick={onInvite}>邀请成员</button><button onClick={onIntro}>圈子介绍</button></div><button className="camp-preview" onClick={onIntro}><span className={`camp-flag flag-${circle.color}`}>{circle.short}</span><div><small>CAMP PROFILE</small><h3>{circle.tagline}</h3><p>{circle.joining} · {circle.members} 位成员</p></div><b>进入介绍 →</b></button><section className="balance-panel"><div><span>当前额度</span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong><small>我在这个圈的流动额度</small></div><div><span>给出过</span><strong>{account.given}</strong><small>来自真实互助</small></div><div><span>收到过</span><strong>{account.received}</strong><small>接受帮助也很好</small></div></section><SectionTitle eyebrow="REFERENCE" title="圈内参考物" action="查看规则" onAction={onRules}/><div className="reference-grid">{circle.references.map((item) => <button key={item.name} onClick={onRules}><b>{item.name}</b><span>{item.value}</span></button>)}</div><SectionTitle eyebrow="PEOPLE" title="最近活跃的成员" action="全部成员" onAction={onMembers}/><div className="member-row">{circle.memberIds.slice(0,4).map((id) => { const member = memberById(id); return <button key={member.id} onClick={() => onProfile(member.id)}><Character member={member} small/><b>{member.name}</b><small>{member.role}</small></button>; })}</div><div className="circle-feed"><SectionTitle eyebrow={`${circlePosts.length} EVENTS IN THIS CIRCLE`} title={`${circle.name}动态`}/><FeedList posts={circlePosts} onProfile={onProfile} onShare={onShare} onPost={onPost}/></div></>;
}

function MeView({ onShare, onCard, onCreate, onSettings, onCircle, onArchive }: { onShare: () => void; onCard: () => void; onCreate: () => void; onSettings: () => void; onCircle: (id: string) => void; onArchive: (tab: ProfileTab) => void }) {
  const me = memberById("qiaoye");
  const myListings = demoDb.listings.filter((item) => item.memberId === me.id);
  const activeNeed = myListings.find((item) => item.type === "need" && item.status === "active")!;
  const activeOffer = myListings.find((item) => item.type === "offer" && item.status === "active")!;
  const cardCount = demoDb.goodCards.filter((card) => card.toMemberId === me.id && card.visibility === "cross-circle").length;
  const transactionCount = demoDb.transactions.filter((item) => item.providerId === me.id || item.receiverId === me.id).length;
  return <><section className="profile-hero"><Character member={me}/><div><Pill color="cream">跨圈角色卡</Pill><h2>{me.name}</h2><p>{me.bio}</p></div><button onClick={onShare}>生成分享图</button></section><section className="passport-card"><div><span>COMMUNITY PASSPORT</span><h3>{cardCount} 张好人卡，完整故事都在档案里</h3><p>“{demoDb.goodCards.find((card) => card.toMemberId === me.id)?.story}”</p></div><button onClick={onCard}>＋ 发一张卡</button></section><SectionTitle eyebrow="FULL ARCHIVE" title="我的完整社区档案"/><div className="archive-grid"><button onClick={() => onArchive("cards")}><strong>{cardCount}</strong><span>好人卡故事</span><small>查看谁写下了什么</small></button><button onClick={() => onArchive("listings")}><strong>{myListings.length}</strong><span>需要 / 提供</span><small>包含暂停与过往内容</small></button><button onClick={() => onArchive("transactions")}><strong>{transactionCount}</strong><span>互助记录</span><small>公开、私密与更正状态</small></button></div><SectionTitle eyebrow="OPEN NOW" title="我目前的需要 / 提供" action="公开设置" onAction={onSettings}/><div className="my-board"><button className="my-need" onClick={() => onArchive("listings")}><Pill color="pink">我想要</Pill><h3>{activeNeed.title}</h3><span>{activeNeed.visibility === "cross-circle" ? "跨圈公开" : "圈内可见"} · 查看完整内容</span></button><button className="my-offer" onClick={() => onArchive("listings")}><Pill color="green">我可以给</Pill><h3>{activeOffer.title}</h3><span>{activeOffer.circleIds.length} 个圈可见 · 查看完整内容</span></button></div><SectionTitle eyebrow="MY CIRCLES" title="我的圈子" action="创建新圈" onAction={onCreate}/><div className="my-circles">{circles.map((circle) => { const account = accountFor(me.id, circle.id); return <button className="my-circle" key={circle.id} onClick={() => onCircle(circle.id)}><Character text={circle.short} color={circle.color} variant={circle.id === "qiao" ? "wave" : circle.id === "human" ? "crop" : "leaf"} small/><span><b>{circle.name}</b><small>{circle.role} · {circle.members} 人</small></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div></>;
}

function FeedList({ posts: list, onProfile, onShare, onPost }: { posts: Post[]; onProfile: (id?: string) => void; onShare: () => void; onPost: (id: number) => void }) {
  return <div className="feed-list">{list.map((post) => <article key={post.id} className={`feed-card feed-${post.kind}`}><header><button className="feed-person" onClick={() => post.memberId ? onProfile(post.memberId) : onPost(post.id)}><Character text={post.avatar} color={post.color} variant={post.avatarVariant} small/><span><b>{post.person}</b><small>{post.role}</small></span></button><Pill color={post.color}>{post.badge}</Pill></header><button className="feed-open" onClick={() => onPost(post.id)}><span className="feed-text">{post.text}</span><span className="chip-row">{post.chips.map((chip) => <i key={chip}>#{chip}</i>)}</span></button><footer><span>{post.meta}</span><span><button onClick={() => onPost(post.id)}>详情</button><button onClick={onShare}>分享 ↗</button></span></footer></article>)}</div>;
}

function Modal({ children, onClose, label, wide = false }: { children: React.ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className={`sheet ${wide ? "sheet-wide" : ""}`} role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()}><button className="close-button" onClick={onClose} aria-label="关闭">×</button>{children}</section></div>;
}

function ComposerSheet({ intent, setIntent, draft, setDraft, currentDraft, onClose, onConfirm, onNotice }: { intent: ComposerType; setIntent: (intent: ComposerType) => void; draft: boolean; setDraft: (draft: boolean) => void; currentDraft: (typeof draftCopy)[ComposerType]; onClose: () => void; onConfirm: () => void; onNotice: (message: string) => void }) {
  const [typing, setTyping] = useState(false);
  return <Modal onClose={onClose} label="说一句"><div className="sheet-agent"><div className="mini-agent">◕‿◕</div><div><span>泡泡助手</span><h2>{draft ? "我整理成这样，对吗？" : "你想让什么流动起来？"}</h2><p>{draft ? "确认前可以修改，发布后也可以撤回。" : "先选一种，再像平常说话一样告诉我。"}</p></div></div>{!draft ? <><div className="intent-grid">{intents.map((item) => <button key={item.id} className={`intent intent-${item.color} ${intent === item.id ? "selected" : ""}`} onClick={() => setIntent(item.id)}><b>{item.icon}</b><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}</div>{typing ? <label className="typing-box"><span>把事情写下来</span><textarea defaultValue={currentDraft.spoken}/></label> : <div className="voice-box"><span className="wave"><i/><i/><i/><i/><i/><i/><i/></span><p>{currentDraft.spoken}</p><button className="record-circle" onClick={() => onNotice("这是语音演示：已听见你的这句话")} aria-label="开始录音">●</button></div>}<button className="primary-button" onClick={() => setDraft(true)}>让泡泡助手整理一下 <b>→</b></button><button className="text-link" onClick={() => setTyping(!typing)}>{typing ? "切换回语音演示" : "也可以切换为键盘输入"}</button></> : <><div className={`draft-card draft-${intents.find((item) => item.id === intent)?.color ?? "yellow"}`}><Pill color="cream">草稿 · 可修改</Pill><h3>{currentDraft.title}</h3><p>{currentDraft.detail}</p><div>{currentDraft.footer}</div></div><label className="visibility-row"><span>让谁看见</span><select defaultValue={intent === "card" ? "public" : "circle"}><option value="circle">相关圈子</option><option value="public">跨圈公开</option><option value="mystery">神秘记录</option></select></label><p className="soft-note">发布不等于强制履约。任何人都可以拒绝、修改或撤回。</p><div className="sheet-actions"><button className="secondary-button" onClick={() => setDraft(false)}>返回修改</button><button className="primary-button" onClick={onConfirm}>确认发布 <b>→</b></button></div></>}</Modal>;
}

function ShareSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const cells = Array.from({length:81},(_,index)=>(index*7+Math.floor(index/9)*3)%5<2);
  const myListings = demoDb.listings.filter((listing) => listing.memberId === "qiaoye" && listing.status === "active");
  return <Modal onClose={onClose} label="分享图预览"><span className="sheet-kicker">微信群分享图预览</span><div className="share-poster"><div className="poster-top"><Character member={memberById("qiaoye")}/><div><span>旅居交换者</span><h2>俏也的流动清单</h2></div></div><div className="poster-panel poster-need"><b>我目前想要</b>{myListings.filter((item) => item.type === "need").map((item) => <p key={item.id}>{item.title}</p>)}</div><div className="poster-panel poster-offer"><b>我目前可以给</b>{myListings.filter((item) => item.type === "offer").map((item) => <p key={item.id}>{item.title}</p>)}</div><div className="poster-bottom"><div><b>可以问，也可以拒绝。</b><span>来看看我们还能怎样交换</span></div><div className="fake-qr">{cells.map((on,index) => <i key={index} className={on ? "on" : ""}/>)}</div></div></div><button className="primary-button" onClick={onDone}>准备好，分享到微信群</button></Modal>;
}

function ProfileSheet({ member, activeCircleId, initialTab, onClose, onNotice }: { member: Member; activeCircleId: string; initialTab: ProfileTab; onClose: () => void; onNotice: (message: string) => void }) {
  const [contact, setContact] = useState(false);
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const isSelf = member.id === "qiaoye";
  const accounts = demoDb.accounts.filter((item) => item.memberId === member.id);
  const activeAccount = accounts.find((item) => item.circleId === activeCircleId) ?? accounts[0] ?? accountFor(member.id, activeCircleId);
  const activeCircle = circleById(activeAccount.circleId);
  const cards = demoDb.goodCards.filter((card) => card.toMemberId === member.id && (card.visibility === "cross-circle" || isSelf));
  const listings = demoDb.listings.filter((listing) => listing.memberId === member.id);
  const transactions = demoDb.transactions.filter((transaction) => (transaction.providerId === member.id || transaction.receiverId === member.id) && (isSelf || transaction.visibility === "public"));
  const statusLabel = { active: "进行中", paused: "已暂停", closed: "已结束" } as const;
  const transactionStatus = { confirmed: "已确认", corrected: "已更正", rejected: "已撤销" } as const;
  return <Modal onClose={onClose} label={`${member.name}的完整社区档案`} wide><div className={`role-card role-${member.color}`}><Character member={member}/><div><Pill color="cream">{isSelf ? "我的完整档案" : `同圈成员 · ${member.circleIds.length} 个圈`}</Pill><h2>{member.name}</h2><p>{member.role} · {member.bio}</p></div></div><div className="profile-numbers"><div><b>{activeAccount.balance > 0 ? "+" : ""}{activeAccount.balance}</b><span>{activeCircle.name} · 当前额度</span></div><div><b>{activeAccount.given}</b><span>在本圈给出过</span></div><div><b>{activeAccount.received}</b><span>在本圈收到过</span></div></div><div className="profile-tabs" role="tablist"><button className={tab === "cards" ? "active" : ""} onClick={() => setTab("cards")}>好人卡 <b>{cards.length}</b></button><button className={tab === "listings" ? "active" : ""} onClick={() => setTab("listings")}>需要 / 提供 <b>{listings.length}</b></button><button className={tab === "transactions" ? "active" : ""} onClick={() => setTab("transactions")}>互助记录 <b>{transactions.length}</b></button></div>{tab === "cards" && <div className="archive-list card-archive">{cards.map((card) => { const from = memberById(card.fromMemberId); const circle = circleById(card.circleId); return <article key={card.id}><header><Character member={from} small/><span><b>{from.name} 写给 {member.name}</b><small>{card.date} · {circle.name}</small></span><Pill color="coral">好人卡</Pill></header><p>“{card.story}”</p><div className="chip-row">{card.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></article>; })}</div>}{tab === "listings" && <div className="archive-list listing-archive">{listings.map((listing) => <article key={listing.id} className={listing.type === "need" ? "archive-need" : "archive-offer"}><header><Pill color={listing.type === "need" ? "pink" : "green"}>{listing.type === "need" ? "我想要" : "我可以给"}</Pill><span className={`status status-${listing.status}`}>{statusLabel[listing.status]}</span></header><h3>{listing.title}</h3><p>{listing.detail}</p><dl><div><dt>时间</dt><dd>{listing.time}</dd></div><div><dt>地点</dt><dd>{listing.location}</dd></div><div><dt>参考</dt><dd>{listing.reference}</dd></div><div><dt>范围</dt><dd>{listing.visibility === "cross-circle" ? "跨圈公开" : listing.circleIds.map((id) => circleById(id).name).join("、")}</dd></div></dl></article>)}</div>}{tab === "transactions" && <div className="archive-list transaction-archive">{transactions.map((transaction) => { const provider = memberById(transaction.providerId); const receiver = memberById(transaction.receiverId); const circle = circleById(transaction.circleId); return <article key={transaction.id}><header><div><Pill color={transaction.visibility === "private" ? "blue" : "yellow"}>{transaction.visibility === "private" ? "仅自己可见" : "圈内公开"}</Pill><span className={`status status-${transaction.status}`}>{transactionStatus[transaction.status]}</span></div><strong>{transaction.amount} {circle.currency}</strong></header><h3>{transaction.title}</h3><p>{transaction.story}</p><footer><span>{provider.name} → {receiver.name}</span><span>{transaction.happenedAt} · {circle.name}</span></footer></article>; })}{transactions.length === 0 && <div className="empty-archive">当前没有可以向你公开的交易记录。</div>}</div>}<SectionTitle eyebrow="CIRCLE ACCOUNTS" title="各圈额度"/><div className="account-strip">{accounts.map((account) => { const circle = circleById(account.circleId); return <div key={account.circleId}><span>{circle.name}</span><b>{account.balance > 0 ? "+" : ""}{account.balance} {circle.currency}</b><small>给出 {account.given} · 收到 {account.received}</small></div>; })}</div>{contact ? <div className="contact-reveal"><span>微信号</span><b>{member.wechat}</b><button onClick={() => onNotice("微信号已复制（静态演示）")}>复制</button></div> : <button className="primary-button" onClick={() => setContact(true)}>联系{member.name}，查看微信号</button>}<p className="soft-note">看到“可以提供”不代表对方必须答应。私密交易与隐藏内容只对本人可见。</p></Modal>;
}

function CircleIntroSheet({ circle, onRules, onInvite, onClose }: { circle: Circle; onRules: () => void; onInvite: () => void; onClose: () => void }) {
  return <Modal onClose={onClose} label={`${circle.name}圈子介绍`} wide><header className={`detail-hero hero-${circle.color}`}><span className="camp-number">CAMP / 0{circles.findIndex((item) => item.id === circle.id) + 1}</span><div className={`camp-flag flag-${circle.color}`}>{circle.short}</div><h2>{circle.name}</h2><p>{circle.tagline}</p><small>{circle.location} · {circle.members} 位成员</small></header><div className="detail-grid"><section><span className="detail-label">为什么有这个圈子</span><p>{circle.intro}</p></section><section><span className="detail-label">适合谁</span><p>{circle.scene}</p></section></div><section className="principle-board"><span className="detail-label">营地约定</span>{circle.principles.map((item,index) => <div key={item}><b>0{index+1}</b><p>{item}</p></div>)}</section><section className="join-card"><div><span>加入方式</span><h3>{circle.joining}</h3><p>{circle.invitation}</p></div><div className="join-actions"><button className="secondary-button" onClick={onRules}>查看完整规则</button><button className="primary-button" onClick={onInvite}>邀请一个人</button></div></section></Modal>;
}

function RulesSheet({ circle, onClose }: { circle: Circle; onClose: () => void }) {
  return <Modal onClose={onClose} label={`${circle.name}规则与参考物`} wide><div className="sheet-heading"><Pill color={circle.color}>规则不是惩罚</Pill><h2>{circle.name}怎么一起运行</h2><p>这些约定帮助大家更容易协商、拒绝、纠错和离开。它们不会把善意变成统一价格。</p></div><section className="rule-list">{circle.rules.map((rule,index) => <div key={rule}><b>{String(index+1).padStart(2,"0")}</b><p>{rule}</p></div>)}</section><SectionTitle eyebrow="REFERENCE OBJECTS" title="参考物，不是价格表"/><div className="reference-detail-grid">{circle.references.map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}</div><div className="boundary-card"><b>始终可以不记录</b><p>健康、住址、照料责任和经济困难等敏感信息，默认不进入公开动态。任何人都可以拒绝具体请求，也可以暂停或退出圈子。</p></div></Modal>;
}

function MembersSheet({ circle, onProfile, onInvite, onClose }: { circle: Circle; onProfile: (id?: string) => void; onInvite: () => void; onClose: () => void }) {
  const circleMembers = circle.memberIds.map((id) => memberById(id));
  return <Modal onClose={onClose} label={`${circle.name}全部成员`} wide><div className="sheet-heading member-heading"><Pill color={circle.color}>{circle.members} 位成员</Pill><h2>{circle.name}的成员地图</h2><p>这里展示的是最近活跃的角色。点击任意成员，可以看到对方愿意公开的需要、提供、好人卡与联系方式。</p></div><div className="member-list">{circleMembers.map((member,index) => { const account = accountFor(member.id, circle.id); const offer = demoDb.listings.find((listing) => listing.memberId === member.id && listing.type === "offer" && listing.status === "active"); return <button key={member.id} onClick={() => onProfile(member.id)}><span className="member-index">0{index+1}</span><Character member={member}/><span><b>{member.name}</b><small>{member.role}</small><p>{offer?.title ?? member.bio}</p></span><strong>{account.balance > 0 ? "+" : ""}{account.balance}</strong></button>; })}</div><button className="primary-button" onClick={onInvite}>＋ 邀请一位新成员</button></Modal>;
}

function InviteSheet({ circle, onClose, onNotice }: { circle: Circle; onClose: () => void; onNotice: (message: string) => void }) {
  const [method, setMethod] = useState<"link" | "poster">("link");
  return <Modal onClose={onClose} label={`邀请加入${circle.name}`}><div className="sheet-heading"><Pill color={circle.color}>{circle.joining}</Pill><h2>邀请一个认识的人，加入 {circle.name}</h2><p>{circle.invitation}</p></div><div className="invite-tabs"><button className={method === "link" ? "active" : ""} onClick={() => setMethod("link")}>邀请链接</button><button className={method === "poster" ? "active" : ""} onClick={() => setMethod("poster")}>微信邀请图</button></div>{method === "link" ? <div className="invite-link"><span>7 天有效 · 仅可使用 1 次</span><b>flow-circle.site/join/{circle.id}-7K2</b><button onClick={() => onNotice("邀请链接已复制（静态演示）")}>复制链接</button></div> : <div className={`mini-invite-poster hero-${circle.color}`}><div className={`camp-flag flag-${circle.color}`}>{circle.short}</div><span>来自俏也的邀请</span><h3>来 {circle.name}<br/>看看我们还能怎样互相帮助</h3><p>可以问，也可以拒绝。</p><div className="mini-code">▦</div></div>}<div className="invite-checklist"><b>受邀者会先看到</b><span>✓ 圈子介绍与运行方式</span><span>✓ 什么会被记录、谁能看见</span><span>✓ 可以拒绝具体请求，也可以退出</span></div><button className="primary-button" onClick={() => onNotice(method === "link" ? "邀请链接已发到微信（静态演示）" : "邀请图已准备好（静态演示）")}>{method === "link" ? "发到微信" : "保存邀请图"}</button></Modal>;
}

function CreateCircleView({ onExit, onDone }: { onExit: () => void; onDone: (name: string) => void }) {
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("周末手作营地");
  const [short, setShort] = useState("作");
  const [currency, setCurrency] = useState("木屑");
  const [tagline, setTagline] = useState("一起做东西，也一起把工具、经验和时间分享出来。");
  const [scene, setScene] = useState("friends");
  const [joining, setJoining] = useState("direct");
  const [visibility, setVisibility] = useState("public");
  const [needs, setNeeds] = useState(true);
  const [cards, setCards] = useState(true);
  const [mystery, setMystery] = useState(true);
  const [allowExit, setAllowExit] = useState(true);
  const [referenceName, setReferenceName] = useState("一小时手作协作");
  const [referenceValue, setReferenceValue] = useState("约 5 木屑");
  const steps = ["圈子身份", "互助设置", "成员与边界", "预览确认"];
  const sceneLabels: Record<string,string> = { friends: "熟人邀请", learning: "共学小组", place: "线下社区" };

  if (saved) return <section className="create-success"><div className="success-burst">✓</div><Pill color="green">草稿已保存 · STATIC DEMO</Pill><h2>{name}<br/>准备好了。</h2><p>这个静态演示不会真的建立成员账户或发送邀请。正式产品中，草稿会先进入管理员检查，再开放邀请链接。</p><div className="created-passport"><Character text={short || "圈"} color="green" variant="wave"/><div><span>新圈草稿</span><h3>{name}</h3><p>{currency} · {sceneLabels[scene]} · {joining === "direct" ? "受邀直接加入" : "管理员审批"}</p></div><b>草稿</b></div><div className="create-actions"><button className="secondary-button" onClick={() => { setSaved(false); setStep(4); }}>返回修改</button><button className="primary-button" onClick={onExit}>回到我的圈子</button></div></section>;

  return <section className="create-page">
    <div className="create-intro"><div><Pill color="green">任何人都可以创建</Pill><h2>给一段真实关系，<br/>画出清楚的边界。</h2><p>圈子不是一种新产品，而是一组独立的成员、规则和互助账户。</p></div><button onClick={onExit}>暂时退出</button></div>

    <nav className="create-progress" aria-label="创建圈子步骤">{steps.map((label, index) => <button key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} onClick={() => setStep(index + 1)}><b>{step > index + 1 ? "✓" : `0${index + 1}`}</b><span>{label}</span></button>)}</nav>

    <div className="create-panel">
      {step === 1 && <><div className="create-heading"><span>STEP 01 · IDENTITY</span><h2>这个圈子，连接着谁？</h2><p>先写清楚共同场景，不需要把它包装成一个宏大的社区。</p></div><div className="create-form-grid"><label className="wide"><span>圈子名称</span><input value={name} onChange={(event) => setName(event.target.value)}/></label><label><span>地图上的简称</span><input maxLength={2} value={short} onChange={(event) => setShort(event.target.value)}/></label><label><span>互助额度名称</span><input value={currency} onChange={(event) => { const next = event.target.value; setReferenceValue((value) => value === `约 5 ${currency}` ? `约 5 ${next}` : value); setCurrency(next); }}/></label><label className="wide"><span>一句话介绍</span><textarea value={tagline} onChange={(event) => setTagline(event.target.value)}/></label></div><span className="form-label">更接近哪一种真实场景</span><div className="create-choice-row"><button className={scene === "friends" ? "active" : ""} onClick={() => setScene("friends")}><b>熟人邀请</b><small>朋友、协作者与被认真介绍的人</small></button><button className={scene === "learning" ? "active" : ""} onClick={() => setScene("learning")}><b>共学小组</b><small>一起学习，也交换反馈与注意力</small></button><button className={scene === "place" ? "active" : ""} onClick={() => setScene("place")}><b>线下社区</b><small>共享空间、工具与日常照料</small></button></div></>}

      {step === 2 && <><div className="create-heading"><span>STEP 02 · MUTUAL CREDIT</span><h2>互助怎么被记住？</h2><p>额度只记录已经完成的帮助；需要、提供和好人卡是不同的记录。</p></div><div className="mechanism-card"><div className="mechanism-icon">＋<br/>−</div><div><Pill color="yellow">互助账户 · 默认机制</Pill><h3>成员之间共同记账</h3><p>提供帮助的人增加额度，接受帮助的人减少额度。正负都不是排名，也不与人民币兑换。</p></div><b>已选择</b></div><div className="reference-editor"><div><span>第一项协商参考</span><input value={referenceName} onChange={(event) => setReferenceName(event.target.value)}/></div><div><span>大约多少额度</span><input value={referenceValue} onChange={(event) => setReferenceValue(event.target.value)}/></div><small>只是第一次协商的参照，不是统一价格。创建后可以继续增加、修改或删除。</small></div><span className="form-label">圈子里还允许留下什么</span><div className="create-toggle-grid"><label><span><b>需要 / 提供</b><small>发布不会改变余额</small></span><input type="checkbox" checked={needs} onChange={(event) => setNeeds(event.target.checked)}/></label><label><span><b>好人卡</b><small>感谢故事不产生债务</small></span><input type="checkbox" checked={cards} onChange={(event) => setCards(event.target.checked)}/></label></div></>}

      {step === 3 && <><div className="create-heading"><span>STEP 03 · GOVERNANCE</span><h2>谁能加入，什么不公开？</h2><p>先把拒绝、隐私和退出写进规则，再开始邀请成员。</p></div><span className="form-label">新成员怎么加入</span><div className="create-choice-row two"><button className={joining === "direct" ? "active" : ""} onClick={() => setJoining("direct")}><b>种子期 · 受邀直接加入</b><small>适合彼此认识的小范围启动</small></button><button className={joining === "approval" ? "active" : ""} onClick={() => setJoining("approval")}><b>扩大期 · 管理员审批</b><small>适合关系正在向外扩展的圈子</small></button></div><span className="form-label">互助记录默认可见范围</span><div className="visibility-choice"><button className={visibility === "public" ? "active" : ""} onClick={() => setVisibility("public")}><b>圈内公开</b><small>人物、故事和额度对本圈可见</small></button><button className={visibility === "private" ? "active" : ""} onClick={() => setVisibility("private")}><b>仅当事人</b><small>需要时再由记录者主动公开</small></button></div><div className="boundary-checks"><label><span><b>允许神秘记录</b><small>隐藏人物和具体故事，只留下互助类型、时间和额度</small></span><input type="checkbox" checked={mystery} onChange={(event) => setMystery(event.target.checked)}/></label><label><span><b>成员可以暂停或退出</b><small>退出前可下载自己的记录，不设置惩罚</small></span><input type="checkbox" checked={allowExit} onChange={(event) => setAllowExit(event.target.checked)}/></label><label><span><b>明确不与人民币兑换</b><small>这是创建圈子的必要边界，不能关闭</small></span><input type="checkbox" checked readOnly/></label><label><span><b>明确不做贡献排名</b><small>负余额也不是信用污点，不能关闭</small></span><input type="checkbox" checked readOnly/></label></div></>}

      {step === 4 && <><div className="create-heading"><span>STEP 04 · REVIEW</span><h2>邀请别人之前，先完整看一遍。</h2><p>这张预览只展示建圈所需的最小规则；创建后仍可以继续讨论和修改。</p></div><article className="circle-draft-preview"><header><div className="draft-flag"><span>{short || "圈"}</span></div><div><Pill color="cream">新圈草稿 · {sceneLabels[scene]}</Pill><h2>{name || "未命名圈子"}</h2><p>{tagline || "还没有写一句话介绍"}</p></div></header><div className="draft-summary"><div><span>互助额度</span><b>{currency || "未命名"}</b><small>互助账户 · 不兑换人民币</small></div><div><span>加入方式</span><b>{joining === "direct" ? "受邀直接加入" : "管理员审批"}</b><small>{visibility === "public" ? "记录默认圈内公开" : "记录默认仅当事人"}</small></div><div><span>第一项参考</span><b>{referenceName}</b><small>{referenceValue}</small></div></div><ul><li>只记录已经完成的互助</li>{needs && <li>允许发布需要 / 提供，发布不改变余额</li>}{cards && <li>允许发送好人卡，好人卡不产生债务</li>}{mystery && <li>敏感互助可以使用神秘记录</li>}{allowExit && <li>成员可以暂停或退出并带走自己的记录</li>}</ul><footer><span>可以开口，也可以拒绝。</span><b>NO PRESSURE · NO RANKING</b></footer></article><div className="review-warning"><b>静态演示提示</b><p>点击“保存圈子草稿”只会展示创建完成状态，不会建立真实数据库、账户或邀请链接。</p></div></>}

      <div className="create-footer"><button className="secondary-button" onClick={() => step === 1 ? onExit() : setStep(step - 1)}>{step === 1 ? "取消" : "← 上一步"}</button>{step < 4 ? <button className="primary-button" onClick={() => setStep(step + 1)}>继续：{steps[step]} →</button> : <button className="primary-button" onClick={() => { onDone(name || "新圈子"); setSaved(true); }}>保存圈子草稿</button>}</div>
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
    const listing = demoDb.listings.find((item) => item.id === post.sourceId)!;
    details.push({ label: "时间 / 地点", value: `${listing.time} · ${listing.location}` }, { label: "参考", value: listing.reference }, { label: "可见范围", value: listing.visibility === "cross-circle" ? "跨圈公开" : "相关圈子" });
  } else if (post.source === "transaction") {
    const transaction = demoDb.transactions.find((item) => item.id === post.sourceId)!;
    const status = transaction.status === "confirmed" ? "已确认" : transaction.status === "corrected" ? "已更正" : "已撤销";
    details.push({ label: "发生 / 记录", value: `${transaction.happenedAt} · ${transaction.recordedAt} 记录` }, { label: "额度与状态", value: `${transaction.amount} ${circle.currency} · ${status}` }, { label: "可见范围", value: transaction.visibility === "mystery" ? "圈内神秘记录" : transaction.visibility === "private" ? "仅当事人" : "圈内公开" });
  } else {
    const card = demoDb.goodCards.find((item) => item.id === post.sourceId)!;
    details.push({ label: "写下日期", value: card.date }, { label: "可见范围", value: card.visibility === "cross-circle" ? "跨圈公开" : "接收者已隐藏" }, { label: "余额影响", value: "不产生余额，也不需要偿还" });
  }
  return <Modal onClose={onClose} label="动态详情"><div className={`post-detail detail-${post.color}`}><div className="post-detail-head"><Character text={post.avatar} color={post.color} variant={post.avatarVariant}/><div><Pill color="cream">{post.badge}</Pill><h2>{post.person}</h2><p>{post.role}</p></div></div><p className="post-detail-copy">{post.text}</p><div className="chip-row">{post.chips.map((chip) => <span key={chip}>#{chip}</span>)}</div></div><div className="detail-meta">{details.map((detail) => <div key={detail.label}><span>{detail.label}</span><b>{detail.value}</b></div>)}<div><span>下一步</span><b>{post.kind === "need" || post.kind === "offer" ? "进入主页后微信联系" : "可以查看成员完整档案"}</b></div></div><div className="sheet-actions">{post.memberId ? <button className="secondary-button" onClick={onProfile}>查看成员主页</button> : <button className="secondary-button" onClick={onClose}>知道了</button>}<button className="primary-button" onClick={onShare}>生成分享图</button></div></Modal>;
}

function SettingsSheet({ onClose, onNotice }: { onClose: () => void; onNotice: (message: string) => void }) {
  const [cards, setCards] = useState(true); const [needs, setNeeds] = useState(true); const [hidden, setHidden] = useState(false);
  return <Modal onClose={onClose} label="跨圈公开设置"><div className="sheet-heading"><Pill color="blue">我的公开边界</Pill><h2>哪些内容跟着我跨圈出现</h2><p>圈内余额和交易不会自动跨圈。你也可以随时隐藏某一张好人卡或一条帖子。</p></div><div className="toggle-list"><label><span><b>未隐藏的好人卡</b><small>让具体的感谢故事跟着我</small></span><input type="checkbox" checked={cards} onChange={(event) => setCards(event.target.checked)}/></label><label><span><b>标记为跨圈的需要 / 提供</b><small>只有我主动选择的内容会出现</small></span><input type="checkbox" checked={needs} onChange={(event) => setNeeds(event.target.checked)}/></label><label><span><b>隐藏内容也仅自己可见</b><small>关闭后仍不会对其他成员公开</small></span><input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)}/></label></div><button className="primary-button" onClick={() => { onNotice("公开设置已更新（静态演示）"); onClose(); }}>保存设置</button></Modal>;
}
