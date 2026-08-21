import { json } from "../../../../db/runtime";
import { localTestUsers } from "@/app/lib/local-test-auth";

// Local-only discovery for the configured, backend-issued test sessions.
export function GET() {
  const users = localTestUsers();
  if (!users.length) return json({ enabled: false, users: [] }, { status: 404 });
  return json({
    enabled: true,
    users: users.map(({ key, label }) => ({ key, label })),
  });
}
