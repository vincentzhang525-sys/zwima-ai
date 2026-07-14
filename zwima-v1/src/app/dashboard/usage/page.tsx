import { WorkspaceUsageClient } from "@/components/workspace-usage-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function UsagePage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Usage Analytics</h1>
        <p className="text-sm text-slate-500">Filter, export, and analyze your organization usage</p>
      </div>
      <WorkspaceUsageClient />
    </div>
  );
}
