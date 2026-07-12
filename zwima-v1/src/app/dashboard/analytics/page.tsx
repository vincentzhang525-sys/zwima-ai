import { AnalyticsClient } from "@/components/analytics-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-slate-500">Token usage, cost trends, and performance metrics</p>
      </div>
      <AnalyticsClient />
    </div>
  );
}
