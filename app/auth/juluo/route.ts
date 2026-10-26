import { runtimeEnv } from "@/app/lib/loop";
import { requestOrigin } from "@/app/lib/origin";
import { allowedAppOrigin, codeChallenge, oauthCookie, randomUrlSafe } from "@/app/lib/juluo-oauth";

// GET /auth/juluo — start 聚落 login. The verifier stays in an HttpOnly cookie
// because this app has no database of its own.
export async function GET(request: Request) {
  const origin = requestOrigin(request);
  if (!allowedAppOrigin(origin)) {
    return Response.json({ error: "不允许从这个地址登录" }, { status: 400 });
  }

  const clientId = runtimeEnv("JULUO_OAUTH_CLIENT_ID");
  if (!clientId) {
    return new Response(null, {
      status: 302,
      headers: { location: `${origin}/?login_error=juluo_not_configured`, "cache-control": "no-store" },
    });
  }

  const issuer = (runtimeEnv("JULUO_OAUTH_ISSUER") || "https://api.juluo.xyz").replace(/\/$/, "");
  const state = randomUrlSafe();
  const verifier = randomUrlSafe();
  const challenge = await codeChallenge(verifier);
  const redirectUri = `${origin}/auth/callback`;
  const authorize = new URL(`${issuer}/oauth/authorize`);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid profile email phone");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  const headers = new Headers({ location: authorize.toString(), "cache-control": "no-store" });
  headers.append(
    "set-cookie",
    oauthCookie(JSON.stringify({ state, verifier }), 600, origin.startsWith("https:")),
  );
  return new Response(null, { status: 302, headers });
}
