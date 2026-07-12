import { UsageHistoryClient } from "@/components/usage-history-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function UsageHistoryPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Usage Explorer</h1>
        <p className="text-sm text-slate-500">Search and export API usage history</p>
      </div>
      <UsageHistoryClient />
    </div>
  );
}
