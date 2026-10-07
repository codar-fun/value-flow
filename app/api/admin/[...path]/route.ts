import { proxyAdmin } from "@/app/lib/admin-proxy";

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Ctx) { return proxyAdmin(request, (await params).path); }
export async function POST(request: Request, { params }: Ctx) { return proxyAdmin(request, (await params).path); }
export async function DELETE(request: Request, { params }: Ctx) { return proxyAdmin(request, (await params).path); }
