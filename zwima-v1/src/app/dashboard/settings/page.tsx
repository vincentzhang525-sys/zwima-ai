import { currentUser } from "@clerk/nextjs/server";
import { Card, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");
  const clerkUser = await currentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500">Account preferences</p>
      </div>
      <Card>
        <CardTitle>Profile</CardTitle>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Company</dt>
            <dd>{user.companyName || "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Country</dt>
            <dd>{user.country || "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Email verified</dt>
            <dd>{clerkUser?.emailAddresses[0]?.verification?.status === "verified" ? "Yes" : "Pending"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
