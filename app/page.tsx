"use client";

import { useMemo, useState } from "react";

type View = "feed" | "discover" | "circle" | "me";
type ComposerType = "record" | "need" | "offer" | "card";

const circles = [
  { id: "qiao", name: "俏也交换圈", short: "俏", color: "pink", currency: "泡泡", balance: 28, members: 18, role: "旅居交换者" },
  { id: "human", name: "做人共学", short: "人", color: "yellow", currency: "人类点", balance: -6, members: 32, role: "共学召集人" },
  { id: "village", name: "龙潭生活营地", short: "村", color: "blue", currency: "饭票", balance: 12, members: 24, role: "临时村民" },
] as const;

const posts = [
  { id: 1, kind: "offer", badge: "我可以给", person: "阿树", role: "修理玩家", avatar: "树", color: "green", text: "这周可以帮忙修小家电，也可以一起研究怎么修。", meta: "俏也交换圈 · 杭州", chips: ["小家电", "一起动手"] },
  { id: 2, kind: "need", badge: "我想要", person: "米粒", role: "饭桌召集人", avatar: "米", color: "pink", text: "周四晚上想找一个人，帮我看看新活动的介绍文案。", meta: "做人共学 · 线上", chips: ["30 分钟", "文案"] },
  { id: 3, kind: "trade", badge: "互助完成", person: "小王 → 俏也", role: "圈内公开", avatar: "住", color: "yellow", text: "在厦门借住了一晚。聊天到半夜，第二天一起吃了早饭。", meta: "俏也交换圈 · +10 泡泡", chips: ["住宿", "昨天"] },
  { id: 4, kind: "mystery", badge: "神秘记录", person: "圈里发生了一次互助", role: "身份与故事已隐藏", avatar: "?", color: "blue", text: "有人接住了另一个人的需要。知道互助发生过，就已经足够。", meta: "龙潭生活营地 · 8 饭票", chips: ["照料", "3 小时前"] },
  { id: 5, kind: "card", badge: "好人卡", person: "苔苔 → 阿树", role: "跨圈公开", avatar: "心", color: "coral", text: "下雨那天阿树发现公共厨房漏水，默默修好了，还教会了两个人。", meta: "被看见的第 7 次", chips: ["公共劳动", "谢谢你"] },
] as const;

const intents: { id: ComposerType; label: string; hint: string; color: string; icon: string }[] = [
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

function Character({ text, color = "yellow", small = false }: { text: string; color?: string; small?: boolean }) {
  return (
    <span className={`character character-${color} ${small ? "character-small" : ""}`} aria-hidden="true">
      <i className="character-hair" />
      <i className="character-eyes">•　•</i>
      <i className="character-smile">⌣</i>
      <b>{text}</b>
    </span>
  );
}

function Pill({ children, color = "cream" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill pill-${color}`}>{children}</span>;
}

function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-title">
      <div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>
      {action && <button onClick={onAction}>{action}<b>→</b></button>}
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("feed");
  const [circleId, setCircleId] = useState("qiao");
  const [composer, setComposer] = useState(false);
  const [intent, setIntent] = useState<ComposerType>("record");
  const [draft, setDraft] = useState(false);
  const [share, setShare] = useState(false);
  const [profile, setProfile] = useState(false);
  const [contact, setContact] = useState(false);
  const [toast, setToast] = useState("");

  const activeCircle = circles.find((item) => item.id === circleId) ?? circles[0];
  const currentDraft = draftCopy[intent];
  const filteredPosts = useMemo(() => posts.filter((post) => view !== "discover" || post.kind === "need" || post.kind === "offer"), [view]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function openComposer(nextIntent: ComposerType = "record") {
    setIntent(nextIntent);
    setDraft(false);
    setComposer(true);
  }

  function selectCircle(id: string) {
    setCircleId(id);
    setView("feed");
  }

  function confirmDraft() {
    setComposer(false);
    setDraft(false);
    flash(intent === "record" ? "记录已进入圈子，对方可以修改或拒绝" : intent === "card" ? "好人卡已送到对方的跨圈主页" : "已经发布，可以生成分享图啦");
  }

  return (
    <main className="world-shell">
      <aside className="circle-dock" aria-label="我的圈子地图">
        <div className="brand-mark"><span>流动圈</span><b>LIU DONG</b></div>
        <div className="dock-heading"><span>我的地图</span><b>03</b></div>
        <div className="dock-list">
          {circles.map((item) => (
            <button key={item.id} className={`dock-circle dock-${item.color} ${circleId === item.id ? "active" : ""}`} onClick={() => selectCircle(item.id)}>
              <Character text={item.short} color={item.color} small />
              <span><b>{item.name}</b><small>{item.role}</small></span>
              <strong>{item.balance > 0 ? "+" : ""}{item.balance}</strong>
            </button>
          ))}
        </div>
        <button className="new-circle" onClick={() => flash("任何人都可以创建新圈子")}><b>＋</b><span>创建新圈子</span></button>
        <p className="dock-note">三个圈子只是俏也加入的三个社区。每个圈子都有自己的成员、规则和互助额度。</p>
      </aside>

      <section className="phone-stage">
        <div className="app-frame">
          <header className="topbar">
            <div><p>我的圈子动态</p><h1>早上好，俏也！</h1></div>
            <button className="avatar-button" onClick={() => setView("me")} aria-label="打开我的主页"><Character text="俏" color="pink" /></button>
          </header>

          <nav className="circle-switcher" aria-label="切换圈子">
            {circles.map((item) => (
              <button key={item.id} className={circleId === item.id ? "selected" : ""} onClick={() => selectCircle(item.id)}>
                <span className={`circle-dot dot-${item.color}`} />
                <span>{item.name}</span>
                <b>{item.balance > 0 ? "+" : ""}{item.balance}</b>
              </button>
            ))}
          </nav>

          <div className="view-content">
            {view === "feed" && <FeedView activeCircle={activeCircle} posts={filteredPosts} onSpeak={openComposer} onCircle={() => setView("circle")} onMe={() => setView("me")} onProfile={() => setProfile(true)} onShare={() => setShare(true)} />}
            {view === "discover" && <DiscoverView posts={filteredPosts} onSpeak={openComposer} onProfile={() => setProfile(true)} onShare={() => setShare(true)} />}
            {view === "circle" && <CircleView circle={activeCircle} onSpeak={openComposer} onProfile={() => setProfile(true)} />}
            {view === "me" && <MeView onShare={() => setShare(true)} onCard={() => openComposer("card")} />}
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
        <div className="world-card world-card-main">
          <span className="world-kicker">TODAY IN YOUR CIRCLES</span>
          <h2>今天，圈里有<br/><em>8 件事</em>在流动</h2>
          <div className="world-stats"><span><b>4</b>需要 / 提供</span><span><b>3</b>互助完成</span><span><b>1</b>张好人卡</span></div>
        </div>
        <div className="world-card value-card">
          <span className="world-kicker">这个圈怎么估量</span>
          <h3>{activeCircle.name}</h3>
          <div><b>一晚住宿</b><span>≈ 10 {activeCircle.currency}</span></div>
          <div><b>一顿家常饭</b><span>≈ 4 {activeCircle.currency}</span></div>
          <p>只是协商参考，不是统一价格。</p>
        </div>
        <div className="world-rule"><b>可以问，<br/>也可以拒绝。</b><span>NO PRESSURE · NO RANKING</span></div>
      </aside>

      {composer && <ComposerSheet intent={intent} setIntent={(next) => { setIntent(next); setDraft(false); }} draft={draft} setDraft={setDraft} currentDraft={currentDraft} onClose={() => setComposer(false)} onConfirm={confirmDraft} />}
      {share && <ShareSheet onClose={() => setShare(false)} onDone={() => { setShare(false); flash("分享图已准备好，可以发到微信群") }} />}
      {profile && <ProfileSheet contact={contact} onContact={() => setContact(true)} onClose={() => { setProfile(false); setContact(false); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function AgentHero({ onSpeak }: { onSpeak: (intent?: ComposerType) => void }) {
  return (
    <section className="agent-hero">
      <div className="hero-decor decor-grid" /><div className="hero-decor decor-square" /><div className="hero-decor decor-circle" />
      <div className="agent-orb"><i className="agent-antenna"/><span>◕‿◕</span><b>泡泡助手</b></div>
      <div className="agent-copy"><Pill color="cream">在线 · ONLINE</Pill><h2>说一句，<br/>让互助流动起来。</h2><p>我会帮你整理成可检查、可修改的草稿。</p></div>
      <button className="speak-button" onClick={() => onSpeak()}><span>●</span><b>说一句</b><small>交易 · 需要 · 提供 · 好人卡</small></button>
    </section>
  );
}

function FeedView({ activeCircle, posts: feedPosts, onSpeak, onCircle, onMe, onProfile, onShare }: { activeCircle: (typeof circles)[number]; posts: typeof posts; onSpeak: (intent?: ComposerType) => void; onCircle: () => void; onMe: () => void; onProfile: () => void; onShare: () => void }) {
  return <><AgentHero onSpeak={onSpeak}/><section className="stats-grid" aria-label="当前圈子概览">
    <button className="stat-card stat-yellow" onClick={onCircle}><span>当前额度</span><strong>{activeCircle.balance > 0 ? "+" : ""}{activeCircle.balance}</strong><small>{activeCircle.currency} · {activeCircle.name}</small></button>
    <button className="stat-card stat-pink" onClick={onMe}><span>我给出过</span><strong>86</strong><small>不是排名，是记忆</small></button>
    <button className="stat-card stat-blue" onClick={onProfile}><span>好人卡</span><strong>12</strong><small>跨圈跟着我</small></button>
  </section><SectionTitle eyebrow="LIVE FROM THE CIRCLE" title="圈里正在发生" action="筛选" onAction={() => undefined}/><FeedList posts={feedPosts} onProfile={onProfile} onShare={onShare}/></>;
}

function DiscoverView({ posts: discoverPosts, onSpeak, onProfile, onShare }: { posts: typeof posts; onSpeak: (intent?: ComposerType) => void; onProfile: () => void; onShare: () => void }) {
  return <><section className="page-hero discover-hero"><div><Pill color="pink">跨圈发现</Pill><h2>有人在寻找，<br/>也有人正好可以给。</h2><p>看到“可以提供”，不代表对方必须答应。先问问就好。</p></div><button onClick={() => onSpeak("need")}>＋ 发布</button></section><div className="filter-row"><button className="active">全部</button><button>我想要</button><button>我可以给</button><button>附近</button></div><FeedList posts={discoverPosts} onProfile={onProfile} onShare={onShare}/></>;
}

function CircleView({ circle, onSpeak, onProfile }: { circle: (typeof circles)[number]; onSpeak: (intent?: ComposerType) => void; onProfile: () => void }) {
  return <><section className={`page-hero circle-hero hero-${circle.color}`}><div><Pill color="cream">我的圈子</Pill><h2>{circle.name}</h2><p>{circle.members} 位成员 · 每个人都可以问，也都可以拒绝。</p></div><div className="coin-badge"><span>{circle.balance > 0 ? "+" : ""}{circle.balance}</span><small>{circle.currency}</small></div></section><div className="circle-actions"><button onClick={() => onSpeak()}>● 说一句</button><button>邀请成员</button><button>圈子介绍</button></div><section className="balance-panel"><div><span>当前额度</span><strong>{circle.balance > 0 ? "+" : ""}{circle.balance}</strong><small>我在这个圈的流动额度</small></div><div><span>给出过</span><strong>42</strong><small>来自真实互助</small></div><div><span>收到过</span><strong>14</strong><small>接受帮助也很好</small></div></section><SectionTitle eyebrow="REFERENCE" title="圈内参考物" action="查看规则"/><div className="reference-grid"><div><b>一晚住宿</b><span>约 10 {circle.currency}</span></div><div><b>一顿家常饭</b><span>约 4 {circle.currency}</span></div><div><b>半小时小忙</b><span>约 2 {circle.currency}</span></div></div><SectionTitle eyebrow="PEOPLE" title="最近活跃的成员" action="全部成员"/><div className="member-row">{[["树","阿树","修理玩家"],["米","米粒","饭桌召集人"],["苔","苔苔","植物照料者"],["王","小王","旅居伙伴"]].map(([avatar,name,role], index)=><button key={name} onClick={index===0?onProfile:undefined}><Character text={avatar} color={["green","pink","blue","yellow"][index]} small/><b>{name}</b><small>{role}</small></button>)}</div></>;
}

function MeView({ onShare, onCard }: { onShare: () => void; onCard: () => void }) {
  return <><section className="profile-hero"><Character text="俏" color="pink"/><div><Pill color="cream">跨圈角色卡</Pill><h2>俏也</h2><p>旅居交换者 · 活动召集人 · 礼物实验者</p></div><button onClick={onShare}>生成分享图</button></section><section className="passport-card"><div><span>COMMUNITY PASSPORT</span><h3>12 张好人卡，来自 8 个人</h3><p>“她让人觉得，可以放心开口问。”</p></div><button onClick={onCard}>＋ 发一张卡</button></section><SectionTitle eyebrow="OPEN NOW" title="我目前的需要 / 提供" action="生成分享图" onAction={onShare}/><div className="my-board"><div className="my-need"><Pill color="pink">我想要</Pill><h3>寻找下周在泉州的一晚住宿</h3><span>跨圈公开</span></div><div className="my-offer"><Pill color="green">我可以给</Pill><h3>活动设计、咨询，以及一顿随缘的饭</h3><span>3 个圈可见</span></div></div><SectionTitle eyebrow="MY CIRCLES" title="我的圈子" action="创建新圈"/><div className="my-circles">{circles.map((circle)=><div className="my-circle" key={circle.id}><Character text={circle.short} color={circle.color} small/><span><b>{circle.name}</b><small>{circle.role} · {circle.members} 人</small></span><strong>{circle.balance>0?"+":""}{circle.balance}</strong></div>)}</div></>;
}

function FeedList({ posts: list, onProfile, onShare }: { posts: typeof posts; onProfile: () => void; onShare: () => void }) {
  return <div className="feed-list">{list.map((post)=><article key={post.id} className={`feed-card feed-${post.kind}`}><header><button className="feed-person" onClick={onProfile}><Character text={post.avatar} color={post.color} small/><span><b>{post.person}</b><small>{post.role}</small></span></button><Pill color={post.color}>{post.badge}</Pill></header><p className="feed-text">{post.text}</p><div className="chip-row">{post.chips.map((chip)=><span key={chip}>#{chip}</span>)}</div><footer><span>{post.meta}</span><button onClick={onShare}>分享 ↗</button></footer></article>)}</div>;
}

function ComposerSheet({ intent, setIntent, draft, setDraft, currentDraft, onClose, onConfirm }: { intent: ComposerType; setIntent: (intent: ComposerType) => void; draft: boolean; setDraft: (draft: boolean) => void; currentDraft: (typeof draftCopy)[ComposerType]; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="sheet composer-sheet" role="dialog" aria-modal="true" aria-label="说一句" onMouseDown={(event)=>event.stopPropagation()}><button className="close-button" onClick={onClose}>×</button><div className="sheet-agent"><div className="mini-agent">◕‿◕</div><div><span>泡泡助手</span><h2>{draft?"我整理成这样，对吗？":"你想让什么流动起来？"}</h2><p>{draft?"确认前可以修改，发布后也可以撤回。":"先选一种，再像平常说话一样告诉我。"}</p></div></div>{!draft?<><div className="intent-grid">{intents.map((item)=><button key={item.id} className={`intent intent-${item.color} ${intent===item.id?"selected":""}`} onClick={()=>setIntent(item.id)}><b>{item.icon}</b><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}</div><div className="voice-box"><span className="wave"><i/><i/><i/><i/><i/><i/><i/></span><p>{currentDraft.spoken}</p><button className="record-circle" aria-label="开始录音">●</button></div><button className="primary-button" onClick={()=>setDraft(true)}>让泡泡助手整理一下 <b>→</b></button><button className="text-link">也可以切换为键盘输入</button></>:<><div className={`draft-card draft-${intents.find((item)=>item.id===intent)?.color??"yellow"}`}><Pill color="cream">草稿 · 可修改</Pill><h3>{currentDraft.title}</h3><p>{currentDraft.detail}</p><div>{currentDraft.footer}</div></div><label className="visibility-row"><span>让谁看见</span><select defaultValue={intent==="card"?"public":"circle"}><option value="circle">相关圈子</option><option value="public">跨圈公开</option><option value="mystery">神秘记录</option></select></label><p className="soft-note">发布不等于强制履约。任何人都可以拒绝、修改或撤回。</p><div className="sheet-actions"><button className="secondary-button" onClick={()=>setDraft(false)}>返回修改</button><button className="primary-button" onClick={onConfirm}>确认发布 <b>→</b></button></div></>}</section></div>;
}

function ShareSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const cells = Array.from({length:81},(_,index)=>(index*7+Math.floor(index/9)*3)%5<2);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="sheet share-sheet" role="dialog" aria-modal="true" aria-label="分享图预览" onMouseDown={(event)=>event.stopPropagation()}><button className="close-button" onClick={onClose}>×</button><span className="sheet-kicker">微信群分享图预览</span><div className="share-poster"><div className="poster-top"><Character text="俏" color="pink"/><div><span>旅居交换者</span><h2>俏也的流动清单</h2></div></div><div className="poster-panel poster-need"><b>我目前想要</b><p>下周在泉州的一晚住宿</p><p>有人帮我看一遍新活动文案</p></div><div className="poster-panel poster-offer"><b>我目前可以给</b><p>活动设计和一小时咨询</p><p>一顿随缘的饭，或者陪你散步</p></div><div className="poster-bottom"><div><b>可以问，也可以拒绝。</b><span>来看看我们还能怎样交换</span></div><div className="fake-qr">{cells.map((on,index)=><i key={index} className={on?"on":""}/>)}</div></div></div><button className="primary-button" onClick={onDone}>准备好，分享到微信群</button></section></div>;
}

function ProfileSheet({ contact, onContact, onClose }: { contact: boolean; onContact: () => void; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="sheet profile-sheet" role="dialog" aria-modal="true" aria-label="成员主页" onMouseDown={(event)=>event.stopPropagation()}><button className="close-button" onClick={onClose}>×</button><div className="role-card"><Character text="树" color="green"/><div><Pill color="cream">同圈成员</Pill><h2>阿树</h2><p>修理玩家 · 公共空间守护者</p></div></div><div className="profile-numbers"><div><b>+16</b><span>当前额度</span></div><div><b>42</b><span>给出过</span></div><div><b>26</b><span>收到过</span></div></div><div className="profile-section"><h3>我可以给</h3><p>修小家电 · 一起研究怎么修 · 看看空间里的奇怪声音</p></div><div className="profile-section card-story"><h3>好人卡故事</h3><p>“下雨那天他发现厨房漏水，默默修好了，还教会了两个人。”</p><small>苔苔写于 3 天前 · 跨圈公开</small></div>{contact?<div className="contact-reveal"><span>微信号</span><b>ashu_fixthings</b><button>复制</button></div>:<button className="primary-button" onClick={onContact}>联系阿树，查看微信号</button>}<p className="soft-note">看到“可以提供”不代表对方必须答应。先问问就好。</p></section></div>;
}
