"use client";

import { useId } from "react";
import type { FaceConfig } from "@/app/lib/avatar";

const INK = "#191919";
const SKINS = {
  ivory: "#fffaf0",
  cream: "#fff0cf",
  apricot: "#f7d59e",
  gold: "#efca72",
} as const;
const HAIR = {
  ink: "#191919",
  cocoa: "#3f332e",
  chestnut: "#76503f",
  coral: "#ef8176",
  auburn: "#b95f4b",
  blue: "#6c9fd4",
  mint: "#81c6a1",
  plum: "#745776",
} as const;

const FACE = "M50 11C72 11 87 28 87 51C87 75 72 91 50 92C28 91 13 75 13 51C13 28 28 11 50 11Z";
const OUTLINE = { stroke: INK, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const STRAND = { fill: "none", stroke: INK, strokeWidth: 1.6, strokeLinecap: "round" as const };

function BackHairLayer({ hair, color }: Pick<FaceConfig, "hair"> & { color: string }) {
  const common = { ...OUTLINE, fill: color };
  if (hair === "bob") return <path {...common} d="M50 4C77 4 94 24 92 55c-1 16-8 29-20 38l-8-12c7-9 10-21 8-37-6-14-38-14-44 0-2 16 1 28 8 37l-8 12C16 84 9 71 8 55 6 24 23 4 50 4Z"/>;
  if (hair === "wave") return <><path {...common} d="M18 30C8 40 7 60 16 74c4 7 9 12 16 16l7-11C30 68 27 50 32 34Z"/><path {...common} d="M82 30c10 10 11 30 2 44-4 7-9 12-16 16l-7-11c9-11 12-29 7-45Z"/></>;
  if (hair === "curl") return <><path {...common} d="M28 19C15 20 7 32 11 44c-7 7-5 20 3 26-3 9 5 18 14 17 3 5 8 7 13 4l-5-14c-8-10-9-29-3-44Z"/><path {...common} d="M72 19c13 1 21 13 17 25 7 7 5 20-3 26 3 9-5 18-14 17-3 5-8 7-13 4l5-14c8-10 9-29 3-44Z"/></>;
  if (hair === "center") return <path {...common} d="M50 4C77 4 93 24 92 54c0 14-6 27-17 36l-9-11c7-8 9-20 6-36-7-14-37-14-44 0-3 16-1 28 6 36l-9 11C14 81 8 68 8 54 7 24 23 4 50 4Z"/>;
  if (hair === "bun") return <><circle {...common} cx="50" cy="8" r="14"/><path {...common} d="M19 48C15 27 26 8 50 7c24 1 35 20 31 41-7-5-12-12-14-20H33c-2 8-7 15-14 20Z"/></>;
  if (hair === "long") return <><path {...common} d="M31 12C17 17 9 34 10 55c0 20 2 34-2 43h29c-6-13-7-31-3-52Z"/><path {...common} d="M69 12c14 5 22 22 21 43 0 20-2 34 2 43H63c6-13 7-31 3-52Z"/></>;
  if (hair === "longWave") return <><path {...common} d="M31 11C15 16 8 33 10 52c2 12-5 16 0 25 4 6-2 12 0 21h29c-5-9 1-15-3-23-4-9 1-18-2-31Z"/><path {...common} d="M69 11c16 5 23 22 21 41-2 12 5 16 0 25-4 6 2 12 0 21H61c5-9-1-15 3-23 4-9-1-18 2-31Z"/></>;
  if (hair === "ponytail") return <><path {...common} d="M73 18c13-2 23 5 23 16 0 6-3 11-8 14 8 9 8 21 1 31-5 7-5 13-2 19H66c-4-10 0-20 8-30 8-11 8-28-1-50Z"/><circle {...common} cx="77" cy="24" r="6"/></>;
  if (hair === "braid") return <g><path {...common} d="M69 14c14 5 21 20 19 38l-15 1c1-15-2-27-10-35Z"/><ellipse {...common} cx="82" cy="55" rx="9" ry="10"/><ellipse {...common} cx="84" cy="70" rx="8" ry="9"/><ellipse {...common} cx="82" cy="84" rx="7" ry="8"/><path {...common} d="m77 98 5-9 5 9Z"/></g>;
  if (hair === "halfUp") return <><circle {...common} cx="50" cy="9" r="11"/><path {...common} d="M31 12C17 17 9 34 10 55c0 20 2 34-2 43h29c-6-13-7-31-3-52Z"/><path {...common} d="M69 12c14 5 22 22 21 43 0 20-2 34 2 43H63c6-13 7-31 3-52Z"/></>;
  if (hair === "twinTail") return <><path {...common} d="M27 23C13 23 4 34 7 47c-5 8-4 19 3 25-5 8-2 20 7 26h20c-8-16-7-35 0-54Z"/><path {...common} d="M73 23c14 0 23 11 20 24 5 8 4 19-3 25 5 8 2 20-7 26H63c8-16 7-35 0-54Z"/><circle {...common} cx="25" cy="34" r="5"/><circle {...common} cx="75" cy="34" r="5"/></>;
  return null;
}

function FrontHairLayer({ hair, color }: Pick<FaceConfig, "hair"> & { color: string }) {
  const common = { fill: color };
  switch (hair) {
    case "short":
      return <path {...common} d="M11 49C9 23 25 5 50 5c24 0 38 15 40 37-7 0-12-6-14-15-7 10-16 13-25 7-10 9-22 14-40 15Z"/>;
    case "crop":
      return <path {...common} d="M12 43C14 20 31 6 54 6c19 1 33 12 36 32-6 0-10-2-14-6-3 5-7 8-12 9-2-6-5-9-9-12-3 6-7 10-12 12-3-5-7-8-11-10-4 5-9 9-15 11Z"/>;
    case "fringe":
      return <path {...common} d="M11 49C9 23 25 5 50 5s41 18 39 44c-6-2-10-7-12-14H23c-2 7-6 12-12 14Z"/>;
    case "bob":
      return <path {...common} d="M14 43C15 20 30 7 50 7s35 13 36 36c-7-4-10-9-12-15H26c-2 6-5 11-12 15Z"/>;
    case "wave":
      return <path {...common} d="M11 49C9 23 25 5 50 5s41 18 39 44c-6 0-10-4-13-11-4 6-10 8-15 3-4 6-10 7-15 1-4 6-10 7-15 2-4 5-10 7-15 4-2 1-3 1-5 1Z"/>;
    case "curl":
      return <path {...common} d="M13 45c-4-9 0-19 8-23-1-8 8-14 16-11 5-8 20-8 26 0 8-3 17 3 16 11 8 4 12 14 8 23-6 0-10-4-12-10-4 6-10 7-15 2-4 6-10 7-15 1-4 6-10 7-15 2-4 4-10 6-17 5Z"/>;
    case "center":
      return <><path {...common} d="M50 5C29 4 14 20 11 47c9-1 15-7 18-17 5 6 11 10 20 11Z"/><path {...common} d="M50 5c21-1 36 15 39 42-9-1-15-7-18-17-5 6-11 10-20 11Z"/></>;
    case "shag":
      return <path {...common} d="M11 45C13 20 30 5 53 6c20 0 34 12 37 33-6 0-11-3-15-8-2 6-6 10-11 12-3-6-7-10-11-13-3 7-7 11-12 14-3-6-7-10-11-12-4 6-9 10-15 12Z"/>;
    case "bun":
      return <path {...common} d="M14 43C15 20 30 7 50 7s35 13 36 36c-7-4-10-9-12-15H26c-2 6-5 11-12 15Z"/>;
    case "undercut":
      return <path {...common} d="M12 43C15 18 33 5 57 7c18 1 31 12 34 31-8-1-14-4-19-10-8 6-18 9-29 10l-7-7c-4 5-9 9-16 11Z"/>;
    case "long":
      return <><path {...common} d="M50 5C29 4 14 20 11 47c9-1 15-7 18-17 5 6 11 10 20 11Z"/><path {...common} d="M50 5c21-1 36 15 39 42-9-1-15-7-18-17-5 6-11 10-20 11Z"/></>;
    case "longWave":
      return <><path {...common} d="M50 5C28 4 13 20 11 47c8 0 14-5 18-14 4 6 10 8 15 4 2 3 4 4 5 4Z"/><path {...common} d="M50 5c22-1 37 15 39 42-8 0-14-5-18-14-4 6-10 8-15 4-2 3-4 4-5 4Z"/></>;
    case "ponytail":
      return <path {...common} d="M12 45C14 21 31 6 53 6c19 0 33 11 37 31-8 0-14-3-19-9-9 7-21 11-34 11l-6-7c-5 6-11 10-19 13Z"/>;
    case "braid":
      return <path {...common} d="M11 47C12 21 28 5 50 5c22 0 37 14 39 39-8-1-14-5-18-13-5 7-12 10-20 9-7 0-13-4-18-10-4 9-11 15-22 17Z"/>;
    case "halfUp":
      return <><path {...common} d="M50 7C29 5 14 21 11 47c9-1 15-7 18-17 5 6 11 10 20 11Z"/><path {...common} d="M50 7c21-2 36 14 39 40-9-1-15-7-18-17-5 6-11 10-20 11Z"/></>;
    case "twinTail":
      return <path {...common} d="M13 44C15 20 31 6 50 6s35 14 37 38c-8-2-13-7-16-15-5 6-11 9-20 9-8 0-15-3-21-9-3 8-9 13-17 15Z"/>;
  }
}

function EyesLayer({ eyes }: Pick<FaceConfig, "eyes">) {
  const dot = (cx: number) => <circle cx={cx} cy="57" r="3.2" fill={INK}/>;
  if (eyes === "smile") return <g {...STRAND} strokeWidth="1.7"><path d="M33 58q4-5 8 0"/><path d="M59 58q4-5 8 0"/></g>;
  if (eyes === "wink") return <g>{dot(37)}<path {...STRAND} strokeWidth="1.7" d="M59 58l4-3 4 3"/></g>;
  if (eyes === "calm") return <g {...STRAND} strokeWidth="1.7"><path d="M33 57h7"/><path d="M60 57h7"/></g>;
  if (eyes === "bright") return <g>{dot(37)}{dot(63)}<circle cx="36" cy="56" r=".8" fill="#fff"/><circle cx="62" cy="56" r=".8" fill="#fff"/></g>;
  if (eyes === "crescent") return <g {...STRAND} strokeWidth="1.7"><path d="M32 56q5 6 10 0"/><path d="M58 56q5 6 10 0"/></g>;
  if (eyes === "glance") return <g><circle cx="37" cy="57" r="4.3" fill="#fffaf0" stroke={INK} strokeWidth="1.4"/><circle cx="63" cy="57" r="4.3" fill="#fffaf0" stroke={INK} strokeWidth="1.4"/><circle cx="38.5" cy="57" r="2" fill={INK}/><circle cx="64.5" cy="57" r="2" fill={INK}/></g>;
  return <g>{dot(37)}{dot(63)}</g>;
}

function GlassesLayer({ glasses }: Pick<FaceConfig, "glasses">) {
  if (glasses === "none") return null;
  const frame = { fill: "none", stroke: INK, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (glasses === "oval") return <g {...frame}><ellipse cx="36" cy="57" rx="9" ry="7"/><ellipse cx="64" cy="57" rx="9" ry="7"/><path d="M45 57h10M27 56l-6-2M73 56l6-2"/></g>;
  if (glasses === "square") return <g {...frame}><rect x="28" y="50" width="16" height="14" rx="3"/><rect x="56" y="50" width="16" height="14" rx="3"/><path d="M44 56h12M28 55l-7-2M72 55l7-2"/></g>;
  if (glasses === "half") return <g {...frame}><path d="M28 57c0-6 16-6 16 0v4M56 57c0-6 16-6 16 0v4M44 56h12M28 56l-7-2M72 56l7-2"/></g>;
  return <g {...frame}><circle cx="36" cy="57" r="7.8"/><circle cx="64" cy="57" r="7.8"/><path d="M44 57h12M28 56l-7-2M72 56l7-2"/></g>;
}

function MouthLayer({ mouth }: Pick<FaceConfig, "mouth">) {
  const line = { ...STRAND, strokeWidth: 1.7 };
  if (mouth === "open") return <path d="M44 71h12c0 7-12 7-12 0Z" fill="#ef8176" stroke={INK} strokeWidth="1.5" strokeLinejoin="round"/>;
  if (mouth === "grin") return <path d="M41 70h18c-1 9-17 9-18 0Z" fill="#fffaf0" stroke={INK} strokeWidth="1.5" strokeLinejoin="round"/>;
  if (mouth === "flat") return <path {...line} d="M45 73h10"/>;
  if (mouth === "pout") return <path {...line} d="M45 74q5-5 10 0"/>;
  if (mouth === "tiny") return <path {...line} d="M47 72q3 3 6 0"/>;
  return <path {...line} d="M43 71q7 7 14 0"/>;
}

export function FaceAvatarArtwork({ config }: { config: FaceConfig }) {
  const skin = SKINS[config.skin];
  const hair = HAIR[config.hairColor];
  const faceClipId = `avatar-face-${useId().replace(/:/g, "")}`;
  return <span className="custom-avatar-artwork" role="presentation">
    <svg className="custom-avatar-head" viewBox="0 0 100 100" aria-hidden="true">
      <defs><clipPath id={faceClipId}><path d={FACE}/></clipPath></defs>
      <BackHairLayer hair={config.hair} color={hair}/>
      <circle cx="13" cy="53" r="7" fill={skin} {...OUTLINE}/>
      <circle cx="87" cy="53" r="7" fill={skin} {...OUTLINE}/>
      <path d={FACE} fill={skin}/>
      <g clipPath={`url(#${faceClipId})`}><FrontHairLayer hair={config.hair} color={hair}/></g>
      <path d={FACE} fill="none" {...OUTLINE}/>
      <EyesLayer eyes={config.eyes}/>
      <GlassesLayer glasses={config.glasses}/>
      <MouthLayer mouth={config.mouth}/>
    </svg>
  </span>;
}
