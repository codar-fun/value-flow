"use client";

import { useId } from "react";
import type { AbstractAvatarVariant } from "@/app/types";

const INK = "#191919";
const YELLOW = "#f8d866";
const CORAL = "#e9877b";
const BLUE = "#7fa6d7";
const GREEN = "#acd0a6";
const PAPER = "#fffaf0";
const seam = { fill: "none", stroke: INK, strokeWidth: 1.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, vectorEffect: "non-scaling-stroke" as const };
const outline = { fill: "none", stroke: INK, strokeWidth: 1.6, vectorEffect: "non-scaling-stroke" as const };
const dot = { stroke: INK, strokeWidth: 1.2, vectorEffect: "non-scaling-stroke" as const };

export function AbstractAvatarArtwork({ variant }: { variant: AbstractAvatarVariant }) {
  const clipId = `abstract-avatar-${useId().replace(/:/g, "")}`;
  return <svg className="abstract-avatar-artwork" viewBox="0 0 48 48" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><clipPath id={clipId}><circle cx="24" cy="24" r="23"/></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
    {variant === "crop" && <g>
      <rect width="48" height="48" fill={YELLOW}/>
      <circle cx="5" cy="43" r="18" fill={BLUE}/><circle cx="35" cy="12" r="5" fill={CORAL} {...dot}/>
      <path {...seam} d="M-8 30c10-7 20-6 26 1 5 6 6 14 3 22"/>
    </g>}
    {variant === "wave" && <g>
      <rect width="48" height="48" fill={PAPER}/>
      <path fill={BLUE} d="M-4 40C5 25 18 24 28 35c4 5 5 10 5 17H-4Z"/>
      <circle cx="34" cy="12" r="5" fill={YELLOW} {...dot}/><path {...seam} d="M-4 40C5 25 18 24 28 35c4 5 5 10 5 17"/>
    </g>}
    {variant === "cap" && <g>
      <rect width="48" height="48" fill={CORAL}/>
      <path fill={GREEN} d="M-3 41 50 13v38H-3Z"/><path {...seam} d="M-3 41 50 13"/>
    </g>}
    {variant === "bob" && <g>
      <rect width="48" height="48" fill={BLUE}/>
      <path fill={YELLOW} d="M-3 35C13 23 31 22 51 29v11C31 33 14 35-3 47Z"/>
      <path fill={PAPER} d="M-3 47C14 35 31 33 51 40v11H-3Z"/>
      <path {...seam} d="M-3 35C13 23 31 22 51 29M-3 47C14 35 31 33 51 40"/>
    </g>}
    {variant === "spike" && <g>
      <rect width="48" height="48" fill={BLUE}/>
      <path {...seam} d="M-4 39C9 17 29 9 52 14"/><circle cx="12" cy="31" r="4.5" fill={GREEN} {...dot}/><circle cx="36" cy="15" r="4.5" fill={PAPER} {...dot}/>
      <path d="m15 7 1.7 4.3L21 13l-4.3 1.7L15 19l-1.7-4.3L9 13l4.3-1.7Z" fill={INK}/>
    </g>}
    {variant === "curl" && <g>
      <rect width="48" height="48" fill={CORAL}/>
      <path fill={YELLOW} d="M3 49V28C3 8 45 8 45 28v21H35V29c0-12-22-12-22 0v20Z"/>
      <path fill={GREEN} d="M13 49V30c0-13 22-13 22 0v19h-9V31c0-5-4-5-4 0v18Z"/>
      <path fill={BLUE} d="M22 49V31c0-5 4-5 4 0v18Z"/>
      <path {...seam} d="M3 49V28C3 8 45 8 45 28v21M13 49V30c0-13 22-13 22 0v19M22 49V31c0-5 4-5 4 0v18"/>
    </g>}
    {variant === "bun" && <g>
      <rect width="48" height="48" fill={YELLOW}/>
      <path fill={CORAL} d="M-4 39 13 18l11 14 10-17 18 24v13H-4Z"/>
      <path fill={GREEN} d="M14 52 27 31l14 21Z"/>
      <path fill={BLUE} d="M-4 43h56v9H-4Z"/>
      <circle cx="37" cy="12" r="4" fill={PAPER} {...dot}/>
      <path {...seam} d="M-4 39 13 18l11 14 10-17 18 24M14 52l13-21 14 21M-4 43h56"/>
    </g>}
    {variant === "leaf" && <g>
      <rect width="48" height="48" fill={CORAL}/>
      <path fill={PAPER} d="M-4 18C8 12 15 15 22 23s14 10 30 1v11c-16 9-26 7-34-1S7 24-4 30Z"/>
      <path fill={BLUE} d="M-4 30c11-6 15-4 22 4s18 10 34 1v17H-4Z"/>
      <path {...seam} d="M-4 18C8 12 15 15 22 23s14 10 30 1M-4 30c11-6 15-4 22 4s18 10 34 1"/>
    </g>}
    </g>
    <circle cx="24" cy="24" r="23" {...outline}/>
  </svg>;
}
