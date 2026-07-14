import { WorkspaceLogsClient } from "@/components/workspace-logs-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LogsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Request Logs</h1>
        <p className="text-sm text-slate-500">Routing decisions, failover, and sanitized request metadata</p>
      </div>
      <WorkspaceLogsClient />
    </div>
  );
}
