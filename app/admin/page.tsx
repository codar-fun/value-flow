import { notFound } from "next/navigation";
import { adminEnabled } from "@/app/lib/admin-proxy";
import AdminConsole from "./admin-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "流动圈 · 管理员后台", robots: { index: false, follow: false } };

// Only exists when this process was started with FLOW_ADMIN_ENABLED=true.
export default function AdminPage() {
  if (!adminEnabled()) notFound();
  return <AdminConsole />;
}
