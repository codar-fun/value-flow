// The public origin of this request. TLS terminates at the proxy, so
// `request.url` is http:// internally — a link built from it would be wrong.
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const host = request.headers.get("x-forwarded-host") || url.host;
  return `${proto || url.protocol.replace(":", "")}://${host}`;
}
