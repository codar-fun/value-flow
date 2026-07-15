"use client";

import { useMemo, useState } from "react";

type View = "feed" | "discover" | "circle" | "me";
type ComposerType = "record" | "need" | "offer" | "card";

const circles = [
  { id: "qiao", name: "俏也交换圈", short: "俏", color: "pink", currency: "泡泡", balance: 28, members: 18, role: "旅居交换者" },
  { id: "human", name: "做人共学", short: "人", color: "yellow", currency: "人类点", balance: -6, members: 32, role: "共学召集人" },
  { id: "village", name: "龙潭生活营地", short: "村", color: "blue", currency: "饭票", balance: 12, members: 24, role: "临时村民" },
];

const posts = [
  { id: 1, kind: "offer", badge: "我可以给", person: "阿树", role: "修理玩家 · Lv.4", avatar: "树", color: "green", text: "这周可以帮忙修小家电，也可以一起研究怎么修。", meta: "俏也交换圈 · 杭州", chips: ["小家电", "一起动手"] },
  { id: 2, kind: "need", badge: "我想要", person: "米粒", role: "饭桌召集人 · Lv.6", avatar: "米", color: "pink", text: "周四晚上想找一个人，帮我看看新活动的介绍文案。", meta: "做人共学 · 线上", chips: ["30 分钟", "文案"] },
  { id: 3, kind: "trade", badge: "互助完成", person: "小王 → 俏也", role: "圈内公开", avatar: "住", color: "yellow", text: "在厦门借住了一晚。聊天到半夜，第二天一起吃了早饭。", meta: "俏也交换圈 · +10 泡泡", chips: ["住宿", "昨天"] },
  { id: 4, kind: "mystery", badge: "神秘事件", person: "两位不愿署名的成员", role: "身份与故事已隐藏", avatar: "?", color: "blue", text: "圈里发生了一次照料互助。知道有人接住了另一个人，就够了。", meta: "龙潭生活营地 · 8 饭票", chips: ["照料", "3 小时前"] },
  { id: 5, kind: "card", badge: "好人卡", person: "苔苔 → 阿树", role: "跨圈公开", avatar: "♥", color: "pink", text: "下雨那天阿树发现公共厨房漏水，默默修好了，还教会了两个人。", meta: "被看见的第 7 次", chips: ["公共劳动", "谢谢你"] },
];

const intents: { id: ComposerType; label: string; hint: string; color: string }[] = [
  { id: "record", label: "记一笔", hint: "已经发生的互助", color: "yellow" },
  { id: "need", label: "我想要", hint: "向圈子发出请求", color: "pink" },
  { id: "offer", label: "我可以给", hint: "让能力被发现", color: "green" },
  { id: "card", label: "好人卡", hint: "我看见你了", color: "blue" },
];

const draftCopy: Record<ComposerType, { spoken: string; title: string; detail: string; footer: string }> = {
  record: { spoken: "记一下，昨天小王让我在厦门住了一晚，算 10 个泡泡。", title: "住宿互助 · 已完成", detail: "小王为俏也提供了一晚住宿", footer: "小王 +10 · 俏也 -10" },
  need: { spoken: "我最近需要一个人帮我看看活动文案，半小时就好。", title: "我想要 · 文案伙伴", detail: "帮忙看一遍活动介绍，给一点真实反应", footer: "做人共学 · 跨圈可见" },
  offer: { spoken: "我可以给大家做肩颈按摩，这周在杭州。", title: "我可以给 · 肩颈按摩", detail: "这周有两个空档，也欢迎用别的东西交换", footer: "俏也交换圈 · 杭州" },
  card: { spoken: "给阿树一张好人卡，他下雨那天把厨房漏水修好了。", title: "给阿树一张好人卡", detail: "下雨那天，他默默修好了公共厨房的漏水", footer: "署名：俏也 · 默认跨圈公开" },
};

function Character({ text, color = "yellow", small = false }: { text: string; color?: string; small?: boolean }) {
  return <span className={`character character-${color} ${small ? "character-small" : ""}`} aria-hidden="true">{text}</span>;
}

function Pill({ children, color = "cream" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill pill-${color}`}>{children}</span>;
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

  function confirmDraft() {
    setComposer(false);
    setDraft(false);
    flash(intent === "record" ? "记录已进入圈子，对方可以修改或拒绝" : intent === "card" ? "好人卡已送到对方的跨圈主页" : "已经发布，可以生成分享图啦");
  }

  return (
    <main className="world-shell">
      <aside className="desktop-rail" aria-label="圈子地图">
        <div className="brand-block">流<br/>动</div>
        <div className="rail-label">我的地图</div>
        {circles.map((item) => (
          <button key={item.id} className={`map-token map-${item.color} ${circleId === item.id ? "active" : ""}`} onClick={() => { setCircleId(item.id); setView("feed"); }}>
            <strong>{item.short}</strong><span>{item.name}</span>
          </button>
        ))}
        <button className="map-token map-new" onClick={() => flash("任何人都可以创建新圈子")}>＋<span>建新圈</span></button>
        <div className="rail-note">3 个圈子只是俏也当前创建的实例。每个人都能建立自己的圈。</div>
      </aside>

      <section className="app-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">我的圈子动态</p>
            <h1>早上好，俏也！</h1>
          </div>
          <button className="avatar-button" onClick={() => setView("me")} aria-label="打开我的主页"><Character text="俏" color="pink" /></button>
        </header>

        <div className="circle-strip" aria-label="切换圈子">
          {circles.map((item) => (
            <button key={item.id} className={`circle-chip ${circleId === item.id ? "selected" : ""}`} onClick={() => setCircleId(item.id)}>
              <span className={`dot dot-${item.color}`} />
              <span>{item.name}</span>
              <b>{item.balance > 0 ? "+" : ""}{item.balance}</b>
            </button>
          ))}
        </div>

        <section className="agent-console">
          <div className="agent-character">
            <div className="agent-antenna" />
            <div className="agent-face">◕‿◕</div>
            <span>泡泡助手</span>
          </div>
          <div className="agent-copy">
            <Pill color="yellow">ONLINE</Pill>
            <h2>跟我说一句，剩下的交给我。</h2>
            <p>记交易、发需要、写提供，或者送一张好人卡。</p>
          </div>
          <button className="speak-button" onClick={() => openComposer()}><span className="mic">●</span> 说一句</button>
        </section>

        {view === "feed" && (
          <>
            <section className="stats-grid" aria-label="当前圈子概览">
              <button className="stat-card stat-yellow" onClick={() => setView("circle")}><span>当前圈</span><strong>{activeCircle.balance > 0 ? "+" : ""}{activeCircle.balance}</strong><small>{activeCircle.currency} · 流动额度</small></button>
              <button className="stat-card stat-pink" onClick={() => setView("me")}><span>我给出过</span><strong>86</strong><small>不是排名，是记忆</small></button>
              <button className="stat-card stat-blue" onClick={() => setProfile(true)}><span>好人卡</span><strong>12</strong><small>跨圈跟着我</small></button>
            </section>
            <SectionTitle title="圈里正在发生" action="筛选" onAction={() => flash("可以按圈子和事件类型筛选")} />
            <div className="feed-list">{filteredPosts.map((post) => <FeedCard key={post.id} post={post} onProfile={() => setProfile(true)} onShare={() => setShare(true)} />)}</div>
          </>
        )}

        {view === "discover" && (
          <>
            <section className="page-intro intro-pink">
              <Pill color="pink">发现彼此</Pill>
              <h2>我想要，也可以给。</h2>
              <p>它们在同一条路上。看到感兴趣的人，直接去主页联系。</p>
              <div className="dual-actions"><button onClick={() => openComposer("need")}>＋ 我想要</button><button onClick={() => openComposer("offer")}>＋ 我可以给</button></div>
            </section>
            <div className="filter-row"><button className="active">全部</button><button>我想要</button><button>我可以给</button><button onClick={() => setShare(true)}>生成我的分享图</button></div>
            <div className="feed-list">{filteredPosts.map((post) => <FeedCard key={post.id} post={post} onProfile={() => setProfile(true)} onShare={() => setShare(true)} />)}</div>
          </>
        )}

        {view === "circle" && <CirclePage circle={activeCircle} onSpeak={() => openComposer()} onProfile={() => setProfile(true)} />}
        {view === "me" && <MePage onShare={() => setShare(true)} onCard={() => openComposer("card")} />}

        <nav className="bottom-nav" aria-label="主导航">
          <button className={view === "feed" ? "active" : ""} onClick={() => setView("feed")}><span>⌂</span>动态</button>
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><span>◇</span>发现</button>
          <button className="nav-speak" onClick={() => openComposer()} aria-label="说一句"><span>●</span></button>
          <button className={view === "circle" ? "active" : ""} onClick={() => setView("circle")}><span>▦</span>圈子</button>
          <button className={view === "me" ? "active" : ""} onClick={() => setView("me")}><span>☺</span>我的</button>
        </nav>
      </section>

      <aside className="desktop-panel">
        <div className="panel-head"><Pill color="green">运营视图</Pill><h2>{activeCircle.name}</h2><p>电脑端先保留一个轻量观察窗口，详细 dashboard 之后再决定。</p></div>
        <div className="panel-block"><h3>今天的世界事件</h3><p><b>4</b> 条需要 / 提供</p><p><b>3</b> 次互助流动</p><p><b>1</b> 张好人卡</p></div>
        <div className="panel-block"><h3>等待留意</h3><p>2 位新成员准备加入</p><p>1 条记录提出了修改</p></div>
        <div className="panel-block rules"><h3>这个圈怎么流动</h3><span>一晚住宿 ≈ 10 泡泡</span><span>一顿家常饭 ≈ 4 泡泡</span><button onClick={() => flash("管理员可以直接修改参考物")}>编辑参考物</button></div>
      </aside>

      {composer && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setComposer(false)}>
          <section className="sheet composer-sheet" role="dialog" aria-modal="true" aria-label="说一句" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setComposer(false)}>×</button>
            <div className="sheet-agent"><div className="mini-agent">◕‿◕</div><div><p className="eyebrow">泡泡助手在听</p><h2>{draft ? "我先这样理解，对吗？" : "你想记下什么？"}</h2></div></div>
            {!draft ? (
              <>
                <div className="intent-grid">{intents.map((item) => <button key={item.id} className={`intent intent-${item.color} ${intent === item.id ? "selected" : ""}`} onClick={() => setIntent(item.id)}><b>{item.label}</b><span>{item.hint}</span></button>)}</div>
                <div className="voice-box"><div className="wave"><i/><i/><i/><i/><i/><i/><i/></div><p>{currentDraft.spoken}</p><button className="record-circle" aria-label="模拟录音">●</button></div>
                <button className="primary-button" onClick={() => setDraft(true)}>让 Agent 整理一下 →</button>
                <button className="text-link" onClick={() => setDraft(true)}>也可以古法填写</button>
              </>
            ) : (
              <>
                <article className={`draft-card draft-${intents.find((item) => item.id === intent)?.color}`}><Pill>{intents.find((item) => item.id === intent)?.label}</Pill><h3>{currentDraft.title}</h3><p>{currentDraft.detail}</p><div className="draft-meta">{currentDraft.footer}</div></article>
                <label className="visibility-row"><span>让谁看见</span><select defaultValue={intent === "card" ? "public" : "circle"}><option value="circle">相关圈子</option><option value="public">跨圈公开</option><option value="mystery">神秘记录</option></select></label>
                <p className="soft-note">确认后立即记录。相关成员之后可以提出修改或拒绝。</p>
                <div className="sheet-actions"><button className="secondary-button" onClick={() => setDraft(false)}>返回修改</button><button className="primary-button" onClick={confirmDraft}>确认，就这样</button></div>
              </>
            )}
          </section>
        </div>
      )}

      {share && <ShareSheet onClose={() => setShare(false)} onDone={() => { setShare(false); flash("分享图已准备好，可以发到微信群") }} />}
      {profile && <ProfileSheet contact={contact} onContact={() => setContact(true)} onClose={() => { setProfile(false); setContact(false); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return <div className="section-title"><h2>{title}</h2><button onClick={onAction}>{action} →</button></div>;
}

function FeedCard({ post, onProfile, onShare }: { post: (typeof posts)[number]; onProfile: () => void; onShare: () => void }) {
  return (
    <article className={`feed-card feed-${post.kind}`}>
      <button className="feed-person" onClick={onProfile}><Character text={post.avatar} color={post.color} /><span><Pill color={post.color}>{post.badge}</Pill><b>{post.person}</b><small>{post.role}</small></span></button>
      <p className="feed-text">{post.text}</p>
      <div className="chip-row">{post.chips.map((chip) => <span key={chip}>#{chip}</span>)}</div>
      <footer><span>{post.meta}</span>{(post.kind === "need" || post.kind === "offer") && <button onClick={onShare}>分享 ↗</button>}</footer>
    </article>
  );
}

function CirclePage({ circle, onSpeak, onProfile }: { circle: (typeof circles)[number]; onSpeak: () => void; onProfile: () => void }) {
  return (
    <>
      <section className={`circle-hero hero-${circle.color}`}><div><Pill>{circle.members} 位成员</Pill><h2>{circle.name}</h2><p>把已经存在的交换连起来。可以给，也可以放心拿。</p></div><div className="coin-badge"><span>{circle.short}</span><small>{circle.currency}</small></div></section>
      <div className="circle-actions"><button onClick={onSpeak}>● 说一句</button><button>邀请成员</button><button>圈子介绍</button></div>
      <section className="balance-panel"><div><span>当前流动额度</span><strong>{circle.balance > 0 ? "+" : ""}{circle.balance}</strong><small>{circle.currency}</small></div><div><span>我给出过</span><strong>48</strong></div><div><span>我收到过</span><strong>20</strong></div></section>
      <SectionTitle title="参考物，不是定价" action="查看规则" onAction={() => undefined} />
      <div className="reference-grid"><div><b>一晚住宿</b><span>大约 10 {circle.currency}</span></div><div><b>一顿家常饭</b><span>大约 4 {circle.currency}</span></div><div><b>半小时小忙</b><span>大约 3 {circle.currency}</span></div></div>
      <SectionTitle title="营地成员" action="全部成员" onAction={onProfile} />
      <div className="member-row">{[["树","修理玩家","green"],["米","饭桌召集人","pink"],["苔","照料伙伴","blue"],["王","住宿搭子","yellow"]].map(([a,b,c]) => <button key={b} onClick={onProfile}><Character text={a} color={c} /><b>{b}</b><small>查看角色卡</small></button>)}</div>
    </>
  );
}

function MePage({ onShare, onCard }: { onShare: () => void; onCard: () => void }) {
  return (
    <>
      <section className="profile-hero"><div className="profile-character"><Character text="俏" color="pink" /><span className="level-tag">LV. 8</span></div><div><p className="eyebrow">跨圈角色卡</p><h2>俏也</h2><p>旅居交换者 · 活动召集人 · 礼物实验者</p></div><button onClick={onShare}>生成分享图</button></section>
      <section className="passport-card"><div><Pill color="blue">社区护照</Pill><h3>12 张好人卡，来自 8 个人</h3><p>“她让人觉得，可以放心开口问。”</p></div><button onClick={onCard}>＋ 发一张卡</button></section>
      <SectionTitle title="我目前所有的需要 / 提供" action="生成分享图" onAction={onShare} />
      <div className="my-board"><div className="my-need"><Pill color="pink">我想要</Pill><h3>寻找下周在泉州的一晚住宿</h3><span>跨圈公开</span></div><div className="my-offer"><Pill color="green">我可以给</Pill><h3>活动设计、咨询，以及一顿随缘的饭</h3><span>3 个圈可见</span></div></div>
      <SectionTitle title="我的圈子" action="创建新圈" onAction={() => undefined} />
      <div className="my-circles">{circles.map((circle) => <div key={circle.id} className={`my-circle my-${circle.color}`}><Character text={circle.short} color={circle.color} small /><span><b>{circle.name}</b><small>{circle.role}</small></span><strong>{circle.balance > 0 ? "+" : ""}{circle.balance}</strong></div>)}</div>
    </>
  );
}

function ShareSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const cells = Array.from({ length: 81 }, (_, index) => (index * 7 + Math.floor(index / 9) * 3) % 5 < 2);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}><section className="sheet share-sheet" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="close-button" onClick={onClose}>×</button><p className="eyebrow">微信群分享图预览</p><div className="share-poster"><div className="poster-top"><Character text="俏" color="pink" /><div><span>旅居交换者 · LV.8</span><h2>俏也的流动清单</h2></div></div><div className="poster-panel poster-need"><b>我目前想要</b><p>下周在泉州的一晚住宿</p><p>有人帮我看一遍新活动文案</p></div><div className="poster-panel poster-offer"><b>我目前可以给</b><p>活动设计和一小时咨询</p><p>一顿随缘的饭，或者陪你散步</p></div><div className="poster-bottom"><div><b>可以问，也可以拒绝。</b><span>来看看我们还能怎样交换</span></div><div className="fake-qr">{cells.map((on, index) => <i key={index} className={on ? "on" : ""} />)}</div></div></div><button className="primary-button" onClick={onDone}>准备好，分享到微信群</button></section></div>
  );
}

function ProfileSheet({ contact, onContact, onClose }: { contact: boolean; onContact: () => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}><section className="sheet profile-sheet" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="close-button" onClick={onClose}>×</button><div className="role-card"><Character text="树" color="green" /><div><Pill color="green">同圈成员</Pill><h2>阿树</h2><p>修理玩家 · 公共空间守护者</p></div><span className="level-box">LV.4</span></div><div className="profile-numbers"><div><b>+16</b><span>当前额度</span></div><div><b>42</b><span>给出过</span></div><div><b>26</b><span>收到过</span></div></div><div className="profile-section"><h3>我可以给</h3><p>修小家电 · 一起研究怎么修 · 看看空间里的奇怪声音</p></div><div className="profile-section card-story"><h3>♥ 好人卡故事</h3><p>“下雨那天他发现厨房漏水，默默修好了，还教会了两个人。”</p><small>苔苔写于 3 天前 · 跨圈公开</small></div>{contact ? <div className="contact-reveal"><span>微信号</span><b>ashu_fixthings</b><button onClick={() => undefined}>复制</button></div> : <button className="primary-button" onClick={onContact}>联系阿树，查看微信号</button>}<p className="soft-note">看到“可以提供”不代表对方必须答应。先问问就好。</p></section></div>
  );
}
