"use client";

import { useState, type ReactNode } from "react";
import type { AvatarVariant } from "../types";
import { ABSTRACT_AVATARS, abstractAvatarFor } from "../lib/avatar";
import {
  PARTNER_COLORS,
  PARTNER_EXPRESSION_OPTIONS,
  PARTNER_SHAPE_OPTIONS,
  defaultPartnerColors,
  encodePartnerAvatar,
  parsePartnerAvatar,
  randomPartnerAvatar,
  type PartnerColor,
  type PartnerConfig,
} from "../lib/partner-avatar";

export function AvatarWorkshop({ value, seed, onChange, renderAvatar }: { value: AvatarVariant; seed: string; onChange: (value: AvatarVariant) => void; renderAvatar: (value: AvatarVariant) => ReactNode }) {
  const [part, setPart] = useState<"shape" | "expression" | "color">("shape");
  const parsed = parsePartnerAvatar(value);
  const legacyShape = ABSTRACT_AVATARS.find(shape => shape === value);
  const fallbackShape = legacyShape ?? abstractAvatarFor(seed);
  const config: PartnerConfig = parsed ?? { shape: fallbackShape, expression: "smile", ...defaultPartnerColors(fallbackShape) };
  const activeColor = config.color;
  const choices = part === "shape" ? PARTNER_SHAPE_OPTIONS : part === "expression" ? PARTNER_EXPRESSION_OPTIONS : PARTNER_COLORS;

  return <div className="avatar-customizer">
    <div className="avatar-customizer-preview">
      <div className="avatar-live-preview">{renderAvatar(value)}</div>
      <div><span className="form-label">头像工坊 · 圈圈伙伴</span>{!parsed && !legacyShape && <p>原头像已保留，选一个伙伴开始新搭配。</p>}<div className="avatar-preview-actions"><button type="button" onClick={() => onChange(randomPartnerAvatar(config))}>随机生成</button></div></div>
    </div>
    <div className="avatar-part-controls">
      <div className="avatar-part-tabs" aria-label="头像组合部件">{([ ["shape", "伙伴外观"], ["expression", "表情"], ["color", "颜色"] ] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={part === key} className={part === key ? "selected" : ""} onClick={() => setPart(key)}>{label}</button>)}</div>
      <section className="avatar-option-panel" aria-label={part === "shape" ? "选择伙伴外观" : part === "expression" ? "选择表情" : "选择主体颜色"}>
        <div className="avatar-visual-grid">{Object.entries(choices).map(([key, label]) => {
          let nextConfig: PartnerConfig;
          if (part === "shape") {
            const shape = key as PartnerConfig["shape"];
            nextConfig = { shape, expression: config.expression, ...defaultPartnerColors(shape) };
          } else if (part === "expression") {
            nextConfig = { ...config, expression: key as PartnerConfig["expression"] };
          } else {
            nextConfig = { ...config, color: key as PartnerColor };
          }
          const next = encodePartnerAvatar(nextConfig);
          const selected = part === "shape"
            ? Boolean(parsed || legacyShape) && config.shape === key
            : part === "expression"
              ? config.expression === key
              : activeColor === key;
          return <button type="button" key={key} aria-label={label} aria-pressed={selected} className={`avatar-visual-choice ${selected ? "selected" : ""}`} onClick={() => onChange(next)}>
            {renderAvatar(next)}
          </button>;
        })}</div>
      </section>
    </div>
  </div>;
}
