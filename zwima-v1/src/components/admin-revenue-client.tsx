"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";

type Revenue = {
  revenueToday: number;
  revenueMonth: number;
  mrr: number;
  arr: number;
  providerCost: number;
  grossMargin: number;
  netMargin: number;
  topCustomers: { user?: { email: string; companyName: string | null }; amountEur: number; credits: number }[];
};

export function AdminRevenueClient() {
  const [data, setData] = useState<Revenue | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/revenue")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Failed to load"));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
        <p className="text-sm text-slate-500">Commercial metrics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardTitle>Revenue Today</CardTitle><p className="mt-2 text-2xl font-bold">€{data.revenueToday.toFixed(2)}</p></Card>
        <Card><CardTitle>Revenue Month</CardTitle><p className="mt-2 text-2xl font-bold">€{data.revenueMonth.toFixed(2)}</p></Card>
        <Card><CardTitle>MRR</CardTitle><p className="mt-2 text-2xl font-bold">€{data.mrr.toFixed(2)}</p></Card>
        <Card><CardTitle>ARR</CardTitle><p className="mt-2 text-2xl font-bold">€{data.arr.toFixed(2)}</p></Card>
        <Card><CardTitle>Provider Cost</CardTitle><p className="mt-2 text-2xl font-bold">{data.providerCost.toFixed(2)}</p></Card>
        <Card><CardTitle>Gross Margin</CardTitle><p className="mt-2 text-2xl font-bold">{data.grossMargin}%</p></Card>
        <Card><CardTitle>Net Margin</CardTitle><p className="mt-2 text-2xl font-bold">{data.netMargin}%</p></Card>
      </div>

      <Card>
        <CardTitle>Top Customers</CardTitle>
        <div className="mt-4 space-y-2 text-sm">
          {data.topCustomers.map((c, i) => (
            <div key={i} className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800">
              <span>{c.user?.companyName || c.user?.email || "—"}</span>
              <span>€{c.amountEur.toFixed(2)} · {c.credits.toLocaleString()} credits</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
