export const PARTNER_SHAPES = { crop: "小太阳", wave: "云朵", cap: "蘑菇", bob: "花花", spike: "星星", curl: "小幽灵", bun: "茶杯", leaf: "叶子", cat: "猫猫", rabbit: "长耳兔", blob: "软团子", monster: "小怪物", bear: "小熊", dog: "垂耳狗", octopus: "小章鱼", sprout: "发芽团子" } as const;
export const PARTNER_EXPRESSIONS = { smile: "微笑", happy: "开心", wink: "眨眼", curious: "好奇", surprised: "惊讶", sleepy: "困困", pout: "委屈", excited: "用力开心" } as const;
export const PARTNER_COLORS = { yellow: "奶油黄", coral: "珊瑚橘", pink: "草莓粉", blue: "天空蓝", green: "抹茶绿", lavender: "葡萄紫", peach: "蜜桃色", cream: "燕麦白" } as const;
export const PARTNER_COLOR_FILLS = { yellow: "var(--yellow)", coral: "var(--coral)", pink: "var(--pink)", blue: "var(--blue)", green: "var(--green)", lavender: "#c6b4df", peach: "#f4c49f", cream: "#eee1c4" } as const;
export type PartnerConfig = { shape: keyof typeof PARTNER_SHAPES; expression: keyof typeof PARTNER_EXPRESSIONS; color: keyof typeof PARTNER_COLORS };
export type PartnerAvatar = `buddy1:${string}` | `buddy2:${string}`;
export function defaultPartnerColor(shape: PartnerConfig["shape"]): PartnerConfig["color"] {
  if (["wave", "bun", "monster"].includes(shape)) return "blue";
  if (["cap", "cat", "octopus"].includes(shape)) return "coral";
  if (["bob", "rabbit"].includes(shape)) return "pink";
  if (["leaf", "blob", "sprout"].includes(shape)) return "green";
  if (shape === "curl") return "lavender";
  return "yellow";
}
export function encodePartnerAvatar(config: PartnerConfig): PartnerAvatar {
  return `buddy2:${config.shape}:${config.expression}:${config.color}`;
}
export function parsePartnerAvatar(value: string | null | undefined): PartnerConfig | null {
  const [version, shape, expression, part, ...extra] = (value ?? "").split(":");
  if (extra.length || !Object.hasOwn(PARTNER_SHAPES, shape) || !Object.hasOwn(PARTNER_EXPRESSIONS, expression)) return null;
  // Read old saved partners without their retired sticker; never rewrite profile data on load.
  if (version === "buddy1" && ["none", "flower", "leaf", "star", "heart", "moon"].includes(part))
    return { shape, expression, color: defaultPartnerColor(shape as PartnerConfig["shape"]) } as PartnerConfig;
  if (version !== "buddy2" || !Object.hasOwn(PARTNER_COLORS, part)) return null;
  return { shape, expression, color: part } as PartnerConfig;
}
export function randomPartnerAvatar(previous: PartnerConfig): PartnerAvatar {
  const pick = <T extends string>(values: T[]) => values[Math.floor(Math.random() * values.length)];
  // Always change the silhouette; all three parts remain independently editable.
  return encodePartnerAvatar({ shape: pick((Object.keys(PARTNER_SHAPES) as PartnerConfig["shape"][]).filter(shape => shape !== previous.shape)), expression: pick(Object.keys(PARTNER_EXPRESSIONS) as PartnerConfig["expression"][]), color: pick(Object.keys(PARTNER_COLORS) as PartnerConfig["color"][]) });
}
