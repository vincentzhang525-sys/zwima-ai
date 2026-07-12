import { DashboardHomeClient } from "@/components/dashboard-home-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back, {user.companyName || user.email}</p>
      </div>
      <DashboardHomeClient />
    </div>
  );
}
