export type AvatarVariant = "crop" | "wave" | "cap" | "bob" | "spike" | "curl" | "bun" | "leaf";
export type Color = "yellow" | "pink" | "blue" | "green" | "coral";

export type Member = {
  id: string;
  name: string;
  initial: string;
  role: string;
  color: Color;
  avatar: AvatarVariant;
  bio: string;
  wechat: string;
  circleIds: string[];
};

export type Circle = {
  id: string;
  name: string;
  short: string;
  color: Color;
  currency: string;
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
  nearby?: boolean;
};

export type GoodCard = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  story: string;
  date: string;
  tags: string[];
  visibility: "cross-circle" | "hidden";
  circleId: string;
};

export type Transaction = {
  id: string;
  circleId: string;
  providerId: string;
  receiverId: string;
  amount: number;
  title: string;
  story: string;
  happenedAt: string;
  recordedAt: string;
  visibility: "public" | "mystery" | "private";
  status: "confirmed" | "corrected" | "rejected";
  tags: string[];
};

export type ActivityReference = {
  id: number;
  source: "listing" | "card" | "transaction";
  sourceId: string;
};

const members: Member[] = [
  { id: "ashu", name: "阿树", initial: "树", role: "修理玩家", color: "green", avatar: "spike", bio: "喜欢把坏掉的东西拆开，也喜欢让第一次动手的人一起参与。", wechat: "ashu_fixthings", circleIds: ["qiao", "village"] },
  { id: "mili", name: "米粒", initial: "米", role: "饭桌召集人", color: "pink", avatar: "bob", bio: "常常多摆一副碗筷，相信一起吃饭是最轻的社区入口。", wechat: "milifan_table", circleIds: ["human", "village"] },
  { id: "taitai", name: "苔苔", initial: "苔", role: "植物照料者", color: "blue", avatar: "leaf", bio: "照顾植物，也照顾那些容易被公共生活忘记的小事。", wechat: "moss_and_more", circleIds: ["qiao", "village"] },
  { id: "wang", name: "小王", initial: "王", role: "旅居伙伴", color: "yellow", avatar: "cap", bio: "在厦门和泉州之间移动，愿意分享短住信息与旅居经验。", wechat: "wang_ontheroad", circleIds: ["qiao"] },
  { id: "anan", name: "安安", initial: "安", role: "倾听练习者", color: "coral", avatar: "wave", bio: "练习在急着给建议之前，先把一个人的话完整接住。", wechat: "an_listens", circleIds: ["human"] },
  { id: "beibei", name: "北北", initial: "北", role: "排版魔法师", color: "blue", avatar: "crop", bio: "把复杂的话整理得更容易读，也在练习不把自己困在屏幕前。", wechat: "north_types", circleIds: ["human", "qiao"] },
  { id: "mumu", name: "木木", initial: "木", role: "木工学徒", color: "green", avatar: "bun", bio: "喜欢旧木头、简单结构，以及一群人一起把公共空间修得更好。", wechat: "wood_mumu", circleIds: ["village"] },
  { id: "xiaoyu", name: "小雨", initial: "雨", role: "照料搭子", color: "pink", avatar: "curl", bio: "陪诊、照看宠物，也记得谁最近可能需要被问候。", wechat: "rainy_care", circleIds: ["village", "human"] },
  { id: "qiaoye", name: "俏也", initial: "俏", role: "旅居交换者", color: "pink", avatar: "wave", bio: "活动召集人、礼物实验者，想让曾经接住彼此的人继续相遇。", wechat: "qiaoye_flow", circleIds: ["qiao", "human", "village"] },
];

const circles: Circle[] = [
  { id: "qiao", name: "俏也交换圈", short: "俏", color: "pink", currency: "泡泡", members: 18, role: "旅居交换者", location: "跨城 · 熟人邀请", tagline: "把旅途中接住过彼此的人，留在同一张交换地图里。", intro: "这是一个从俏也真实关系里长出来的小圈子。住宿、活动协作、咨询、吃饭和举手之劳都可以被记录，但不要求每一份善意都折成数字。泡泡只是让帮助继续往别处流动的社区记忆。", scene: "适合已经认识、发生过交换，或者由成员认真介绍进来的人。协商仍然在微信和线下发生。", joining: "种子期 · 受邀后直接加入", invitation: "邀请链接 7 天有效。受邀者确认名字与微信号后即可加入，无需管理员逐个审批。", principles: ["没有记录的善意仍然成立", "可以主动开口，也可以自由拒绝", "泡泡不与人民币兑换"], rules: ["只记录已经完成的互助，未完成的约定不改变余额。", "任意一方确认即可先入账；另一方之后可以修改或拒绝。", "公开记录对圈内可见；神秘记录隐藏人物和具体故事。", "离开圈子前可下载自己的记录，并选择隐藏跨圈内容。"], references: [{ name: "一晚住宿", value: "约 10 泡泡", note: "根据城市与实际情况协商" }, { name: "一顿家常饭", value: "约 4 泡泡", note: "食材和做饭都不需要精确计价" }, { name: "半小时小忙", value: "约 2 泡泡", note: "只是让第一次协商容易一点" }], memberIds: ["qiaoye", "ashu", "wang", "taitai", "beibei"] },
  { id: "human", name: "做人共学", short: "人", color: "yellow", currency: "人类点", members: 32, role: "共学召集人", location: "线上为主 · 管理员审批", tagline: "共学不只交换知识，也交换注意力、反馈和被接住的时刻。", intro: "做人共学把课程之外的互相帮助留下来：看文案、做设计、陪练习、开一场小工作坊。人类点不是课程费用，也不是贡献排行榜；它只帮助成员发现，自己既可以需要别人，也有东西可以给。", scene: "适合本期共学成员和稳定协作者。新成员由现有成员邀请，管理员确认其属于当前共学关系。", joining: "扩大期 · 邀请后需管理员审批", invitation: "成员可以发出邀请。受邀者会先看到圈子介绍与拒绝权说明，管理员通常在 24 小时内确认。", principles: ["不把学习热情变成竞争排名", "反馈也是一种真实劳动", "负余额不是信用污点"], rules: ["需要与提供可以跨圈公开，但共学讨论内容默认只在本圈。", "人类点不由付费直接换取，也不能用于课程退款。", "涉及心理、健康与私人经历的互助建议使用神秘记录或不记录。", "连续 90 天未参与不会被惩罚，可以自行暂停或退出。"], references: [{ name: "一次文案反馈", value: "约 3 人类点", note: "通常为 30—45 分钟" }, { name: "一场技能小课", value: "约 8 人类点", note: "准备成本由双方自行协商" }, { name: "一小时倾听", value: "约 5 人类点", note: "不等同于专业心理咨询" }], memberIds: ["qiaoye", "mili", "anan", "beibei", "xiaoyu"] },
  { id: "village", name: "龙潭生活营地", short: "村", color: "blue", currency: "饭票", members: 24, role: "临时村民", location: "福建屏南 · 线下常驻", tagline: "住在一起的人，用一顿饭、一把工具和一点时间照看共同生活。", intro: "龙潭生活营地是一个线下常驻场景。公共厨房、工具、照料、接送和一起做饭是最常发生的互助。饭票不是物业费，也不代表谁更有贡献；它只是让公共生活中的付出不必全靠少数人记住。", scene: "适合正在营地居住、近期会到访，或与公共空间有稳定协作关系的人。", joining: "种子期 · 现场确认后直接加入", invitation: "邀请页会同时说明公共空间边界。访客可加入 30 天体验身份，常驻成员没有必须接待访客的义务。", principles: ["公共劳动也值得被看见", "照料信息尽量少记录", "常驻与访客都可以说不"], rules: ["公共工具借用先在微信群确认，损坏不自动折算为饭票。", "地址、健康与照料细节不写进公开记录。", "神秘记录只保留互助类型、额度与时间。", "访客身份 30 天后自动暂停，可由本人或管理员延长。"], references: [{ name: "一顿公共饭", value: "约 4 饭票", note: "食材可另行共同分担" }, { name: "半天工具协作", value: "约 6 饭票", note: "技术难度由当事人商量" }, { name: "一次接送", value: "约 5 饭票", note: "不含真实发生的油费" }], memberIds: ["mili", "ashu", "taitai", "mumu", "xiaoyu"] },
];

const accounts: CircleAccount[] = [
  { memberId: "qiaoye", circleId: "qiao", balance: 28, given: 86, received: 58 }, { memberId: "qiaoye", circleId: "human", balance: -6, given: 24, received: 30 }, { memberId: "qiaoye", circleId: "village", balance: 12, given: 26, received: 14 },
  { memberId: "ashu", circleId: "qiao", balance: 16, given: 42, received: 26 }, { memberId: "ashu", circleId: "village", balance: 7, given: 19, received: 12 },
  { memberId: "mili", circleId: "human", balance: -4, given: 18, received: 22 }, { memberId: "mili", circleId: "village", balance: 5, given: 17, received: 12 },
  { memberId: "taitai", circleId: "qiao", balance: 9, given: 31, received: 22 }, { memberId: "taitai", circleId: "village", balance: 3, given: 15, received: 12 },
  { memberId: "wang", circleId: "qiao", balance: 22, given: 36, received: 14 }, { memberId: "anan", circleId: "human", balance: -8, given: 11, received: 19 },
  { memberId: "beibei", circleId: "human", balance: 13, given: 29, received: 16 }, { memberId: "beibei", circleId: "qiao", balance: 2, given: 8, received: 6 },
  { memberId: "mumu", circleId: "village", balance: 7, given: 25, received: 18 }, { memberId: "xiaoyu", circleId: "village", balance: -2, given: 20, received: 22 }, { memberId: "xiaoyu", circleId: "human", balance: 4, given: 12, received: 8 },
];

const listings: Listing[] = [
  { id: "l-ashu-offer", memberId: "ashu", type: "offer", title: "一起修小家电", detail: "这周可以帮忙修小家电，也可以一起研究怎么修。", circleIds: ["qiao", "village"], visibility: "cross-circle", location: "杭州", time: "本周三至周日", reference: "约 2—5 泡泡", tags: ["小家电", "一起动手"], status: "active", createdAt: "7 月 15 日", nearby: true },
  { id: "l-ashu-need", memberId: "ashu", type: "need", title: "借一把冲击钻", detail: "周末做公共书架，想借一把冲击钻用半天。", circleIds: ["village"], visibility: "circle", location: "龙潭营地", time: "本周六", reference: "可交换修理帮助", tags: ["借工具", "周六"], status: "active", createdAt: "7 月 14 日", nearby: true },
  { id: "l-mili-need", memberId: "mili", type: "need", title: "帮我看看活动文案", detail: "周四晚上想找一个人，帮我看看新活动的介绍文案。", circleIds: ["human"], visibility: "cross-circle", location: "线上", time: "周四晚上", reference: "约 3 人类点", tags: ["30 分钟", "文案"], status: "active", createdAt: "7 月 15 日" },
  { id: "l-mili-offer", memberId: "mili", type: "offer", title: "一起吃一顿家常饭", detail: "周日会多做两人份晚饭，刚到营地的人可以来坐坐。", circleIds: ["village"], visibility: "circle", location: "公共厨房", time: "周日 18:30", reference: "不用记录也可以", tags: ["饭桌", "新朋友"], status: "active", createdAt: "7 月 13 日", nearby: true },
  { id: "l-taitai-offer", memberId: "taitai", type: "offer", title: "阳台植物急救", detail: "可以帮忙看看叶子发黄、烂根和不知道该放哪里的问题。", circleIds: ["qiao", "village"], visibility: "cross-circle", location: "线上 / 屏南", time: "七月有效", reference: "不设参考额度", tags: ["植物", "线上"], status: "active", createdAt: "7 月 9 日" },
  { id: "l-taitai-need", memberId: "taitai", type: "need", title: "收一些闲置花盆", detail: "营地最近多了几株植物，需要旧花盆和木箱，不必是新的。", circleIds: ["village"], visibility: "circle", location: "龙潭营地", time: "长期", reference: "物资分享", tags: ["花盆", "旧物"], status: "active", createdAt: "7 月 11 日", nearby: true },
  { id: "l-wang-offer", memberId: "wang", type: "offer", title: "厦门短住信息包", detail: "整理了三个适合短住的区域和一些靠谱联系人，可以语音分享。", circleIds: ["qiao"], visibility: "cross-circle", location: "线上", time: "随时留言", reference: "约 2 泡泡", tags: ["厦门", "旅居"], status: "active", createdAt: "7 月 8 日" },
  { id: "l-wang-need", memberId: "wang", type: "need", title: "杭州借住两晚", detail: "下个月去杭州参加活动，想找一张沙发住两晚，也可以帮忙做饭。", circleIds: ["qiao"], visibility: "cross-circle", location: "杭州", time: "8 月 10—12 日", reference: "约 18 泡泡", tags: ["住宿", "杭州"], status: "paused", createdAt: "7 月 2 日" },
  { id: "l-anan-offer", memberId: "anan", type: "offer", title: "一小时慢慢说", detail: "周末有一个小时，可以陪你把最近卡住的事情慢慢说清楚。", circleIds: ["human"], visibility: "circle", location: "线上", time: "本周末", reference: "约 5 人类点", tags: ["倾听", "周末"], status: "active", createdAt: "7 月 15 日" },
  { id: "l-beibei-offer", memberId: "beibei", type: "offer", title: "把复杂资料排清楚", detail: "可以帮忙整理一份 10 页以内的手册或活动说明。", circleIds: ["human", "qiao"], visibility: "cross-circle", location: "线上", time: "七月底前", reference: "约 6 人类点", tags: ["排版", "资料整理"], status: "active", createdAt: "7 月 12 日" },
  { id: "l-mumu-need", memberId: "mumu", type: "need", title: "运一批旧木料", detail: "周六需要一辆车，帮忙把旧木料从镇上运到营地。", circleIds: ["village"], visibility: "circle", location: "屏南县城 → 龙潭", time: "周六上午", reference: "约 5 饭票", tags: ["顺风车", "周六"], status: "active", createdAt: "7 月 15 日", nearby: true },
  { id: "l-mumu-offer", memberId: "mumu", type: "offer", title: "一起做一个小木架", detail: "有两块多余木板，可以带一位完全没做过木工的人一起做。", circleIds: ["village"], visibility: "circle", location: "营地工坊", time: "下周二下午", reference: "约 6 饭票", tags: ["木工", "一起学"], status: "active", createdAt: "7 月 10 日", nearby: true },
  { id: "l-xiaoyu-offer", memberId: "xiaoyu", type: "offer", title: "雨天顺路接送", detail: "下雨时如果我正好进城，可以顺路带一到两个人。", circleIds: ["village"], visibility: "circle", location: "龙潭 ↔ 县城", time: "看天气", reference: "约 5 饭票", tags: ["接送", "雨天"], status: "active", createdAt: "7 月 6 日", nearby: true },
  { id: "l-qiaoye-need", memberId: "qiaoye", type: "need", title: "泉州的一晚住宿", detail: "下周在泉州停留一晚，想找一个可以睡觉、也可以一起聊天的地方。", circleIds: ["qiao"], visibility: "cross-circle", location: "泉州", time: "7 月 23 日", reference: "约 10 泡泡", tags: ["住宿", "泉州"], status: "active", createdAt: "7 月 15 日" },
  { id: "l-qiaoye-offer", memberId: "qiaoye", type: "offer", title: "活动设计与一小时咨询", detail: "可以一起拆一个活动、项目或最近想不明白的问题。", circleIds: ["qiao", "human", "village"], visibility: "cross-circle", location: "线上 / 旅途中", time: "七月还有 3 个空档", reference: "各圈自行协商", tags: ["活动设计", "咨询"], status: "active", createdAt: "7 月 14 日" },
];

const goodCards: GoodCard[] = [
  { id: "c-taitai-ashu", fromMemberId: "taitai", toMemberId: "ashu", story: "下雨那天阿树发现公共厨房漏水，默默修好了，还教会了两个人。", date: "7 月 12 日", tags: ["公共劳动", "教会别人"], visibility: "cross-circle", circleId: "village" },
  { id: "c-qiaoye-ashu", fromMemberId: "qiaoye", toMemberId: "ashu", story: "我的录音笔突然坏掉，他没有直接接过去修，而是坐在旁边一步步陪我找到松掉的线。", date: "6 月 28 日", tags: ["修理", "耐心"], visibility: "cross-circle", circleId: "qiao" },
  { id: "c-qiaoye-mili", fromMemberId: "qiaoye", toMemberId: "mili", story: "她总能多摆一副碗筷，让刚来的人自然坐下来。", date: "7 月 8 日", tags: ["饭桌", "接住新人"], visibility: "cross-circle", circleId: "village" },
  { id: "c-wang-taitai", fromMemberId: "wang", toMemberId: "taitai", story: "她离开营地前，为每盆植物都留下了浇水说明。", date: "7 月 4 日", tags: ["植物", "细心"], visibility: "cross-circle", circleId: "village" },
  { id: "c-qiaoye-wang", fromMemberId: "qiaoye", toMemberId: "wang", story: "他让借住这件事不像交换，更像回到一个临时的家。", date: "6 月 21 日", tags: ["住宿", "旅居"], visibility: "cross-circle", circleId: "qiao" },
  { id: "c-beibei-anan", fromMemberId: "beibei", toMemberId: "anan", story: "她没有急着给建议，只是把每一句话都接住了。", date: "7 月 13 日", tags: ["倾听", "陪伴"], visibility: "cross-circle", circleId: "human" },
  { id: "c-mili-beibei", fromMemberId: "mili", toMemberId: "beibei", story: "凌晨还在帮大家整理共学手册，但第二天完全没有邀功。", date: "7 月 1 日", tags: ["排版", "共学"], visibility: "cross-circle", circleId: "human" },
  { id: "c-ashu-mumu", fromMemberId: "ashu", toMemberId: "mumu", story: "他把别人准备丢掉的木板，变成了公共厨房的新架子。", date: "7 月 10 日", tags: ["旧物", "公共空间"], visibility: "cross-circle", circleId: "village" },
  { id: "c-taitai-xiaoyu", fromMemberId: "taitai", toMemberId: "xiaoyu", story: "她记得每个人的忌口，也记得谁最近可能需要被问候。", date: "6 月 30 日", tags: ["照料", "记得"], visibility: "cross-circle", circleId: "village" },
  { id: "c-ashu-qiaoye", fromMemberId: "ashu", toMemberId: "qiaoye", story: "她让人觉得，可以放心开口问。", date: "7 月 14 日", tags: ["召集", "安全感"], visibility: "cross-circle", circleId: "qiao" },
  { id: "c-anan-qiaoye", fromMemberId: "anan", toMemberId: "qiaoye", story: "活动结束后她还记得问我：刚才有没有哪一刻让你不舒服？", date: "7 月 6 日", tags: ["边界", "照顾"], visibility: "cross-circle", circleId: "human" },
  { id: "c-mumu-qiaoye", fromMemberId: "mumu", toMemberId: "qiaoye", story: "她没有把营地当作免费的背景，而是主动来问公共厨房最近缺什么。", date: "6 月 25 日", tags: ["公共生活", "主动"], visibility: "cross-circle", circleId: "village" },
];

const transactions: Transaction[] = [
  { id: "t-stay", circleId: "qiao", providerId: "wang", receiverId: "qiaoye", amount: 10, title: "厦门借住一晚", story: "在厦门借住了一晚。聊天到半夜，第二天一起吃了早饭。", happenedAt: "7 月 14 日", recordedAt: "7 月 15 日", visibility: "public", status: "confirmed", tags: ["住宿", "旅居"] },
  { id: "t-recorder", circleId: "qiao", providerId: "ashu", receiverId: "qiaoye", amount: 4, title: "修好录音笔", story: "一起拆开录音笔，重新固定了松掉的排线。", happenedAt: "6 月 28 日", recordedAt: "6 月 28 日", visibility: "public", status: "confirmed", tags: ["修理", "一起动手"] },
  { id: "t-poster", circleId: "human", providerId: "beibei", receiverId: "qiaoye", amount: 6, title: "共学招募页排版", story: "把过长的招募说明整理成了一张容易阅读的页面。", happenedAt: "7 月 1 日", recordedAt: "7 月 2 日", visibility: "public", status: "corrected", tags: ["排版", "文案"] },
  { id: "t-listen", circleId: "human", providerId: "anan", receiverId: "beibei", amount: 5, title: "一小时倾听", story: "围绕工作节奏和无法休息的问题做了一次倾听练习。", happenedAt: "7 月 12 日", recordedAt: "7 月 13 日", visibility: "private", status: "confirmed", tags: ["倾听"] },
  { id: "t-dinner", circleId: "village", providerId: "mili", receiverId: "mumu", amount: 4, title: "公共厨房晚饭", story: "米粒多做了两人份晚饭，木木收工后一起吃。", happenedAt: "7 月 11 日", recordedAt: "7 月 11 日", visibility: "public", status: "confirmed", tags: ["吃饭", "公共厨房"] },
  { id: "t-care-mystery", circleId: "village", providerId: "xiaoyu", receiverId: "taitai", amount: 8, title: "一次照料互助", story: "参与者与具体照料内容选择了隐藏。", happenedAt: "7 月 15 日", recordedAt: "7 月 15 日", visibility: "mystery", status: "confirmed", tags: ["照料"] },
  { id: "t-shelf", circleId: "village", providerId: "mumu", receiverId: "ashu", amount: 6, title: "一起做公共书架", story: "用回收木料做了一个书架，阿树提供了工具。", happenedAt: "7 月 9 日", recordedAt: "7 月 10 日", visibility: "public", status: "corrected", tags: ["木工", "公共空间"] },
  { id: "t-plant", circleId: "qiao", providerId: "taitai", receiverId: "beibei", amount: 2, title: "植物远程急救", story: "通过视频判断了烂根，并给出换盆步骤。", happenedAt: "7 月 7 日", recordedAt: "7 月 7 日", visibility: "public", status: "confirmed", tags: ["植物", "线上"] },
  { id: "t-cancelled", circleId: "qiao", providerId: "qiaoye", receiverId: "wang", amount: 5, title: "活动介绍咨询", story: "双方后来认为这只是一次普通聊天，记录已撤销。", happenedAt: "6 月 18 日", recordedAt: "6 月 19 日", visibility: "private", status: "rejected", tags: ["已撤销"] },
];

const activity: ActivityReference[] = [
  { id: 1, source: "listing", sourceId: "l-ashu-offer" }, { id: 2, source: "listing", sourceId: "l-mili-need" },
  { id: 3, source: "transaction", sourceId: "t-stay" }, { id: 4, source: "transaction", sourceId: "t-care-mystery" },
  { id: 5, source: "card", sourceId: "c-taitai-ashu" }, { id: 6, source: "listing", sourceId: "l-anan-offer" },
  { id: 7, source: "listing", sourceId: "l-mumu-need" },
];

export const demoDb = { members, circles, accounts, listings, goodCards, transactions, activity } as const;
