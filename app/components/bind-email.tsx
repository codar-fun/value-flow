"use client";

import { useEffect, useState } from "react";

// Ask a phone-only account whether to attach an email. Binding an email that
// already belongs to a flow account merges that account into this one.
export function BindEmail({
  variant,
  onBound,
  onSkip,
}: {
  variant: "prompt" | "inline";
  onBound: (merged: boolean) => void | Promise<void>;
  onSkip?: () => void;
}) {
  const [hint, setHint] = useState<string | null | undefined>(undefined);
  const [mode, setMode] = useState<"ask" | "other">("ask");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/email-hint", { cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() as { email?: string | null } : null))
      .then((data) => {
        if (!active) return;
        if (data?.email) {
          setHint(data.email);
          setMode("ask");
        } else {
          setHint(null);
          setMode("other");
        }
      })
      .catch(() => {
        if (!active) return;
        setHint(null);
        setMode("other");
      });
    return () => { active = false; };
  }, []);

  async function bind(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/email/bind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; merged?: boolean };
      if (!response.ok) throw new Error(data.error || "绑定失败");
      await onBound(data.merged === true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "绑定失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (!email.trim()) { setError("请填写邮箱"); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "发送验证码失败");
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发送验证码失败");
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    try { await fetch("/api/auth/email-hint", { method: "DELETE" }); }
    finally {
      setBusy(false);
      onSkip?.();
    }
  }

  return <section className="bind-email">
    <p className="account-hint">
      {variant === "prompt" ? "要不要绑定邮箱？" : "绑定邮箱"}
      如果这个邮箱已经有流动圈账号，会合并到当前这个手机号账号。
    </p>
    {error && <p className="account-error" role="alert">{error}</p>}
    {hint && mode === "ask" && <>
      <p className="account-hint">{hint}</p>
      <button className="primary-button" type="button" onClick={() => void bind({})} disabled={busy}>
        {busy ? "正在绑定…" : "绑定这个邮箱"}
      </button>
      <button className="text-link" type="button" onClick={() => { setMode("other"); setError(""); }} disabled={busy}>使用其他邮箱</button>
    </>}
    {mode === "other" && hint !== undefined && <div className="account-form">
      <label><span>邮箱</span><input type="email" value={email} autoComplete="email" placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)}/></label>
      {sent && <label><span>验证码</span><input inputMode="numeric" value={code} placeholder="6 位验证码" onChange={(event) => setCode(event.target.value)}/></label>}
      {sent
        ? <button className="primary-button" type="button" onClick={() => void bind({ email: email.trim(), code: code.trim() })} disabled={busy}>{busy ? "正在绑定…" : "绑定这个邮箱"}</button>
        : <button className="primary-button" type="button" onClick={() => void sendCode()} disabled={busy}>{busy ? "发送中…" : "发送验证码"}</button>}
      {hint && <button className="text-link" type="button" onClick={() => { setMode("ask"); setError(""); }} disabled={busy}>改回 {hint}</button>}
    </div>}
    {variant === "prompt" && <button className="text-link" type="button" onClick={() => void skip()} disabled={busy}>暂时跳过</button>}
  </section>;
}
