"use client";

import { defaultPartnerAccentColor, defaultPartnerColor, PARTNER_COLOR_FILLS, type PartnerConfig } from "../lib/partner-avatar";

const FACE_OFFSETS: Partial<Record<PartnerConfig["shape"], { x?: number; y?: number }>> = {
  cap: { y: 7 }, rabbit: { y: 8 }, bear: { y: 6 }, sprout: { y: 6 },
  house: { y: 8 }, dumpling: { y: 6 },
  eggplant: { y: 10 },
};

/** Hand-drawn silhouettes with a shared centered face and shape-specific color regions. */
export function AbstractAvatarArtwork({ variant, expression = "smile", color, accentColor }: { variant: PartnerConfig["shape"]; expression?: PartnerConfig["expression"]; color?: PartnerConfig["color"]; accentColor?: PartnerConfig["accentColor"] }) {
  const isHuman = variant.startsWith("human");
  const main = isHuman ? "#f8dfcf" : PARTNER_COLOR_FILLS[color ?? defaultPartnerColor(variant)];
  const accent = PARTNER_COLOR_FILLS[isHuman ? color ?? defaultPartnerColor(variant) : accentColor ?? defaultPartnerAccentColor(variant) ?? "cream"];
  const faceOffset = isHuman ? { y: 6 } : FACE_OFFSETS[variant] ?? {};
  return <svg className="abstract-avatar-artwork" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {variant === "crop" && <><path d="m32 3 5 10 11-5-2 12 12 1-8 9 8 8-12 2 1 12-11-5-5 11-6-11-10 6 1-13-12-2 9-8-8-9 12-1-1-12 10 6Z" fill={accent}/><circle cx="32" cy="32" r="20" fill={main}/></>}
    {variant === "wave" && <path d="M8 47c-5-9 0-17 8-17C9 11 38 4 38 23c13-10 26 10 15 17 10 13-8 22-17 13-10 12-26 6-28-6Z" fill={main}/>}
    {variant === "cap" && <><path d="M15 27h34v25c-7 9-27 9-34 0Z" fill="var(--paper-strong)"/><path d="M5 29C5 0 59 0 59 29Z" fill={main}/><path d="M18 18h3m11-7h3m10 8h3" stroke="var(--paper-strong)" strokeWidth="6"/></>}
    {variant === "bob" && <><circle cx="32" cy="13" r="12" fill={main}/><circle cx="47" cy="22" r="12" fill={main}/><circle cx="47" cy="40" r="12" fill={main}/><circle cx="32" cy="50" r="12" fill={main}/><circle cx="17" cy="40" r="12" fill={main}/><circle cx="17" cy="22" r="12" fill={main}/><circle cx="32" cy="32" r="16" fill={accent}/></>}
    {variant === "spike" && <path d="m32 4 9 17 19 3-14 14 3 21-17-10-17 10 3-21L4 24l19-3Z" fill={main}/>}
    {variant === "curl" && <path d="M10 53V28C10-2 54-2 54 28v25q-5 9-11 0-5 9-11 0-5 9-11 0-6 9-11 0Z" fill={main}/>}
    {variant === "rabbit" && <><path d="M16 26C2-6 27-5 27 23h10C37-5 62-6 48 26c24 40-56 40-32 0Z" fill={main}/><path d="M18 22C9 0 21 0 24 23m16 0C43 0 55 0 46 22" stroke={accent} strokeWidth="4"/></>}
    {variant === "blob" && <path d="M7 46C-1 31 17 36 16 19 15-1 43 0 45 21c1 12 20 9 14 26-5 17-44 15-52-1Z" fill={main}/>}
    {variant === "monster" && <><path d="M13 22 8 7l16 8h16L56 7l-5 16c15 38-53 40-38-1Z" fill={main}/><path d="m13 11 8 4-5 4Zm38 0-8 4 5 4Z" fill={accent} stroke="none"/></>}
    {variant === "bear" && <><circle cx="17" cy="16" r="10" fill={main}/><circle cx="47" cy="16" r="10" fill={main}/><circle cx="17" cy="16" r="5.5" fill={accent} stroke="none"/><circle cx="47" cy="16" r="5.5" fill={accent} stroke="none"/><path d="M10 35C10 21 19 13 32 13s22 8 22 22c0 17-9 26-22 26S10 52 10 35Z" fill={main}/><ellipse cx="32" cy="39" rx="8" ry="4.5" fill={accent} stroke="none"/></>}
    {variant === "sprout" && <><path d="M32 22C5 21 8-3 32 15 50-6 63 14 32 22Z" fill="var(--green)"/><path d="M9 40C3 13 61 13 55 40c-1 24-45 24-46 0Z" fill={main}/></>}
    {variant === "cactus" && <><path d="M18 48V24c0-10 6-16 14-16s14 6 14 16v24Z" fill={main}/><path d="M18 42h-3c-6 0-9-4-9-10v-6c0-4 5-4 5 0v6c0 3 1 5 4 5h3Zm28 0h3c6 0 9-4 9-10v-6c0-4-5-4-5 0v6c0 3-1 5-4 5h-3Z" fill={main}/><path d="M12 47h40l-5 13H17Z" fill={accent}/><path d="M17 52h30"/></>}
    {variant === "house" && <><path d="m7 29 25-22 25 22Z" fill={accent}/><path d="M14 28h36v31H14Z" fill={main}/></>}
    {variant === "eggplant" && <><path d="M32 21C40 13 52 17 55 28c5 15-6 28-19 32C24 64 12 58 9 48 6 38 12 26 21 22c4-2 8-2 11-1Z" fill={main}/><path d="M31 20C27 16 21 12 16 8c0 7 5 12 12 13-4-1-7-2-10-4 1 5 6 8 12 5l2-3 2 4c6 3 11 0 12-5-3 2-6 3-10 3 7-1 12-6 13-13-5 4-11 8-15 12V5h-3v15Z" fill={accent}/></>}
    {variant === "dumpling" && <><path d="M8 42c0-16 11-27 24-27s24 11 24 27c0 12-12 18-24 18S8 54 8 42Z" fill={main}/><path d="M12 38q5-17 20-18 15 1 20 18" stroke={accent} strokeWidth="5"/><path d="m22 21 2 4m8-5v4m8-3-2 4"/></>}
    {variant === "toast" && <><path d="M12 57V27C12 8 20 5 25 13c4-8 11-8 15 0 5-8 13-5 13 14v30Z" fill={accent}/><path d="M18 54V28c0-13 5-15 9-8 4-7 9-7 12 0 4-7 9-5 9 8v26Z" fill={main} stroke="none"/></>}
    {isHuman && <HumanAvatar variant={variant} skin={main} hair={accent}/>}
    <PartnerExpression expression={expression} x={faceOffset.x ?? 0} y={faceOffset.y ?? 0}/>
  </svg>;
}

function HumanAvatar({ variant, skin, hair }: { variant: PartnerConfig["shape"]; skin: string; hair: string }) {
  const back = variant === "humanGirlWave"
    ? <path d="M15 29c-2-12 5-19 17-19s19 7 17 19l2 25-8 2-2-19H23l-2 19-8-2Z" fill={hair}/>
    : variant === "humanGirlTwin"
      ? <><circle cx="18" cy="16" r="6" fill={hair}/><circle cx="46" cy="16" r="6" fill={hair}/></>
      : null;
  let fringe;
  switch (variant) {
    case "humanBoyBuzz": fringe = <path d="M15 28c-1-10 5-16 17-16s18 6 17 16l-5-5H20Z" fill={hair}/>; break;
    case "humanGirlShort": fringe = <path d="M15 29c-2-12 5-19 17-19s19 7 17 19c-8-2-12-6-15-12-4 7-10 11-19 12Z" fill={hair}/>; break;
    case "humanGirlWave": fringe = <path d="M15 29c-2-12 5-19 17-19s19 7 17 19q-5-1-7-7-4 6-8 1-4 7-9 2-4 5-10 4Z" fill={hair}/>; break;
    case "humanGirlTwin": fringe = <path d="M15 29c-2-12 5-19 17-19s19 7 17 19c-8-2-12-6-15-12-4 7-10 11-19 12Z" fill={hair}/>; break;
    default: fringe = <path d="M15 28c-1-10 5-16 17-16s18 6 17 16l-5-5H20Z" fill={hair}/>;
  }
  return <>
    {back}
    <circle cx="15" cy="35" r="4" fill={skin}/><circle cx="49" cy="35" r="4" fill={skin}/>
    <path d="M16 31c0-12 6-19 16-19s16 7 16 19v7c0 11-7 17-16 17s-16-6-16-17Z" fill={skin}/>
    {fringe}
  </>;
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
      eyes = <path d="m18 28 6 3-6 3m28-6-6 3 6 3"/>;
      mouth = <path d="M25 37h14q-1 12-7 12t-7-12Z" fill="#ef8176"/>;
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
