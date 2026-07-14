"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

type BillingData = {
  currentCredits: number;
  currentCreditsEur: number;
  currentMonthUsageEur: number;
  currentMonthAmount?: number;
  checkoutDisabled: boolean;
  checkoutMessage: string | null;
  creditTransactions: { id: string; type: string; amountEur: number; credits: number; description: string | null; createdAt: string }[];
  paymentHistory: { id: string; status: string; amountEur: number; credits: number; createdAt: string }[];
  billingProfile: { companyName: string; vatId: string; country: string; currency: string };
};

type Invoice = { id: string; invoiceNumber: string; totalEur: number; paid: boolean; createdAt: string; hasDownload: boolean };

export function WorkspaceBillingClient() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [billingRes, invoicesRes] = await Promise.all([
      fetch("/api/workspace/billing"),
      fetch("/api/workspace/invoices"),
    ]);
    const billingData = await billingRes.json();
    const invoicesData = await invoicesRes.json();
    if (!billingRes.ok) setError(billingData.error?.message || "Failed");
    else { setBilling(billingData); setInvoices(invoicesData.invoices ?? []); setError(""); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading billing…</p>;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!billing) return null;

  return (
    <div className="space-y-6">
      {billing.checkoutDisabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30">
          {billing.checkoutMessage ?? "Payments are temporarily unavailable in Preview"}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardTitle>Current Credits</CardTitle><p className="mt-2 text-2xl font-bold">€{billing.currentCreditsEur.toFixed(4)}</p></Card>
        <Card><CardTitle>Month Usage</CardTitle><p className="mt-2 text-2xl font-bold">€{billing.currentMonthUsageEur.toFixed(4)}</p></Card>
        <Card><CardTitle>Currency</CardTitle><p className="mt-2 text-2xl font-bold">{billing.billingProfile.currency}</p></Card>
      </div>

      <Card>
        <CardTitle>Billing Profile</CardTitle>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Company</dt><dd>{billing.billingProfile.companyName || "—"}</dd></div>
          <div><dt className="text-slate-500">VAT ID</dt><dd>{billing.billingProfile.vatId || "—"}</dd></div>
          <div><dt className="text-slate-500">Country</dt><dd>{billing.billingProfile.country || "—"}</dd></div>
        </dl>
        <div className="mt-4 flex gap-2">
          <Button disabled={billing.checkoutDisabled}>Recharge (disabled in Preview)</Button>
          <Link href="/dashboard/invoices" className="inline-flex h-11 items-center rounded-lg border border-slate-200 px-5 text-sm dark:border-slate-700">Legacy Invoices</Link>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Credit Transactions</CardTitle>
          {billing.creditTransactions.length === 0 ? (
            <EmptyState title="No transactions yet" />
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {billing.creditTransactions.map((t) => (
                <li key={t.id} className="flex justify-between border-b py-2">
                  <span>{new Date(t.createdAt).toLocaleString()} · {t.type}</span>
                  <span>€{t.amountEur.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Invoices</CardTitle>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between border-b py-2">
                  <span>{inv.invoiceNumber} · {new Date(inv.createdAt).toLocaleDateString()}</span>
                  <span>€{inv.totalEur.toFixed(2)} {inv.paid ? "Paid" : "Unpaid"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
