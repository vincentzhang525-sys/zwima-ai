import { TeamClient } from "@/components/team-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TeamPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Enterprise Team</h1>
        <p className="text-sm text-slate-500">Organization members and RBAC permissions</p>
      </div>
      <TeamClient />
    </div>
  );
}
