import { NotificationsPageClient } from "@/components/notifications-page-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
        <p className="text-sm text-slate-500">Low balance, payments, API errors, and more</p>
      </div>
      <NotificationsPageClient />
    </div>
  );
}
