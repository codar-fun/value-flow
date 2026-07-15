"use client";

import { useMemo, useState } from "react";

type View = "feed" | "discover" | "circle" | "me";
type ComposerType = "record" | "need" | "offer" | "card";
type FeedFilter = "all" | "trade" | "need" | "offer" | "card";
type DiscoverFilter = "all" | "need" | "offer" | "nearby";
type Overlay = "share" | "profile" | "intro" | "rules" | "members" | "invite" | "create" | "feedFilter" | "post" | "settings" | null;
type AvatarVariant = "crop" | "wave" | "cap" | "bob" | "spike" | "curl" | "bun" | "leaf";
type Color = "yellow" | "pink" | "blue" | "green" | "coral";

type Member = {
  id: string;
  name: string;
  initial: string;
  role: string;
  color: Color;
  avatar: AvatarVariant;
  balance: number;
  given: number;
  received: number;
  offer: string;
  need: string;
  card: string;
  cardFrom: string;
  wechat: string;
  circles: string[];
};

type Circle = {
  id: string;
  name: string;
  short: string;
  color: Color;
  currency: string;
  balance: number;
  members: number;
  role: string;
  location: string;
  tagline: string;
  intro: string;
  scene: string;
  joining: string;
  invitation: string;
  principles: string[];
  rules: string[];
  references: { name: string; value: string; note: string }[];
  memberIds: string[];
};

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
};

const members: Member[] = [
  { id: "ashu", name: "阿树", initial: "树", role: "修理玩家", color: "green", avatar: "spike", balance: 16, given: 42, received: 26, offer: "修小家电、一起研究怎么修，也愿意听听空间里的奇怪声音。", need: "想借一把冲击钻，周末用半天。", card: "下雨那天他发现厨房漏水，默默修好了，还教会了两个人。", cardFrom: "苔苔", wechat: "ashu_fixthings", circles: ["qiao", "village"] },
  { id: "mili", name: "米粒", initial: "米", role: "饭桌召集人", color: "pink", avatar: "bob", balance: -4, given: 18, received: 22, offer: "做家常饭、组织小饭桌，也可以帮忙看活动文案。", need: "想找人帮忙拍一组饭桌照片。", card: "她总能多摆一副碗筷，让刚来的人自然坐下来。", cardFrom: "俏也", wechat: "milifan_table", circles: ["human", "village"] },
  { id: "taitai", name: "苔苔", initial: "苔", role: "植物照料者", color: "blue", avatar: "leaf", balance: 9, given: 31, received: 22, offer: "照顾植物、辨认野草、一起把阳台变绿。", need: "需要一些闲置花盆和旧木箱。", card: "她离开营地前，为每盆植物都留下了浇水说明。", cardFrom: "小王", wechat: "moss_and_more", circles: ["qiao", "village"] },
  { id: "wang", name: "小王", initial: "王", role: "旅居伙伴", color: "yellow", avatar: "cap", balance: 22, given: 36, received: 14, offer: "厦门和泉州的短住信息，也可以分享旅居避坑经验。", need: "下个月想在杭州借住两晚。", card: "他让借住这件事不像交换，更像回到一个临时的家。", cardFrom: "俏也", wechat: "wang_ontheroad", circles: ["qiao"] },
  { id: "anan", name: "安安", initial: "安", role: "倾听练习者", color: "coral", avatar: "wave", balance: -8, given: 11, received: 19, offer: "一小时专注倾听，也可以陪你梳理一个卡住的问题。", need: "想找人试用一套新的倾听练习卡。", card: "她没有急着给建议，只是把每一句话都接住了。", cardFrom: "北北", wechat: "an_listens", circles: ["human"] },
  { id: "beibei", name: "北北", initial: "北", role: "排版魔法师", color: "blue", avatar: "crop", balance: 13, given: 29, received: 16, offer: "海报排版、资料整理和把复杂的话变得更容易读。", need: "想学会做一顿稳定不翻车的家常饭。", card: "凌晨还在帮大家整理共学手册，但第二天完全没有邀功。", cardFrom: "米粒", wechat: "north_types", circles: ["human", "qiao"] },
  { id: "mumu", name: "木木", initial: "木", role: "木工学徒", color: "green", avatar: "bun", balance: 7, given: 25, received: 18, offer: "修椅子、做简单木架，也欢迎有人一起来学。", need: "需要一辆车运一批旧木料。", card: "他把别人准备丢掉的木板，变成了公共厨房的新架子。", cardFrom: "阿树", wechat: "wood_mumu", circles: ["village"] },
  { id: "xiaoyu", name: "小雨", initial: "雨", role: "照料搭子", color: "pink", avatar: "curl", balance: -2, given: 20, received: 22, offer: "陪诊、临时照看宠物，以及雨天顺路接送。", need: "偶尔需要有人替我遛狗。", card: "她记得每个人的忌口，也记得谁最近可能需要被问候。", cardFrom: "苔苔", wechat: "rainy_care", circles: ["village", "human"] },
  { id: "qiaoye", name: "俏也", initial: "俏", role: "旅居交换者", color: "pink", avatar: "wave", balance: 28, given: 86, received: 58, offer: "活动设计、咨询，以及一顿随缘的饭。", need: "寻找下周在泉州的一晚住宿。", card: "她让人觉得，可以放心开口问。", cardFrom: "阿树", wechat: "qiaoye_flow", circles: ["qiao", "human", "village"] },
];

const circles: Circle[] = [
  {
    id: "qiao", name: "俏也交换圈", short: "俏", color: "pink", currency: "泡泡", balance: 28, members: 18, role: "旅居交换者", location: "跨城 · 熟人邀请",
    tagline: "把旅途中接住过彼此的人，留在同一张交换地图里。",
    intro: "这是一个从俏也真实关系里长出来的小圈子。住宿、活动协作、咨询、吃饭和举手之劳都可以被记录，但不要求每一份善意都折成数字。泡泡只是让帮助继续往别处流动的社区记忆。",
    scene: "适合已经认识、发生过交换，或者由成员认真介绍进来的人。协商仍然在微信和线下发生。",
    joining: "种子期 · 受邀后直接加入",
    invitation: "邀请链接 7 天有效。受邀者确认名字与微信号后即可加入，无需管理员逐个审批。",
    principles: ["没有记录的善意仍然成立", "可以主动开口，也可以自由拒绝", "泡泡不与人民币兑换"],
    rules: ["只记录已经完成的互助，未完成的约定不改变余额。", "任意一方确认即可先入账；另一方之后可以修改或拒绝。", "公开记录对圈内可见；神秘记录隐藏人物和具体故事。", "离开圈子前可下载自己的记录，并选择隐藏跨圈内容。"],
    references: [
      { name: "一晚住宿", value: "约 10 泡泡", note: "根据城市与实际情况协商" },
      { name: "一顿家常饭", value: "约 4 泡泡", note: "食材和做饭都不需要精确计价" },
      { name: "半小时小忙", value: "约 2 泡泡", note: "只是让第一次协商容易一点" },
    ],
    memberIds: ["qiaoye", "ashu", "wang", "taitai", "beibei"],
  },
  {
    id: "human", name: "做人共学", short: "人", color: "yellow", currency: "人类点", balance: -6, members: 32, role: "共学召集人", location: "线上为主 · 管理员审批",
    tagline: "共学不只交换知识，也交换注意力、反馈和被接住的时刻。",
    intro: "做人共学把课程之外的互相帮助留下来：看文案、做设计、陪练习、开一场小工作坊。人类点不是课程费用，也不是贡献排行榜；它只帮助成员发现，自己既可以需要别人，也有东西可以给。",
    scene: "适合本期共学成员和稳定协作者。新成员由现有成员邀请，管理员确认其属于当前共学关系。",
    joining: "扩大期 · 邀请后需管理员审批",
    invitation: "成员可以发出邀请。受邀者会先看到圈子介绍与拒绝权说明，管理员通常在 24 小时内确认。",
    principles: ["不把学习热情变成竞争排名", "反馈也是一种真实劳动", "负余额不是信用污点"],
    rules: ["需要与提供可以跨圈公开，但共学讨论内容默认只在本圈。", "人类点不由付费直接换取，也不能用于课程退款。", "涉及心理、健康与私人经历的互助建议使用神秘记录或不记录。", "连续 90 天未参与不会被惩罚，可以自行暂停或退出。"],
    references: [
      { name: "一次文案反馈", value: "约 3 人类点", note: "通常为 30—45 分钟" },
      { name: "一场技能小课", value: "约 8 人类点", note: "准备成本由双方自行协商" },
      { name: "一小时倾听", value: "约 5 人类点", note: "不等同于专业心理咨询" },
    ],
    memberIds: ["qiaoye", "mili", "anan", "beibei", "xiaoyu"],
  },
  {
    id: "village", name: "龙潭生活营地", short: "村", color: "blue", currency: "饭票", balance: 12, members: 24, role: "临时村民", location: "福建屏南 · 线下常驻",
    tagline: "住在一起的人，用一顿饭、一把工具和一点时间照看共同生活。",
    intro: "龙潭生活营地是一个线下常驻场景。公共厨房、工具、照料、接送和一起做饭是最常发生的互助。饭票不是物业费，也不代表谁更有贡献；它只是让公共生活中的付出不必全靠少数人记住。",
    scene: "适合正在营地居住、近期会到访，或与公共空间有稳定协作关系的人。",
    joining: "种子期 · 现场确认后直接加入",
    invitation: "邀请页会同时说明公共空间边界。访客可加入 30 天体验身份，常驻成员没有必须接待访客的义务。",
    principles: ["公共劳动也值得被看见", "照料信息尽量少记录", "常驻与访客都可以说不"],
    rules: ["公共工具借用先在微信群确认，损坏不自动折算为饭票。", "地址、健康与照料细节不写进公开记录。", "神秘记录只保留互助类型、额度与时间。", "访客身份 30 天后自动暂停，可由本人或管理员延长。"],
    references: [
      { name: "一顿公共饭", value: "约 4 饭票", note: "食材可另行共同分担" },
      { name: "半天工具协作", value: "约 6 饭票", note: "技术难度由当事人商量" },
      { name: "一次接送", value: "约 5 饭票", note: "不含真实发生的油费" },
    ],
    memberIds: ["mili", "ashu", "taitai", "mumu", "xiaoyu"],
  },
];

const posts: Post[] = [
  { id: 1, kind: "offer", badge: "我可以给", person: "阿树", role: "修理玩家", memberId: "ashu", avatar: "树", avatarVariant: "spike", color: "green", text: "这周可以帮忙修小家电，也可以一起研究怎么修。", meta: "俏也交换圈 · 杭州", chips: ["小家电", "一起动手"], circleId: "qiao", nearby: true },
  { id: 2, kind: "need", badge: "我想要", person: "米粒", role: "饭桌召集人", memberId: "mili", avatar: "米", avatarVariant: "bob", color: "pink", text: "周四晚上想找一个人，帮我看看新活动的介绍文案。", meta: "做人共学 · 线上", chips: ["30 分钟", "文案"], circleId: "human" },
  { id: 3, kind: "trade", badge: "互助完成", person: "小王 → 俏也", role: "圈内公开", memberId: "wang", avatar: "王", avatarVariant: "cap", color: "yellow", text: "在厦门借住了一晚。聊天到半夜，第二天一起吃了早饭。", meta: "俏也交换圈 · +10 泡泡", chips: ["住宿", "昨天"], circleId: "qiao" },
  { id: 4, kind: "mystery", badge: "神秘记录", person: "圈里发生了一次互助", role: "身份与故事已隐藏", avatar: "?", avatarVariant: "crop", color: "blue", text: "有人接住了另一个人的需要。知道互助发生过，就已经足够。", meta: "龙潭生活营地 · 8 饭票", chips: ["照料", "3 小时前"], circleId: "village", nearby: true },
  { id: 5, kind: "card", badge: "好人卡", person: "苔苔 → 阿树", role: "跨圈公开", memberId: "taitai", avatar: "苔", avatarVariant: "leaf", color: "coral", text: "下雨那天阿树发现公共厨房漏水，默默修好了，还教会了两个人。", meta: "被看见的第 7 次", chips: ["公共劳动", "谢谢你"], circleId: "village" },
  { id: 6, kind: "offer", badge: "我可以给", person: "安安", role: "倾听练习者", memberId: "anan", avatar: "安", avatarVariant: "wave", color: "green", text: "周末有一个小时，可以陪你把最近卡住的事情慢慢说清楚。", meta: "做人共学 · 线上", chips: ["倾听", "周末"], circleId: "human" },
  { id: 7, kind: "need", badge: "我想要", person: "木木", role: "木工学徒", memberId: "mumu", avatar: "木", avatarVariant: "bun", color: "pink", text: "周六需要一辆车，帮忙把旧木料从镇上运到营地。", meta: "龙潭生活营地 · 屏南", chips: ["顺风车", "周六"], circleId: "village", nearby: true },
];

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

function memberById(id?: string) {
  return members.find((member) => member.id === id) ?? members[0];
}

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
  const [composer, setComposer] = useState(false);
  const [intent, setIntent] = useState<ComposerType>("record");
  const [draft, setDraft] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("ashu");
  const [selectedPostId, setSelectedPostId] = useState(1);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>("all");
  const [toast, setToast] = useState("");

  const activeCircle = circles.find((item) => item.id === circleId) ?? circles[0];
  const selectedMember = memberById(selectedMemberId);
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? posts[0];
  const currentDraft = draftCopy[intent];
  const feedPosts = useMemo(() => posts.filter((post) => {
    if (feedFilter === "all") return true;
    if (feedFilter === "trade") return post.kind === "trade" || post.kind === "mystery";
    return post.kind === feedFilter;
  }), [feedFilter]);
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
    setCircleId(id); setView(nextView);
  }

  function openProfile(id?: string) {
    setSelectedMemberId(id ?? "ashu"); setOverlay("profile");
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
      <div className="brand-mark"><span>流动圈</span><b>FLOW CIRCLE</b></div>
      <div className="dock-heading"><span>我的地图</span><b>03</b></div>
      <div className="dock-list">{circles.map((item) => <button key={item.id} className={`dock-circle dock-${item.color} ${circleId === item.id ? "active" : ""}`} onClick={() => selectCircle(item.id)}><Character text={item.short} color={item.color} variant={item.id === "qiao" ? "wave" : item.id === "human" ? "crop" : "leaf"} small/><span><b>{item.name}</b><small>{item.role}</small></span><strong>{item.balance > 0 ? "+" : ""}{item.balance}</strong></button>)}</div>
      <button className="new-circle" onClick={() => setOverlay("create")}><b>＋</b><span>创建新圈子</span></button>
      <p className="dock-note">三个圈子只是俏也加入的三个社区。每个圈子都有自己的成员、规则和互助额度。</p>
    </aside>

    <section className="phone-stage">
      <div className="app-frame">
        <header className="topbar"><div><p>我的圈子动态</p><h1>早上好，俏也！</h1></div><button className="avatar-button" onClick={() => setView("me")} aria-label="打开我的主页"><Character member={memberById("qiaoye")}/></button></header>
        <nav className="circle-switcher" aria-label="切换圈子">{circles.map((item) => <button key={item.id} className={circleId === item.id ? "selected" : ""} onClick={() => selectCircle(item.id)}><span className={`circle-dot dot-${item.color}`}/><span>{item.name}</span><b>{item.balance > 0 ? "+" : ""}{item.balance}</b></button>)}</nav>
        <div className="view-content">
          {view === "feed" && <FeedView activeCircle={activeCircle} posts={feedPosts} filter={feedFilter} onSpeak={openComposer} onCircle={() => setView("circle")} onMe={() => setView("me")} onProfile={openProfile} onShare={() => setOverlay("share")} onFilter={() => setOverlay("feedFilter")} onPost={openPost}/>}
          {view === "discover" && <DiscoverView posts={discoverPosts} filter={discoverFilter} setFilter={setDiscoverFilter} onSpeak={openComposer} onProfile={openProfile} onShare={() => setOverlay("share")} onPost={openPost}/>}
          {view === "circle" && <CircleView circle={activeCircle} onSpeak={openComposer} onProfile={openProfile} onIntro={() => setOverlay("intro")} onRules={() => setOverlay("rules")} onMembers={() => setOverlay("members")} onInvite={() => setOverlay("invite")}/>}
          {view === "me" && <MeView onShare={() => setOverlay("share")} onCard={() => openComposer("card")} onCreate={() => setOverlay("create")} onSettings={() => setOverlay("settings")} onCircle={(id) => selectCircle(id, "circle")}/>}
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
      <div className="world-card world-card-main"><span className="world-kicker">TODAY IN YOUR CIRCLES</span><h2>今天，圈里有<br/><em>8 件事</em>在流动</h2><div className="world-stats"><span><b>4</b>需要 / 提供</span><span><b>3</b>互助完成</span><span><b>1</b>张好人卡</span></div></div>
      <button className="world-card value-card value-card-button" onClick={() => { setView("circle"); setOverlay("rules"); }}><span className="world-kicker">这个圈怎么估量</span><h3>{activeCircle.name}</h3>{activeCircle.references.slice(0,2).map((item) => <div key={item.name}><b>{item.name}</b><span>{item.value}</span></div>)}<p>只是协商参考，不是统一价格。点击查看完整规则。</p></button>
      <div className="world-rule"><b>可以问，<br/>也可以拒绝。</b><span>NO PRESSURE · NO RANKING</span></div>
    </aside>

    {composer && <ComposerSheet intent={intent} setIntent={(next) => { setIntent(next); setDraft(false); }} draft={draft} setDraft={setDraft} currentDraft={currentDraft} onClose={() => setComposer(false)} onConfirm={confirmDraft} onNotice={flash}/>}
    {overlay === "share" && <ShareSheet onClose={() => setOverlay(null)} onDone={() => { setOverlay(null); flash("分享图已准备好，可以发到微信群"); }}/>}
    {overlay === "profile" && <ProfileSheet member={selectedMember} onClose={() => setOverlay(null)} onNotice={flash}/>}
    {overlay === "intro" && <CircleIntroSheet circle={activeCircle} onRules={() => setOverlay("rules")} onInvite={() => setOverlay("invite")} onClose={() => setOverlay(null)}/>}
    {overlay === "rules" && <RulesSheet circle={activeCircle} onClose={() => setOverlay(null)}/>}
    {overlay === "members" && <MembersSheet circle={activeCircle} onProfile={openProfile} onInvite={() => setOverlay("invite")} onClose={() => setOverlay(null)}/>}
    {overlay === "invite" && <InviteSheet circle={activeCircle} onClose={() => setOverlay(null)} onNotice={flash}/>}
    {overlay === "create" && <CreateCircleSheet onClose={() => setOverlay(null)} onDone={() => { setOverlay(null); flash("新圈草稿已保存，这是静态演示，不会真的创建"); }}/>}
    {overlay === "feedFilter" && <FeedFilterSheet active={feedFilter} onSelect={(next) => { setFeedFilter(next); setOverlay(null); }} onClose={() => setOverlay(null)}/>}
    {overlay === "post" && <PostSheet post={selectedPost} onProfile={() => selectedPost.memberId && openProfile(selectedPost.memberId)} onShare={() => setOverlay("share")} onClose={() => setOverlay(null)}/>}
    {overlay === "settings" && <SettingsSheet onClose={() => setOverlay(null)} onNotice={flash}/>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}

function AgentHero({ onSpeak }: { onSpeak: (intent?: ComposerType) => void }) {
  return <section className="agent-hero"><div className="hero-decor decor-grid"/><div className="hero-decor decor-square"/><div className="hero-decor decor-circle"/><div className="agent-orb"><i className="agent-antenna"/><span>◕‿◕</span><b>泡泡助手</b></div><div className="agent-copy"><Pill color="cream">在线 · ONLINE</Pill><h2>说一句，<br/>让互助流动起来。</h2><p>我会帮你整理成可检查、可修改的草稿。</p></div><button className="speak-button" onClick={() => onSpeak()}><span>●</span><b>说一句</b><small>交易 · 需要 · 提供 · 好人卡</small></button></section>;
}

function FeedView({ activeCircle, posts: list, filter, onSpeak, onCircle, onMe, onProfile, onShare, onFilter, onPost }: { activeCircle: Circle; posts: Post[]; filter: FeedFilter; onSpeak: (intent?: ComposerType) => void; onCircle: () => void; onMe: () => void; onProfile: (id?: string) => void; onShare: () => void; onFilter: () => void; onPost: (id: number) => void }) {
  const labels: Record<FeedFilter,string> = { all: "全部动态", trade: "互助记录", need: "只看需要", offer: "只看提供", card: "好人卡" };
  return <><AgentHero onSpeak={onSpeak}/><section className="stats-grid" aria-label="当前圈子概览"><button className="stat-card stat-yellow" onClick={onCircle}><span>当前额度</span><strong>{activeCircle.balance > 0 ? "+" : ""}{activeCircle.balance}</strong><small>{activeCircle.currency} · {activeCircle.name}</small></button><button className="stat-card stat-pink" onClick={onMe}><span>我给出过</span><strong>86</strong><small>不是排名，是记忆</small></button><button className="stat-card stat-blue" onClick={() => onProfile("qiaoye")}><span>好人卡</span><strong>12</strong><small>跨圈跟着我</small></button></section><SectionTitle eyebrow="LIVE FROM THE CIRCLE" title={labels[filter]} action={`筛选 · ${list.length}`} onAction={onFilter}/><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>;
}

function DiscoverView({ posts: list, filter, setFilter, onSpeak, onProfile, onShare, onPost }: { posts: Post[]; filter: DiscoverFilter; setFilter: (filter: DiscoverFilter) => void; onSpeak: (intent?: ComposerType) => void; onProfile: (id?: string) => void; onShare: () => void; onPost: (id: number) => void }) {
  const options: {id: DiscoverFilter; label: string}[] = [{id:"all",label:"全部"},{id:"need",label:"我想要"},{id:"offer",label:"我可以给"},{id:"nearby",label:"附近"}];
  return <><section className="page-hero discover-hero"><div><Pill color="pink">跨圈发现</Pill><h2>有人在寻找，<br/>也有人正好可以给。</h2><p>看到“可以提供”，不代表对方必须答应。先问问就好。</p></div><button onClick={() => onSpeak("need")}>＋ 发布</button></section><div className="filter-row" aria-label="发现筛选">{options.map((item) => <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div><p className="result-note">找到 {list.length} 条仍然有效的内容</p><FeedList posts={list} onProfile={onProfile} onShare={onShare} onPost={onPost}/></>;
}

function CircleView({ circle, onSpeak, onProfile, onIntro, onRules, onMembers, onInvite }: { circle: Circle; onSpeak: (intent?: ComposerType) => void; onProfile: (id?: string) => void; onIntro: () => void; onRules: () => void; onMembers: () => void; onInvite: () => void }) {
  return <><section className={`page-hero circle-hero hero-${circle.color}`}><div><Pill color="cream">我的营地 · {circle.location}</Pill><h2>{circle.name}</h2><p>{circle.tagline}</p></div><div className="coin-badge"><span>{circle.balance > 0 ? "+" : ""}{circle.balance}</span><small>{circle.currency}</small></div></section><div className="circle-actions"><button onClick={() => onSpeak()}>● 说一句</button><button onClick={onInvite}>邀请成员</button><button onClick={onIntro}>圈子介绍</button></div><button className="camp-preview" onClick={onIntro}><span className={`camp-flag flag-${circle.color}`}>{circle.short}</span><div><small>CAMP PROFILE</small><h3>{circle.tagline}</h3><p>{circle.joining} · {circle.members} 位成员</p></div><b>进入介绍 →</b></button><section className="balance-panel"><div><span>当前额度</span><strong>{circle.balance > 0 ? "+" : ""}{circle.balance}</strong><small>我在这个圈的流动额度</small></div><div><span>给出过</span><strong>42</strong><small>来自真实互助</small></div><div><span>收到过</span><strong>14</strong><small>接受帮助也很好</small></div></section><SectionTitle eyebrow="REFERENCE" title="圈内参考物" action="查看规则" onAction={onRules}/><div className="reference-grid">{circle.references.map((item) => <button key={item.name} onClick={onRules}><b>{item.name}</b><span>{item.value}</span></button>)}</div><SectionTitle eyebrow="PEOPLE" title="最近活跃的成员" action="全部成员" onAction={onMembers}/><div className="member-row">{circle.memberIds.slice(0,4).map((id) => { const member = memberById(id); return <button key={member.id} onClick={() => onProfile(member.id)}><Character member={member} small/><b>{member.name}</b><small>{member.role}</small></button>; })}</div></>;
}

function MeView({ onShare, onCard, onCreate, onSettings, onCircle }: { onShare: () => void; onCard: () => void; onCreate: () => void; onSettings: () => void; onCircle: (id: string) => void }) {
  const me = memberById("qiaoye");
  return <><section className="profile-hero"><Character member={me}/><div><Pill color="cream">跨圈角色卡</Pill><h2>俏也</h2><p>旅居交换者 · 活动召集人 · 礼物实验者</p></div><button onClick={onShare}>生成分享图</button></section><section className="passport-card"><div><span>COMMUNITY PASSPORT</span><h3>12 张好人卡，来自 8 个人</h3><p>“她让人觉得，可以放心开口问。”</p></div><button onClick={onCard}>＋ 发一张卡</button></section><SectionTitle eyebrow="OPEN NOW" title="我目前的需要 / 提供" action="公开设置" onAction={onSettings}/><div className="my-board"><button className="my-need" onClick={onShare}><Pill color="pink">我想要</Pill><h3>寻找下周在泉州的一晚住宿</h3><span>跨圈公开 · 点击分享</span></button><button className="my-offer" onClick={onShare}><Pill color="green">我可以给</Pill><h3>活动设计、咨询，以及一顿随缘的饭</h3><span>3 个圈可见 · 点击分享</span></button></div><SectionTitle eyebrow="MY CIRCLES" title="我的圈子" action="创建新圈" onAction={onCreate}/><div className="my-circles">{circles.map((circle) => <button className="my-circle" key={circle.id} onClick={() => onCircle(circle.id)}><Character text={circle.short} color={circle.color} variant={circle.id === "qiao" ? "wave" : circle.id === "human" ? "crop" : "leaf"} small/><span><b>{circle.name}</b><small>{circle.role} · {circle.members} 人</small></span><strong>{circle.balance > 0 ? "+" : ""}{circle.balance}</strong></button>)}</div></>;
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
  return <Modal onClose={onClose} label="分享图预览"><span className="sheet-kicker">微信群分享图预览</span><div className="share-poster"><div className="poster-top"><Character member={memberById("qiaoye")}/><div><span>旅居交换者</span><h2>俏也的流动清单</h2></div></div><div className="poster-panel poster-need"><b>我目前想要</b><p>下周在泉州的一晚住宿</p><p>有人帮我看一遍新活动文案</p></div><div className="poster-panel poster-offer"><b>我目前可以给</b><p>活动设计和一小时咨询</p><p>一顿随缘的饭，或者陪你散步</p></div><div className="poster-bottom"><div><b>可以问，也可以拒绝。</b><span>来看看我们还能怎样交换</span></div><div className="fake-qr">{cells.map((on,index) => <i key={index} className={on ? "on" : ""}/>)}</div></div></div><button className="primary-button" onClick={onDone}>准备好，分享到微信群</button></Modal>;
}

function ProfileSheet({ member, onClose, onNotice }: { member: Member; onClose: () => void; onNotice: (message: string) => void }) {
  const [contact, setContact] = useState(false);
  return <Modal onClose={onClose} label={`${member.name}的成员主页`}><div className={`role-card role-${member.color}`}><Character member={member}/><div><Pill color="cream">同圈成员 · {member.circles.length} 个圈</Pill><h2>{member.name}</h2><p>{member.role}</p></div></div><div className="profile-numbers"><div><b>{member.balance > 0 ? "+" : ""}{member.balance}</b><span>当前额度</span></div><div><b>{member.given}</b><span>给出过</span></div><div><b>{member.received}</b><span>收到过</span></div></div><div className="profile-section"><h3>我可以给</h3><p>{member.offer}</p></div><div className="profile-section profile-need"><h3>我最近想要</h3><p>{member.need}</p></div><div className="profile-section card-story"><h3>好人卡故事</h3><p>“{member.card}”</p><small>{member.cardFrom} 写下 · 跨圈公开</small></div>{contact ? <div className="contact-reveal"><span>微信号</span><b>{member.wechat}</b><button onClick={() => onNotice("微信号已复制（静态演示）")}>复制</button></div> : <button className="primary-button" onClick={() => setContact(true)}>联系{member.name}，查看微信号</button>}<p className="soft-note">看到“可以提供”不代表对方必须答应。先问问就好。</p></Modal>;
}

function CircleIntroSheet({ circle, onRules, onInvite, onClose }: { circle: Circle; onRules: () => void; onInvite: () => void; onClose: () => void }) {
  return <Modal onClose={onClose} label={`${circle.name}圈子介绍`} wide><header className={`detail-hero hero-${circle.color}`}><span className="camp-number">CAMP / 0{circles.findIndex((item) => item.id === circle.id) + 1}</span><div className={`camp-flag flag-${circle.color}`}>{circle.short}</div><h2>{circle.name}</h2><p>{circle.tagline}</p><small>{circle.location} · {circle.members} 位成员</small></header><div className="detail-grid"><section><span className="detail-label">为什么有这个圈子</span><p>{circle.intro}</p></section><section><span className="detail-label">适合谁</span><p>{circle.scene}</p></section></div><section className="principle-board"><span className="detail-label">营地约定</span>{circle.principles.map((item,index) => <div key={item}><b>0{index+1}</b><p>{item}</p></div>)}</section><section className="join-card"><div><span>加入方式</span><h3>{circle.joining}</h3><p>{circle.invitation}</p></div><div className="join-actions"><button className="secondary-button" onClick={onRules}>查看完整规则</button><button className="primary-button" onClick={onInvite}>邀请一个人</button></div></section></Modal>;
}

function RulesSheet({ circle, onClose }: { circle: Circle; onClose: () => void }) {
  return <Modal onClose={onClose} label={`${circle.name}规则与参考物`} wide><div className="sheet-heading"><Pill color={circle.color}>规则不是惩罚</Pill><h2>{circle.name}怎么一起运行</h2><p>这些约定帮助大家更容易协商、拒绝、纠错和离开。它们不会把善意变成统一价格。</p></div><section className="rule-list">{circle.rules.map((rule,index) => <div key={rule}><b>{String(index+1).padStart(2,"0")}</b><p>{rule}</p></div>)}</section><SectionTitle eyebrow="REFERENCE OBJECTS" title="参考物，不是价格表"/><div className="reference-detail-grid">{circle.references.map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}</div><div className="boundary-card"><b>始终可以不记录</b><p>健康、住址、照料责任和经济困难等敏感信息，默认不进入公开动态。任何人都可以拒绝具体请求，也可以暂停或退出圈子。</p></div></Modal>;
}

function MembersSheet({ circle, onProfile, onInvite, onClose }: { circle: Circle; onProfile: (id?: string) => void; onInvite: () => void; onClose: () => void }) {
  const circleMembers = circle.memberIds.map((id) => memberById(id));
  return <Modal onClose={onClose} label={`${circle.name}全部成员`} wide><div className="sheet-heading member-heading"><Pill color={circle.color}>{circle.members} 位成员</Pill><h2>{circle.name}的成员地图</h2><p>这里展示的是最近活跃的角色。点击任意成员，可以看到对方愿意公开的需要、提供、好人卡与联系方式。</p></div><div className="member-list">{circleMembers.map((member,index) => <button key={member.id} onClick={() => onProfile(member.id)}><span className="member-index">0{index+1}</span><Character member={member}/><span><b>{member.name}</b><small>{member.role}</small><p>{member.offer}</p></span><strong>{member.balance > 0 ? "+" : ""}{member.balance}</strong></button>)}</div><button className="primary-button" onClick={onInvite}>＋ 邀请一位新成员</button></Modal>;
}

function InviteSheet({ circle, onClose, onNotice }: { circle: Circle; onClose: () => void; onNotice: (message: string) => void }) {
  const [method, setMethod] = useState<"link" | "poster">("link");
  return <Modal onClose={onClose} label={`邀请加入${circle.name}`}><div className="sheet-heading"><Pill color={circle.color}>{circle.joining}</Pill><h2>邀请一个认识的人，加入 {circle.name}</h2><p>{circle.invitation}</p></div><div className="invite-tabs"><button className={method === "link" ? "active" : ""} onClick={() => setMethod("link")}>邀请链接</button><button className={method === "poster" ? "active" : ""} onClick={() => setMethod("poster")}>微信邀请图</button></div>{method === "link" ? <div className="invite-link"><span>7 天有效 · 仅可使用 1 次</span><b>flow-circle.site/join/{circle.id}-7K2</b><button onClick={() => onNotice("邀请链接已复制（静态演示）")}>复制链接</button></div> : <div className={`mini-invite-poster hero-${circle.color}`}><div className={`camp-flag flag-${circle.color}`}>{circle.short}</div><span>来自俏也的邀请</span><h3>来 {circle.name}<br/>看看我们还能怎样互相帮助</h3><p>可以问，也可以拒绝。</p><div className="mini-code">▦</div></div>}<div className="invite-checklist"><b>受邀者会先看到</b><span>✓ 圈子介绍与运行方式</span><span>✓ 什么会被记录、谁能看见</span><span>✓ 可以拒绝具体请求，也可以退出</span></div><button className="primary-button" onClick={() => onNotice(method === "link" ? "邀请链接已发到微信（静态演示）" : "邀请图已准备好（静态演示）")}>{method === "link" ? "发到微信" : "保存邀请图"}</button></Modal>;
}

function CreateCircleSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState("direct");
  return <Modal onClose={onClose} label="创建新圈子"><div className="sheet-heading"><Pill color="green">任何人都可以创建</Pill><h2>先为新营地写一张清楚的介绍</h2><p>圈子不是一种新产品，而是一个独立的成员、规则和互助额度边界。</p></div><div className="form-stack"><label><span>圈子名称</span><input defaultValue="周末手作营地"/></label><label><span>互助额度叫什么</span><input defaultValue="木屑"/></label><label><span>一句话介绍</span><textarea defaultValue="一起做东西，也一起把工具、经验和时间分享出来。"/></label></div><span className="form-label">新成员怎么加入</span><div className="choice-grid"><button className={mode === "direct" ? "active" : ""} onClick={() => setMode("direct")}><b>种子期</b><small>受邀后直接加入</small></button><button className={mode === "approval" ? "active" : ""} onClick={() => setMode("approval")}><b>扩大期</b><small>邀请后管理员审批</small></button></div><p className="soft-note">创建后仍可补充多个参考物、隐私边界和退出规则。</p><button className="primary-button" onClick={onDone}>保存圈子草稿</button></Modal>;
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
  return <Modal onClose={onClose} label="动态详情"><div className={`post-detail detail-${post.color}`}><div className="post-detail-head"><Character text={post.avatar} color={post.color} variant={post.avatarVariant}/><div><Pill color="cream">{post.badge}</Pill><h2>{post.person}</h2><p>{post.role}</p></div></div><p className="post-detail-copy">{post.text}</p><div className="chip-row">{post.chips.map((chip) => <span key={chip}>#{chip}</span>)}</div></div><div className="detail-meta"><div><span>发生在哪里</span><b>{circle.name}</b></div><div><span>可见范围</span><b>{post.kind === "mystery" ? "圈内神秘记录" : post.kind === "card" ? "跨圈公开" : "相关圈子"}</b></div><div><span>下一步</span><b>{post.kind === "need" || post.kind === "offer" ? "进入主页后微信联系" : "可以修改或拒绝"}</b></div></div><div className="sheet-actions">{post.memberId ? <button className="secondary-button" onClick={onProfile}>查看成员主页</button> : <button className="secondary-button" onClick={onClose}>知道了</button>}<button className="primary-button" onClick={onShare}>生成分享图</button></div></Modal>;
}

function SettingsSheet({ onClose, onNotice }: { onClose: () => void; onNotice: (message: string) => void }) {
  const [cards, setCards] = useState(true); const [needs, setNeeds] = useState(true); const [hidden, setHidden] = useState(false);
  return <Modal onClose={onClose} label="跨圈公开设置"><div className="sheet-heading"><Pill color="blue">我的公开边界</Pill><h2>哪些内容跟着我跨圈出现</h2><p>圈内余额和交易不会自动跨圈。你也可以随时隐藏某一张好人卡或一条帖子。</p></div><div className="toggle-list"><label><span><b>未隐藏的好人卡</b><small>让具体的感谢故事跟着我</small></span><input type="checkbox" checked={cards} onChange={(event) => setCards(event.target.checked)}/></label><label><span><b>标记为跨圈的需要 / 提供</b><small>只有我主动选择的内容会出现</small></span><input type="checkbox" checked={needs} onChange={(event) => setNeeds(event.target.checked)}/></label><label><span><b>隐藏内容也仅自己可见</b><small>关闭后仍不会对其他成员公开</small></span><input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)}/></label></div><button className="primary-button" onClick={() => { onNotice("公开设置已更新（静态演示）"); onClose(); }}>保存设置</button></Modal>;
}
