import { WorkspaceApiKeysClient } from "@/components/workspace-api-keys-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ApiKeysPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h1>
        <p className="text-sm text-slate-500">Create, rotate, and manage API keys with project scoping</p>
      </div>
      <WorkspaceApiKeysClient />
    </div>
  );
}
