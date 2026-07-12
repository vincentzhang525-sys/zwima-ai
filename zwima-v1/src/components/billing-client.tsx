"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { CREDIT_PACKAGES } from "@/lib/stripe";

export function BillingClient() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(packageId: string) {
    setLoading(packageId);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error || "Checkout failed");
    setLoading(null);
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">
          Payment successful — credits will be added shortly.
        </div>
      )}

      <Card>
        <CardTitle>Payment Methods</CardTitle>
        <p className="mt-2 text-sm text-slate-500">
          Stripe Checkout supports Visa, Mastercard, Apple Pay, and Google Pay.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Visa", "Mastercard", "Apple Pay", "Google Pay"].map((m) => (
            <span key={m} className="rounded-full border border-slate-200 px-3 py-1 text-xs dark:border-slate-700">
              {m}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {CREDIT_PACKAGES.map((pkg) => (
          <Card key={pkg.id}>
            <CardTitle>{pkg.label}</CardTitle>
            <Button className="mt-4 w-full" onClick={() => checkout(pkg.id)} disabled={loading === pkg.id}>
              {loading === pkg.id ? "Redirecting…" : "Buy credits"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
