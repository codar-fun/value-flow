import { readCookie } from "@/app/lib/loop";
import { requestOrigin } from "@/app/lib/origin";
import { EMAIL_HINT_COOKIE, EMAIL_TICKET_COOKIE, clearEmailHint } from "@/app/lib/juluo-oauth";

// GET /api/auth/email-hint — the verified 聚落 email offered after phone login.
// DELETE clears it when the person skips or finishes binding.
export async function GET(request: Request) {
  const email = readCookie(request, EMAIL_HINT_COOKIE);
  const ticket = readCookie(request, EMAIL_TICKET_COOKIE);
  if (!email || !ticket) return Response.json({ email: null });
  return Response.json({ email });
}

export async function DELETE(request: Request) {
  const secure = requestOrigin(request).startsWith("https:");
  return clearEmailHint(new Response(null, { status: 204 }), secure);
}
