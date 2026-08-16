// Lightweight liveness endpoint for the proxy health check.
export function GET() {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
