import { Suspense } from "react";
import { WorkspaceBillingClient } from "@/components/workspace-billing-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Billing Center</h1>
        <p className="text-sm text-slate-500">Credits, invoices, and billing profile</p>
      </div>
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
        <WorkspaceBillingClient />
      </Suspense>
    </div>
  );
}
