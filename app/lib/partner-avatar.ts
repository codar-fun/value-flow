export const PARTNER_SHAPES = {
  crop: "小太阳", wave: "云朵", cap: "蘑菇", bob: "花花", spike: "星星", curl: "小幽灵",
  rabbit: "兔子", blob: "软团子", monster: "小怪物", bear: "小熊", sprout: "发芽团子",
  cactus: "仙人掌", house: "小房子", eggplant: "小茄子", dumpling: "饭团", toast: "吐司",
  humanBoyBuzz: "寸头男生", humanGirlShort: "短发女生", humanGirlTwin: "双丸子女生", humanGirlWave: "卷发女生",
} as const;
export const PARTNER_SHAPE_OPTIONS = {
  crop: PARTNER_SHAPES.crop, wave: PARTNER_SHAPES.wave, cap: PARTNER_SHAPES.cap, bob: PARTNER_SHAPES.bob,
  spike: PARTNER_SHAPES.spike, curl: PARTNER_SHAPES.curl, rabbit: PARTNER_SHAPES.rabbit,
  blob: PARTNER_SHAPES.blob, monster: PARTNER_SHAPES.monster, bear: PARTNER_SHAPES.bear, sprout: PARTNER_SHAPES.sprout,
  cactus: PARTNER_SHAPES.cactus, house: PARTNER_SHAPES.house,
  eggplant: PARTNER_SHAPES.eggplant, dumpling: PARTNER_SHAPES.dumpling, toast: PARTNER_SHAPES.toast,
  humanGirlShort: PARTNER_SHAPES.humanGirlShort, humanBoyBuzz: PARTNER_SHAPES.humanBoyBuzz,
  humanGirlTwin: PARTNER_SHAPES.humanGirlTwin, humanGirlWave: PARTNER_SHAPES.humanGirlWave,
} as const;
export const PARTNER_EXPRESSIONS = {
  smile: "微笑", happy: "开心", curious: "好奇", surprised: "惊讶", sleepy: "困困", pout: "委屈", excited: "用力开心",
  grumpy: "气鼓鼓", cheeky: "得意", determined: "认真", bored: "无聊", shy: "害羞",
} as const;
export const PARTNER_EXPRESSION_OPTIONS = {
  smile: PARTNER_EXPRESSIONS.smile, happy: PARTNER_EXPRESSIONS.happy, curious: PARTNER_EXPRESSIONS.curious,
  surprised: PARTNER_EXPRESSIONS.surprised, sleepy: PARTNER_EXPRESSIONS.sleepy, pout: PARTNER_EXPRESSIONS.pout,
  excited: PARTNER_EXPRESSIONS.excited, grumpy: PARTNER_EXPRESSIONS.grumpy, cheeky: PARTNER_EXPRESSIONS.cheeky,
  determined: PARTNER_EXPRESSIONS.determined, bored: PARTNER_EXPRESSIONS.bored, shy: PARTNER_EXPRESSIONS.shy,
} as const;
export const PARTNER_COLORS = { yellow: "奶油黄", coral: "珊瑚橘", pink: "草莓粉", blue: "天空蓝", green: "抹茶绿", lavender: "葡萄紫", peach: "蜜桃色", cream: "燕麦白", mint: "薄荷绿", rose: "玫瑰粉", cocoa: "可可棕", aqua: "海盐蓝" } as const;
export const PARTNER_COLOR_FILLS = { yellow: "#f1da87", coral: "var(--coral)", pink: "var(--pink)", blue: "var(--blue)", green: "var(--green)", lavender: "#c6b4df", peach: "#f4c49f", cream: "#eee1c4", mint: "#b7d6bd", rose: "#e9a5a4", cocoa: "#b88770", aqua: "#9acbd0" } as const;
export type PartnerColor = keyof typeof PARTNER_COLORS;
export type PartnerConfig = { shape: keyof typeof PARTNER_SHAPES; expression: keyof typeof PARTNER_EXPRESSIONS; color: PartnerColor; accentColor?: PartnerColor };
export type PartnerAvatar = `buddy3:${string}`;

const DEFAULT_COLORS: Record<PartnerConfig["shape"], { color: PartnerColor; accentColor?: PartnerColor }> = {
  crop: { color: "yellow", accentColor: "coral" }, wave: { color: "blue" }, cap: { color: "coral" },
  bob: { color: "pink", accentColor: "yellow" }, spike: { color: "yellow" }, curl: { color: "lavender" },
  rabbit: { color: "pink", accentColor: "coral" }, blob: { color: "green" }, monster: { color: "blue", accentColor: "coral" },
  bear: { color: "yellow", accentColor: "peach" }, sprout: { color: "cream" },
  cactus: { color: "green", accentColor: "coral" }, house: { color: "cream", accentColor: "coral" },
  eggplant: { color: "lavender", accentColor: "green" }, dumpling: { color: "cream", accentColor: "green" },
  toast: { color: "cream", accentColor: "peach" },
  humanBoyBuzz: { color: "cocoa" }, humanGirlShort: { color: "cocoa" }, humanGirlTwin: { color: "cocoa" }, humanGirlWave: { color: "cocoa" },
};
export function defaultPartnerColors(shape: PartnerConfig["shape"]) { return DEFAULT_COLORS[shape] ?? { color: "yellow" as const }; }
export function defaultPartnerColor(shape: PartnerConfig["shape"]): PartnerColor { return defaultPartnerColors(shape).color; }
export function defaultPartnerAccentColor(shape: PartnerConfig["shape"]): PartnerColor | undefined { return DEFAULT_COLORS[shape]?.accentColor; }

export function encodePartnerAvatar(config: PartnerConfig): PartnerAvatar {
  return ["buddy3", config.shape, config.expression, config.color, config.accentColor ?? "-"].join(":") as PartnerAvatar;
}
export function parsePartnerAvatar(value: string | null | undefined): PartnerConfig | null {
  const [version, shape, expression, color, accentColor, ...extra] = (value ?? "").split(":");
  if (extra.length || !Object.hasOwn(PARTNER_SHAPES, shape) || !Object.hasOwn(PARTNER_EXPRESSIONS, expression)) return null;
  if (version !== "buddy3" || !Object.hasOwn(PARTNER_COLORS, color) || (accentColor !== "-" && !Object.hasOwn(PARTNER_COLORS, accentColor))) return null;
  return accentColor === "-" ? { shape, expression, color } as PartnerConfig : { shape, expression, color, accentColor } as PartnerConfig;
}
export function randomPartnerAvatar(previous: PartnerConfig): PartnerAvatar {
  const pick = <T extends string>(values: T[]) => values[Math.floor(Math.random() * values.length)];
  const shape = pick((Object.keys(PARTNER_SHAPE_OPTIONS) as PartnerConfig["shape"][]).filter(candidate => candidate !== previous.shape));
  // Randomize only current selectable silhouettes and use their balanced palette defaults.
  return encodePartnerAvatar({ shape, expression: pick(Object.keys(PARTNER_EXPRESSION_OPTIONS) as PartnerConfig["expression"][]), ...defaultPartnerColors(shape) });
}
