import { AdminConsoleClient } from "@/components/admin-console-client";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function AdminConsolePage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Console</h1>
        <p className="text-sm text-slate-500">Manage customers, billing, and platform configuration</p>
      </div>
      <AdminConsoleClient />
    </div>
  );
}
