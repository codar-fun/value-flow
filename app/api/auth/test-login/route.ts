import { attachCookies, sessionCookies } from "@/app/lib/loop";
import { localTestUser } from "@/app/lib/local-test-auth";

// Local-only login using an access token issued by the local loop-backend.
// This route never invents an identity or bypasses loop authorization.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { user?: string };
  const user = localTestUser(body.user || "");
  if (!user) return Response.json({ error: "本地测试用户不可用" }, { status: 404 });

  const response = Response.json({ ok: true, user: user.key }, { headers: { "cache-control": "no-store" } });
  // Deliberately omit a refresh token: static local test tokens must expire
  // instead of becoming a second long-lived credential store in this frontend.
  return attachCookies(response, sessionCookies("", user.accessToken, user.expiresIn));
}
