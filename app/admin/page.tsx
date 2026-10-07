import { adminEnabled } from "../lib/admin-proxy";
import AdminConsole from "./admin-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "初始积分工作台 · 流动圈", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminConsole enabled={adminEnabled()}/>;
}
