import { proxyAdmin } from "@/app/lib/admin-proxy";

async function handle(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyAdmin(request, (await params).path);
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
