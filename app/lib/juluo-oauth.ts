// 聚落 authorization-code + PKCE helpers for the value-flow redirect host.
// The client secret never comes here: the backend redeems the code.

const OAUTH_COOKIE = "flow_oauth";
export const EMAIL_HINT_COOKIE = "loop_email_hint";
export const EMAIL_TICKET_COOKIE = "loop_email_ticket";

export function allowedAppOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.username || url.password) return false;
    if (url.hostname === "flow.sola.day") return url.protocol === "https:";
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return url.protocol === "http:" || url.protocol === "https:";
    }
    return false;
  } catch {
    return false;
  }
}

export function randomUrlSafe(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64url(buffer);
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function oauthCookie(value: string, maxAge: number, secure: boolean): string {
  return cookieHeader(OAUTH_COOKIE, value, maxAge, secure, "/auth");
}

export function hintCookie(name: string, value: string, maxAge: number, secure: boolean): string {
  return cookieHeader(name, value, maxAge, secure, "/");
}

export function clearEmailHint(response: Response, secure: boolean): Response {
  const headers = new Headers(response.headers);
  headers.append("set-cookie", hintCookie(EMAIL_HINT_COOKIE, "", 0, secure));
  headers.append("set-cookie", hintCookie(EMAIL_TICKET_COOKIE, "", 0, secure));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cookieHeader(name: string, value: string, maxAge: number, secure: boolean, path: string): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
