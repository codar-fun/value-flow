// Pass a loop-backend response through to the browser: the JSON body on
// success, `{error, code}` with the upstream status on failure. Errors are
// never turned into empty data — a failed read must look failed.
export async function relay(res: Response, fallback: string, status?: number): Promise<Response> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string | { message?: string; code?: string; rows?: unknown; fields?: unknown };
  };
  const headers = { "cache-control": "no-store" };
  const error = typeof data.error === "object" ? data.error : undefined;
  if (!res.ok)
    return Response.json(
      { error: res.status === 410 && error?.code === "invalid_invite" ? "邀请不可用，请重新获取。" : typeof data.error === "string" ? data.error : error?.message || fallback, code: error?.code ?? data.code, rows: error?.rows, fields: error?.fields },
      { status: res.status || 502, headers },
    );
  return Response.json(data, { status: status ?? res.status, headers });
}
