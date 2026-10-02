"use client";

import { defaultPartnerAccentColor, defaultPartnerColor, PARTNER_COLOR_FILLS, type PartnerConfig } from "../lib/partner-avatar";

const FACE_OFFSETS: Partial<Record<PartnerConfig["shape"], { x?: number; y?: number }>> = {
  cap: { y: 7 }, cat: { y: 4 }, rabbit: { y: 8 }, bear: { y: 6 }, sprout: { y: 6 },
  house: { y: 8 }, lighthouse: { y: 5 }, balloon: { y: -3 }, slug: { x: -8, y: 1 }, dumpling: { y: 6 },
  eggplant: { y: 10 },
};

/** Hand-drawn silhouettes with a shared centered face and shape-specific color regions. */
export function AbstractAvatarArtwork({ variant, expression = "smile", color, accentColor }: { variant: PartnerConfig["shape"]; expression?: PartnerConfig["expression"]; color?: PartnerConfig["color"]; accentColor?: PartnerConfig["accentColor"] }) {
  const main = PARTNER_COLOR_FILLS[color ?? defaultPartnerColor(variant)];
  const accent = PARTNER_COLOR_FILLS[accentColor ?? defaultPartnerAccentColor(variant) ?? "cream"];
  const faceOffset = FACE_OFFSETS[variant] ?? {};
  return <svg className="abstract-avatar-artwork" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {variant === "crop" && <><path d="m32 3 5 10 11-5-2 12 12 1-8 9 8 8-12 2 1 12-11-5-5 11-6-11-10 6 1-13-12-2 9-8-8-9 12-1-1-12 10 6Z" fill={accent}/><circle cx="32" cy="32" r="20" fill={main}/></>}
    {variant === "wave" && <path d="M8 47c-5-9 0-17 8-17C9 11 38 4 38 23c13-10 26 10 15 17 10 13-8 22-17 13-10 12-26 6-28-6Z" fill={main}/>}
    {variant === "cap" && <><path d="M15 27h34v25c-7 9-27 9-34 0Z" fill="var(--paper-strong)"/><path d="M5 29C5 0 59 0 59 29Z" fill={main}/><path d="M18 18h3m11-7h3m10 8h3" stroke="var(--paper-strong)" strokeWidth="6"/></>}
    {variant === "bob" && <><circle cx="32" cy="13" r="12" fill={main}/><circle cx="47" cy="22" r="12" fill={main}/><circle cx="47" cy="40" r="12" fill={main}/><circle cx="32" cy="50" r="12" fill={main}/><circle cx="17" cy="40" r="12" fill={main}/><circle cx="17" cy="22" r="12" fill={main}/><circle cx="32" cy="32" r="16" fill={accent}/></>}
    {variant === "spike" && <path d="m32 4 9 17 19 3-14 14 3 21-17-10-17 10 3-21L4 24l19-3Z" fill={main}/>}
    {variant === "curl" && <path d="M10 53V28C10-2 54-2 54 28v25q-5 9-11 0-5 9-11 0-5 9-11 0-6 9-11 0Z" fill={main}/>}
    {variant === "cat" && <><path d="M9 28 9 6l17 13h12L55 6v25c10 35-54 37-46-3Z" fill={main}/><path d="m14 12 10 8-8 5Zm36 0-10 8 8 5Z" fill={accent}/></>}
    {variant === "rabbit" && <><path d="M16 26C2-6 27-5 27 23h10C37-5 62-6 48 26c24 40-56 40-32 0Z" fill={main}/><path d="M18 22C9 0 21 0 24 23m16 0C43 0 55 0 46 22" stroke={accent} strokeWidth="4"/></>}
    {variant === "blob" && <path d="M7 46C-1 31 17 36 16 19 15-1 43 0 45 21c1 12 20 9 14 26-5 17-44 15-52-1Z" fill={main}/>}
    {variant === "monster" && <><path d="M13 22 8 7l16 8h16L56 7l-5 16c15 38-53 40-38-1Z" fill={main}/><path d="m11 9 10 5-6 5Zm42 0-10 5 6 5Z" fill={accent}/></>}
    {variant === "bear" && <><circle cx="17" cy="17" r="12" fill={main}/><circle cx="47" cy="17" r="12" fill={main}/><path d="M14 20C-4 13 9-4 21 12q11-5 22 0C55-4 68 13 50 20c24 49-60 49-36 0Z" fill={main}/><circle cx="17" cy="17" r="5" fill={accent}/><circle cx="47" cy="17" r="5" fill={accent}/></>}
    {variant === "sprout" && <><path d="M32 22C5 21 8-3 32 15 50-6 63 14 32 22Z" fill="var(--green)"/><path d="M9 40C3 13 61 13 55 40c-1 24-45 24-46 0Z" fill={main}/></>}
    {variant === "planet" && <><ellipse cx="32" cy="33" rx="29" ry="11" transform="rotate(-24 32 33)" stroke={accent} strokeWidth="7"/><circle cx="32" cy="32" r="19" fill={main}/><path d="M18 36c6 3 22 3 28-1" stroke={accent} strokeWidth="2"/></>}
    {variant === "cactus" && <><path d="M18 48V24c0-10 6-16 14-16s14 6 14 16v24Z" fill={main}/><path d="M18 42h-3c-6 0-9-4-9-10v-6c0-4 5-4 5 0v6c0 3 1 5 4 5h3Zm28 0h3c6 0 9-4 9-10v-6c0-4-5-4-5 0v6c0 3-1 5-4 5h-3Z" fill={main}/><path d="M12 47h40l-5 13H17Z" fill={accent}/><path d="M17 52h30"/></>}
    {variant === "house" && <><path d="m7 29 25-22 25 22Z" fill={accent}/><path d="M14 28h36v31H14Z" fill={main}/></>}
    {variant === "balloon" && <><path d="M32 5C11 5 9 24 17 37c4 7 11 12 15 16 4-4 11-9 15-16C55 24 53 5 32 5Z" fill={main}/><path d="m27 53-3 7h16l-3-7Z" fill="var(--paper-strong)"/></>}
    {variant === "eggplant" && <><path d="M32 21C40 13 52 17 55 28c5 15-6 28-19 32C24 64 12 58 9 48 6 38 12 26 21 22c4-2 8-2 11-1Z" fill={main}/><path d="M31 20C27 16 21 12 16 8c0 7 5 12 12 13-4-1-7-2-10-4 1 5 6 8 12 5l2-3 2 4c6 3 11 0 12-5-3 2-6 3-10 3 7-1 12-6 13-13-5 4-11 8-15 12V5h-3v15Z" fill={accent}/></>}
    {variant === "slug" && <><path d="M8 45c-5-11 1-19 10-18-2-15 11-23 20-13 5 5 3 12 8 16 8 1 13 6 11 15-3 15-41 17-49 0Z" fill={main}/><path d="M12 45c8 8 32 9 43 2" stroke={accent} strokeWidth="5"/></>}
    {variant === "seal" && <><path d="M11 43c-7-7-9-1-7 5 2 6 8 7 15 5m34-10c7-7 9-1 7 5-2 6-8 7-15 5" fill={accent}/><path d="M13 40c0-17 8-28 19-28s19 11 19 28c0 16-8 22-19 22S13 56 13 40Z" fill={main}/><path d="M22 48q10 5 20 0" stroke={accent} strokeWidth="3"/></>}
    {variant === "dumpling" && <><path d="M8 42c0-16 11-27 24-27s24 11 24 27c0 12-12 18-24 18S8 54 8 42Z" fill={main}/><path d="M12 38q5-17 20-18 15 1 20 18" stroke={accent} strokeWidth="5"/><path d="m22 21 2 4m8-5v4m8-3-2 4"/></>}
    {variant === "peanut" && <><path d="M31 8c-12-8-23 2-18 16-12 12-8 34 7 34 6 0 9-4 12-9 3 5 6 9 12 9 15 0 19-22 7-34 5-14-6-24-18-16Z" fill={main}/><path d="M21 18c5 6 5 19 0 29m22-29c-5 6-5 19 0 29" stroke={accent} strokeWidth="3"/></>}
    {variant === "kite" && <><path d="m32 5 23 24-23 22L9 29Z" fill={main}/><path d="m32 5-1 46M9 29h46" stroke={accent} strokeWidth="5"/><path d="m32 51 5 6-5 3-5-3Zm-3-1 3-4 3 4" fill={accent}/></>}
    {variant === "lighthouse" && <><path d="m12 21 7-11h26l7 11Z" fill={accent}/><path d="M17 22h30l-4 38H21Z" fill={main}/><path d="M11 19 4 15m49 4 7-4M32 4V1" stroke={accent} strokeWidth="3"/><path d="M25 31h14v10H25Z" fill="var(--yellow)"/><path d="M29 60V49h7v11"/></>}
    {variant === "toast" && <><path d="M12 57V27C12 8 20 5 25 13c4-8 11-8 15 0 5-8 13-5 13 14v30Z" fill={accent}/><path d="M18 54V28c0-13 5-15 9-8 4-7 9-7 12 0 4-7 9-5 9 8v26Z" fill={main} stroke="none"/></>}
    {/* Retired silhouettes remain renderable for already-saved profile values. */}
    {variant === "bun" && <><path d="M47 21h7c12 0 9 23-7 21" fill={main}/><path d="M8 16h40v28c0 19-40 19-40 0Z" fill={main}/></>}
    {variant === "leaf" && <path d="M11 46C0 22 23 8 53 7c7 34-2 53-26 50Z" fill={main}/>}
    {variant === "dog" && <><path d="M18 15C-1 5 1 45 12 43l9-16m25-12c19-10 17 30 6 28l-9-16" fill={main}/><path d="M16 18c0-13 32-13 32 0l4 24c0 20-40 20-40 0Z" fill={main}/></>}
    {variant === "octopus" && <path d="M12 37V25C12-2 52-2 52 25v12c17 18 3 27-4 13 0 15-14 15-16 2-2 13-16 13-16-2-7 14-21 5-4-13Z" fill={main}/>}
    <PartnerExpression expression={expression} x={faceOffset.x ?? 0} y={faceOffset.y ?? 0}/>
  </svg>;
}

function PartnerExpression({ expression, x, y }: { expression: PartnerConfig["expression"]; x: number; y: number }) {
  const dot = (cx: number, cy = 30, rx = 2.2, ry = 3.4) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--ink)" stroke="none"/>;
  let eyes;
  let mouth;
  switch (expression) {
    case "happy":
      eyes = <path d="M18 31q3-7 6 0m16 0q3-7 6 0"/>;
      mouth = <path d="M29 42q3 6 6 0"/>;
      break;
    case "excited":
      eyes = <path d="m16 26 9 5-9 4m32-9-9 5 9 4"/>;
      mouth = <path d="M25 37h14q-1 12-7 12t-7-12Z" fill="#ef8176"/>;
      break;
    case "wink":
      eyes = <>{dot(23)}<path d="m42 28-6 3 6 3"/></>;
      mouth = <path d="M29 40q3 3 6 0"/>;
      break;
    case "cheeky":
      eyes = <><path d="M18 29q4-3 8 0m12 0q4-3 8 0"/>{dot(24, 30, 1.5, 2)}{dot(38, 30, 1.5, 2)}</>;
      mouth = <path d="M28 41q4 2 8-2"/>;
      break;
    case "curious":
      eyes = <><ellipse cx="23" cy="30" rx="4.2" ry="5.2" fill="var(--paper)"/><ellipse cx="41" cy="30" rx="4.2" ry="5.2" fill="var(--paper)"/>{dot(24, 31, 1.7, 2.4)}{dot(40, 31, 1.7, 2.4)}<path d="m18 23 7-2"/></>;
      mouth = <path d="M30 40q2-2 4 0"/>;
      break;
    case "surprised":
      eyes = <><ellipse cx="23" cy="29" rx="4.5" ry="5.5" fill="var(--paper)"/>{dot(23, 30, 1.8, 2.6)}<ellipse cx="41" cy="29" rx="4.5" ry="5.5" fill="var(--paper)"/>{dot(41, 30, 1.8, 2.6)}</>;
      mouth = <ellipse cx="32" cy="41" rx="2.4" ry="3.5" fill="var(--paper)"/>;
      break;
    case "confused":
      eyes = <><path d="m18 24 8-2"/>{dot(23, 31, 1.8, 2.7)}<ellipse cx="41" cy="30" rx="3.2" ry="4.5" fill="var(--paper)"/>{dot(42, 31, 1.6, 2.3)}</>;
      mouth = <path d="m29 40 3-2 3 2"/>;
      break;
    case "sleepy":
      eyes = <path d="M17 29q4 5 8 0m14 0q4 5 8 0"/>;
      mouth = <ellipse cx="32" cy="38" rx="2.5" ry="3"/>;
      break;
    case "bored":
      eyes = <><path d="M18 28q5-3 10 0v4h-10m18-4q5-3 10 0v4h-10" fill="var(--paper)"/>{dot(25, 31, 1.3, 2)}{dot(43, 31, 1.3, 2)}</>;
      mouth = <path d="M30 41h4"/>;
      break;
    case "pout":
      eyes = <>{dot(23)}{dot(41)}<path d="m18 26 7 2m10 0 7-2"/></>;
      mouth = <path d="M28 43q4-6 8 0"/>;
      break;
    case "grumpy":
      eyes = <><path d="m18 27 9 3m18-3-9 3"/>{dot(23, 32, 1.8, 2.5)}{dot(41, 32, 1.8, 2.5)}</>;
      mouth = <path d="M28 44q4-5 8 0"/>;
      break;
    case "crying":
      eyes = <><path d="M19 31q4-6 8 0m10 0q4-6 8 0"/><path d="M21 35q-3 5-1 8m21-8q3 5 1 8" stroke="#68a8d5"/></>;
      mouth = <path d="M29 44q3-4 6 0"/>;
      break;
    case "determined":
      eyes = <><path d="m18 26 9 2m18-2-9 2"/><path d="M20 31h6m12 0h6"/></>;
      mouth = <path d="M29 41h6"/>;
      break;
    case "shy":
      eyes = <path d="m17 28 8 2m14-2 8 2"/>;
      mouth = <path d="M27 40q5 4 10 0"/>;
      break;
    default:
      eyes = <>{dot(23)}{dot(41)}</>;
      mouth = <path d="M28 40q4 5 8 0"/>;
  }
  return <g transform={`translate(${x} ${y})`}>
    <g strokeWidth="1.5">{eyes}</g><g transform="translate(14.4 8) scale(.55)">{mouth}</g>
  </g>;
}
