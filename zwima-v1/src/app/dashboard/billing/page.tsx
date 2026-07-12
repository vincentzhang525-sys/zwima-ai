import { Suspense } from "react";
import { BillingClient } from "@/components/billing-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Billing</h1>
        <p className="text-sm text-slate-500">Recharge credits via Stripe Checkout</p>
      </div>
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
        <BillingClient />
      </Suspense>
    </div>
  );
}
