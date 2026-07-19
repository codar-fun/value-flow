import { LOOP_API_BASE, attachCookies, clearedCookies, refreshToken } from "@/app/lib/loop";

// POST /api/auth/logout — revoke the session on loop-backend and clear cookies.
export async function POST(request: Request) {
  const rt = refreshToken(request);

  if (rt) {
    await fetch(`${LOOP_API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    }).catch(() => {});
  }

  return attachCookies(Response.json({ ok: true }), clearedCookies());
}
