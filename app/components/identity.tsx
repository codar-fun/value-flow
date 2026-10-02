/** Shared, code-native identity: two friendly loops passing a little spark. */
export function BrandGlyph({ large = false }: { large?: boolean }) {
  return <span className={`brand-glyph ${large ? "brand-glyph-large" : ""}`} aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 36C3 24 10 12 22 12c12 0 16 10 20 20s10 9 13 3" strokeWidth="13"/>
    <path d="M8 36C3 24 10 12 22 12c12 0 16 10 20 20s10 9 13 3" stroke="var(--yellow)" strokeWidth="7"/>
    <path d="M56 28c5 12-2 24-14 24-12 0-16-10-20-20s-10-9-13-3" strokeWidth="13"/>
    <path d="M56 28c5 12-2 24-14 24-12 0-16-10-20-20s-10-9-13-3" stroke="var(--coral)" strokeWidth="7"/>
    <path d="m49 3 2 5 6 2-6 2-2 5-2-5-5-2 5-2Z" fill="var(--green)" strokeWidth="2"/>
    <path d="M16 15v3m7-3v3M39 46v3m7-3v3" strokeWidth="2.5"/>
  </svg></span>;
}

export function FlowIcon({ kind }: { kind: "record" | "need" | "offer" | "card" | "mystery" }) {
  return <svg className="flow-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "record" && <><rect x="6" y="6" width="20" height="23" rx="4" fill="var(--yellow)"/><path d="M11 3v6m10-6v6M11 16h10m-10 6h6"/></>}
    {kind === "need" && <><path d="M8 19a10 10 0 1 1 16 0l-3 4H11Z" fill="var(--pink)"/><path d="M12 27h8m-7-4v-8l3 2 3-2v8M3 5l3 3m23-3-3 3"/></>}
    {kind === "offer" && <><path d="M4 21h6l5-4h8c3 0 3 4 0 4h-5m-8 5h12l7-7M4 18v11h6V18Z" fill="var(--green)"/><path d="M18 13V5m-5 3c0 5 5 5 5 5s5 0 5-5"/></>}
    {kind === "card" && <><path d="M16 27 5 16C-1 6 11 1 16 10 21 1 33 6 27 16Z" fill="var(--coral)"/><path d="m22 10 2 2M8 29l-3 1M27 25l2 3"/></>}
    {kind === "mystery" && <><path d="M5 26V14a11 11 0 0 1 22 0v12l-6-3-5 4-5-4Z" fill="var(--blue)"/><path d="M12 13v3m8-3v3"/></>}
  </svg>;
}

export type CircleIconKey = "n1" | "n2" | "n3" | "n4" | "t1" | "t2" | "t3" | "t4" | "r1" | "r2" | "r3" | "r4" | "c1" | "c2" | "c3" | "c4";
export const CIRCLE_ICON_GROUPS: { label: string; note: string; keys: CircleIconKey[] }[] = [
  { label: "自然", note: "叶、河流、种子与山", keys: ["n1", "n2", "n3", "n4"] },
  { label: "科技", note: "电路、信号、节点与轨道", keys: ["t1", "t2", "t3", "t4"] },
  { label: "旅行", note: "路径、方向、营地与船", keys: ["r1", "r2", "r3", "r4"] },
  { label: "文化", note: "书、舞台、音乐与编织", keys: ["c1", "c2", "c3", "c4"] },
];
export const CIRCLE_ICON_LABELS: Record<CircleIconKey, string> = {
  n1: "叶片", n2: "河流", n3: "种子", n4: "山野",
  t1: "电路", t2: "信号", t3: "节点", t4: "轨道",
  r1: "路径", r2: "方向", r3: "营地", r4: "远航",
  c1: "共读", c2: "舞台", c3: "音乐", c4: "编织",
};
export const CIRCLE_ICON_KEYS = CIRCLE_ICON_GROUPS.flatMap((group) => group.keys);

// New circles store a compact two-character icon key in loop's existing icon
// field. Legacy circles keep their old value in the backend but map to a
// stable pictogram here, so no letter/initial leaks back into the UI.
export function circleIconFor(value: string, seed: string): CircleIconKey {
  if ((CIRCLE_ICON_KEYS as string[]).includes(value)) return value as CircleIconKey;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CIRCLE_ICON_KEYS[h % CIRCLE_ICON_KEYS.length];
}

export function CircleGlyph({ icon, seed, size = "regular" }: { icon: string; seed: string; size?: "tiny" | "small" | "regular" | "large" }) {
  const key = circleIconFor(icon, seed);
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <span className={`circle-glyph circle-glyph-${key[0]} circle-glyph-${size}`} aria-hidden="true"><svg viewBox="0 0 48 48" {...common}>
    {key === "n1" && <><path fill="var(--green)" d="M11 31C12 16 23 10 37 9c-1 14-8 27-23 28z"/><path d="M14 35c7-8 12-13 21-22M20 28l-1-8M26 22l7 1"/></>}
    {key === "n2" && <><circle cx="35" cy="13" r="5" fill="var(--yellow)"/><path d="M7 18c8-6 14 6 22 0s11-3 13-1M6 27c8-6 14 6 22 0s11-3 14-1M8 36c7-5 13 4 20 0s10-3 13-1" stroke="var(--blue)"/></>}
    {key === "n3" && <><ellipse cx="24" cy="33" rx="7" ry="9" fill="var(--coral)"/><path d="M24 25c-2-9-8-12-14-10 1 7 5 11 14 10ZM24 25c2-9 8-12 14-10-1 7-5 11-14 10Z" fill="var(--green)"/><path d="M24 25v9"/></>}
    {key === "n4" && <><circle cx="34" cy="13" r="5" fill="var(--yellow)"/><path d="m7 37 12-17 7 8 5-6 10 15" fill="var(--green)"/><path d="m16 25 3-5 4 5" fill="var(--blue)"/></>}
    {key === "t1" && <><path d="M10 38V25h9V12M19 25h10v9h9M29 25V12h9"/><circle cx="19" cy="9" r="3" fill="var(--yellow)"/><circle cx="38" cy="9" r="3" fill="var(--blue)"/><circle cx="38" cy="37" r="3" fill="var(--coral)"/><circle cx="10" cy="40" r="3" fill="var(--green)"/></>}
    {key === "t2" && <><circle cx="24" cy="25" r="4" fill="var(--coral)"/><path d="M16 18a10 10 0 0 0 0 14M32 18a10 10 0 0 1 0 14M11 13a17 17 0 0 0 0 24M37 13a17 17 0 0 1 0 24" stroke="var(--blue)"/></>}
    {key === "t3" && <><rect x="8" y="9" width="9" height="9" rx="2" fill="var(--yellow)"/><rect x="31" y="9" width="9" height="9" rx="2" fill="var(--blue)"/><rect x="19.5" y="30" width="9" height="9" rx="2" fill="var(--green)"/><path d="M17 13.5h14M12.5 18v8l11.5 4M35.5 18v8L24 30"/></>}
    {key === "t4" && <><path d="M14 29 25 14l9 7-11 15z" fill="var(--paper-strong)"/><path d="m28 16 4-6M16 32l-4 5M31 31c7-1 10-4 10-7M17 18c-7 1-10 4-10 7"/><circle cx="36" cy="37" r="3" fill="var(--yellow)"/></>}
    {key === "r1" && <><path d="M9 39c1-9 18-6 16-15S37 17 39 9" stroke="var(--coral)"/><circle cx="9" cy="39" r="3" fill="var(--yellow)"/><circle cx="39" cy="9" r="3" fill="var(--green)"/><path d="m31 10 8-3 2 8"/></>}
    {key === "r2" && <><circle cx="24" cy="24" r="14" fill="var(--paper-strong)"/><path d="m29 17-3 10-9 4 4-10z" fill="var(--coral)"/><circle cx="24" cy="24" r="2" fill="var(--yellow)"/></>}
    {key === "r3" && <><path d="m8 37 15-21 16 21z" fill="var(--coral)"/><path d="m23 16 4 21M14 37l10-13 9 13"/><path d="M34 19v-8M34 11h7l-3 4 3 4h-7" fill="var(--green)"/></>}
    {key === "r4" && <><path d="m10 27 6 10h20l5-10z" fill="var(--blue)"/><path d="M24 12v15M24 13l11 9H24" fill="var(--yellow)"/><path d="M7 41c5-4 9 4 14 0s9 4 14 0 7 0 8 0"/></>}
    {key === "c1" && <><path d="M7 13c7-3 12-1 17 3v23c-5-4-10-6-17-3z" fill="var(--paper-strong)"/><path d="M41 13c-7-3-12-1-17 3v23c5-4 10-6 17-3z" fill="var(--blue)"/><path d="M24 16v23"/></>}
    {key === "c2" && <><path d="M8 10h32v7H8z" fill="var(--yellow)"/><path d="M10 17c8 2 8 13 3 22M38 17c-8 2-8 13-3 22" fill="var(--coral)"/><path d="M18 17c2 7 2 15-1 22M30 17c-2 7-2 15 1 22"/></>}
    {key === "c3" && <><path d="M20 10v24c-5-2-10 0-10 4s8 5 12 0c1-2 1-4 1-7V17l15-4v16c-5-2-10 0-10 4s8 5 12 0c1-2 1-4 1-7V8z" fill="var(--yellow)"/><path d="m23 17 18-5"/></>}
    {key === "c4" && <><path d="M11 10v28M19 10v28M29 10v28M37 10v28M10 13h28M10 21h28M10 31h28M10 39h28"/><path d="m9 16 8-7 22 22-8 8z" fill="var(--green)"/><path d="m31 9 8 8-22 22-8-8z" fill="var(--coral)"/></>}
  </svg></span>;
}

export function NotificationIcon() {
  return <span className="notification-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 22h14c-2-2-2-4-2-8a5 5 0 0 0-10 0c0 4 0 6-2 8Z" fill="var(--yellow)"/><path d="M14 8V6h4v2M14 25c1 2 3 2 4 0"/><circle cx="16" cy="24" r="2" fill="var(--coral)"/></svg></span>;
}

export function NavIcon({ kind }: { kind: "feed" | "discover" | "record" | "circle" | "me" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <span className={`nav-icon nav-icon-${kind}`} aria-hidden="true"><svg viewBox="0 0 24 24" {...common}>
    {kind === "feed" && <><path d="m7 3 13 2-2 16-13-2Z" fill="var(--paper-strong)"/><path d="M3 7 2 20l12 2M9 9l6 1m-7 4 6 1"/></>}
    {kind === "discover" && <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="var(--green)"/><circle cx="12" cy="12" r="2" fill="var(--ink)"/></>}
    {kind === "record" && <path d="M12 7.5v9M7.5 12h9"/>}
    {kind === "circle" && <><path d="M5 4h14v16H5Z" fill="var(--blue)"/><path d="M2 8h20M2 16h20M9 2v20m6-20v20"/></>}
    {kind === "me" && <><path d="M4 11C1-1 22-1 20 12c0 12-16 12-16-1Z" fill="var(--pink)"/><path d="M8 10v2m8-2v2m-7 4q3 3 6 0"/></>}
  </svg></span>;
}

