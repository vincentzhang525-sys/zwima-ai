"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Package = { id: string; label: string; amountEur: string; credits: number };

export function BillingClient() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const [packages, setPackages] = useState<Package[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/packages")
      .then((r) => r.json())
      .then((d) => setPackages(d.packages ?? []))
      .catch(() =>
        setPackages([
          { id: "p10", label: "€10", amountEur: "10", credits: 10000 },
          { id: "p25", label: "€25", amountEur: "25", credits: 26000 },
        ])
      );
  }, []);

  async function checkout(packageId: string) {
    setLoading(packageId);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId, couponCode: couponCode || undefined }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else if (data.ok) window.location.href = "/dashboard/billing?success=1";
    else alert(data.error || "Checkout failed");
    setLoading(null);
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">
          Payment successful — credits added and invoice generated.
        </div>
      )}

      <Card>
        <CardTitle>Payment Methods</CardTitle>
        <p className="mt-2 text-sm text-slate-500">Stripe Checkout — Visa, Mastercard, Apple Pay, Google Pay</p>
        <div className="mt-4">
          <Input placeholder="Coupon code (optional)" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <Card key={pkg.id}>
            <CardTitle>{pkg.label}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{pkg.credits.toLocaleString()} credits</p>
            <Button className="mt-4 w-full" onClick={() => checkout(pkg.id)} disabled={loading === pkg.id}>
              {loading === pkg.id ? "Redirecting…" : "Recharge"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
