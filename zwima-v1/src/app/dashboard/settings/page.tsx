import { AccountDeletionRequestCard } from "@/components/account-deletion-request-card";
import { WorkspaceSettingsClient } from "@/components/workspace-settings-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500">Organization, billing, routing, and alert preferences</p>
      </div>
      <WorkspaceSettingsClient />
      <AccountDeletionRequestCard />
    </div>
  );
}
