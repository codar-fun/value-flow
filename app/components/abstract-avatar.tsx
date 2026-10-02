"use client";

import { defaultPartnerColor, PARTNER_COLOR_FILLS, type PartnerConfig } from "../lib/partner-avatar";

/** Existing avatar keys now draw eight little neighbours. No data migration. */
export function AbstractAvatarArtwork({ variant, expression = "smile", color }: { variant: PartnerConfig["shape"]; expression?: PartnerConfig["expression"]; color?: PartnerConfig["color"] }) {
  const bodyColor = PARTNER_COLOR_FILLS[color ?? defaultPartnerColor(variant)];
  return <svg className="abstract-avatar-artwork" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {variant === "crop" && <path d="m32 4 7 7 10-1 2 10 8 6-5 9 1 10-10 3-6 10-9-5-10 1-3-10-9-6 5-9-1-10 10-3Z" fill={bodyColor}/>}
    {variant === "wave" && <path d="M8 47c-5-9 0-17 8-17C9 11 38 4 38 23c13-10 26 10 15 17 10 13-8 22-17 13-10 12-26 6-28-6Z" fill={bodyColor}/>}
    {variant === "cap" && <><path d="M16 26h32v25c-6 9-26 9-32 0Z" fill="var(--paper-strong)"/><path d="M5 30C5 0 59 0 59 30Z" fill={bodyColor}/><path d="M18 19h3m11-8h3m10 10h3" stroke="var(--paper-strong)" strokeWidth="6"/></>}
    {variant === "bob" && <path d="M32 9c-7-13-24-3-20 8C-2 21 2 39 14 39c-5 15 13 25 20 13 12 12 26-4 18-14 15-6 8-25-5-22C45 3 34 1 32 9Z" fill={bodyColor}/>}
    {variant === "spike" && <path d="m32 4 9 17 19 3-14 14 3 21-17-10-17 10 3-21L4 24l19-3Z" fill={bodyColor}/>}
    {variant === "curl" && <path d="M10 53V28C10-2 54-2 54 28v25q-5 9-11 0-5 9-11 0-5 9-11 0-6 9-11 0Z" fill={bodyColor}/>}
    {variant === "bun" && <><path d="M47 21h7c12 0 9 23-7 21" fill={bodyColor}/><path d="M8 16h40v28c0 19-40 19-40 0Z" fill={bodyColor}/></>}
    {variant === "leaf" && <path d="M11 46C0 22 23 8 53 7c7 34-2 53-26 50Z" fill={bodyColor}/>}
    {variant === "cat" && <path d="M9 28 9 6l17 13h12L55 6v25c10 35-54 37-46-3Z" fill={bodyColor}/>}
    {variant === "rabbit" && <path d="M16 26C2-6 27-5 27 23h10C37-5 62-6 48 26c24 40-56 40-32 0Z" fill={bodyColor}/>}
    {variant === "blob" && <path d="M7 46C-1 31 17 36 16 19 15-1 43 0 45 21c1 12 20 9 14 26-5 17-44 15-52-1Z" fill={bodyColor}/>}
    {variant === "monster" && <><path d="m14 22-4-15 15 9h14L54 7l-4 15c17 42-53 43-36 0Z" fill={bodyColor}/><path d="m22 51 3 7 5-5m5 0 5 5 3-7" fill="var(--paper)"/></>}
    {variant === "bear" && <path d="M14 20C-4 13 9-4 21 12q11-5 22 0C55-4 68 13 50 20c24 49-60 49-36 0Z" fill={bodyColor}/>}
    {variant === "dog" && <><path d="M18 15C-1 5 1 45 12 43l9-16m25-12c19-10 17 30 6 28l-9-16" fill={bodyColor}/><path d="M16 18c0-13 32-13 32 0l4 24c0 20-40 20-40 0Z" fill={bodyColor}/></>}
    {variant === "octopus" && <path d="M12 37V25C12-2 52-2 52 25v12c17 18 3 27-4 13 0 15-14 15-16 2-2 13-16 13-16-2-7 14-21 5-4-13Z" fill={bodyColor}/>}
    {variant === "sprout" && <><path d="M32 22C5 21 8-3 32 15 50-6 63 14 32 22Z" fill={bodyColor}/><path d="M9 40C3 13 61 13 55 40c-1 24-45 24-46 0Z" fill={bodyColor}/></>}
    <PartnerExpression expression={expression} lowered={variant === "cap" || variant === "rabbit"}/>
  </svg>;
}

function PartnerExpression({ expression, lowered }: { expression: PartnerConfig["expression"]; lowered: boolean }) {
  return <g transform={`translate(0 ${lowered ? 8 : 0})`}>
    {expression === "happy" ? <path d="M22 31q3-7 6 0m8 0q3-7 6 0"/> : expression === "excited" ? <path d="m22 26 6 5-6 3m20-8-6 5 6 3"/> : expression === "sleepy" ? <path d="M22 31h6m8 0h6"/> : <>
      <ellipse cx="25" cy="30" rx={expression === "curious" ? 3.5 : 2.5} ry="4" fill="var(--ink)" stroke="none"/>
      {expression === "wink" ? <path d="m42 27-6 3 6 3"/> : <ellipse cx="39" cy="30" rx="2.5" ry="4" fill="var(--ink)" stroke="none"/>}
    </>}
    {expression === "surprised" ? <ellipse cx="32" cy="40" rx="3" ry="4" fill="var(--paper)"/> : expression === "pout" ? <><path d="m22 22 6 2m8 0 6-2M27 42q5-6 10 0"/></> : expression === "sleepy" ? <path d="M29 40h6"/> : expression === "happy" || expression === "excited" ? <path d="M26 38h12q-6 14-12 0Z" fill="var(--paper)"/> : <path d="M27 39q5 6 10 0"/>}
  </g>;
}
