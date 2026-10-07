// Pass a loop-backend response through to the browser: the JSON body on
// success, `{error, code}` with the upstream status on failure. Errors are
// never turned into empty data — a failed read must look failed.
export async function relay(res: Response, fallback: string, status?: number): Promise<Response> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string; code?: string; rows?: unknown; fields?: unknown };
  };
  const headers = { "cache-control": "no-store" };
  if (!res.ok)
    return Response.json(
      { error: data.error?.message || fallback, code: data.error?.code, rows: data.error?.rows, fields: data.error?.fields },
      { status: res.status || 502, headers },
    );
  return Response.json(data, { status: status ?? res.status, headers });
}
