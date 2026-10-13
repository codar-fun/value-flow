// Deterministic suggestions from the visible text only; never modify source
// text or infer a person's home city, identity or trustworthiness.
export const CONTENT_TAGS = ["住宿", "饮食", "出行", "维修", "学习", "创作", "活动", "物品", "照护", "工作", "种植", "线上", "其他"];
// These are places mentioned in the content, never inferred residences.
const PLACES = ["北京", "上海", "广州", "深圳", "苏州", "杭州", "成都", "重庆", "南京", "武汉", "西安", "厦门", "福州", "泉州", "长沙", "郑州", "天津", "青岛", "济南", "昆明", "大理", "丽江", "贵阳", "南宁", "海口", "珠海", "佛山", "东莞", "宁波", "温州", "无锡", "常州", "合肥", "南昌", "石家庄", "太原", "沈阳", "大连", "长春", "哈尔滨", "呼和浩特", "兰州", "西宁", "银川", "乌鲁木齐", "拉萨", "台北", "臺北", "台中", "高雄", "香港", "澳门"];
const RULES: Array<[string, RegExp]> = [
  ["住宿", /住宿|住处|借住|共居|房间|沙发客|旅居/], ["饮食", /做饭|吃饭|厨房|食物|晚餐|烘焙|咖啡/],
  ["出行", /出行|搭车|拼车|接送|骑行|散步|旅行/], ["维修", /维修|修理|修好|修小|家电|修灯|浇水管/],
  ["学习", /学习|教我|课程|辅导|语言|读书|英语|交流/], ["创作", /写作|文案|设计|绘画|画画|摄影|剪辑|视频|翻译/],
  ["活动", /活动|分享会|聚会|演出|放映|工作坊/], ["物品", /物品|二手|闲置|借用|工具|书箱|搬运/],
  ["照护", /照顾|陪伴|带娃|看猫|宠物|衣服|收衣/], ["工作", /工作|职业|简历|求职|招聘/],
  ["种植", /种植|植物|花园|花盆|香草|种花/], ["线上", /线上|远程|在线|视频聊|视频通话/],
];
export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().replace(/^#+/, "")).filter(Boolean))].slice(0, 12).map((tag) => tag.slice(0, 30));
}
export function suggestedTags(text: string): string[] {
  return RULES.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}
export function contentTags(text: string, saved: string[] = [], location = ""): string[] {
  const explicit = normalizeTags(saved);
  const savedCategories = explicit.filter((tag) => !tag.startsWith("地点:"));
  const suggestions = suggestedTags(text);
  const categories = savedCategories.length ? savedCategories : suggestions.length ? suggestions : ["其他"];
  const savedPlaces = explicit.filter((tag) => tag.startsWith("地点:"));
  const places = savedPlaces.length ? savedPlaces : location.trim() ? [`地点:${location.trim()}`] : PLACES.filter((place) => text.includes(place)).slice(0, 3).map((place) => `地点:${place}`);
  return normalizeTags([...categories, ...places]);
}
export function matchesSearch(query: string, ...fields: string[]): boolean {
  const haystack = fields.join(" ").normalize("NFKC").toLocaleLowerCase();
  return query.trim().normalize("NFKC").toLocaleLowerCase().split(/\s+/).filter(Boolean).every((part) => haystack.includes(part));
}
