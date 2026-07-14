"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { DonutChart } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { formatCost } from "@/lib/utils";

type Overview = {
  creditBalance: number;
  todayRequests: number;
  todayTokens: number;
  todayCostEur: number;
  monthCostEur: number;
  activeApiKeys: number;
  activeProjects: number;
  successRate: number;
  averageLatency: number;
  usageTrend: { date: string; requests: number; tokens: number; costCredits: number }[];
  hasUsageData: boolean;
  recentRequests: {
    id: string;
    time: string;
    provider: string;
    model: string;
    costEur: number;
    latencyMs: number | null;
    success: boolean;
  }[];
  recentBilling: {
    id: string;
    type: string;
    amountEur: number;
    credits: number;
    description: string | null;
    createdAt: string;
  }[];
  providerDistribution: { provider: string; credits: number; requests: number }[];
  modelDistribution: { model: string; credits: number; requests: number }[];
  alerts: string[];
};

export function WorkspaceOverviewClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/workspace/overview");
    const json = await res.json();
    if (!res.ok) setError(json.error?.message || "Failed to load");
    else setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonTable />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {data.alerts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {data.alerts.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardTitle>Credit Balance</CardTitle><p className="mt-2 text-2xl font-bold">{formatCost(data.creditBalance)}</p></Card>
        <Card><CardTitle>Today Requests</CardTitle><p className="mt-2 text-2xl font-bold">{data.todayRequests}</p></Card>
        <Card><CardTitle>Today Tokens</CardTitle><p className="mt-2 text-2xl font-bold">{data.todayTokens.toLocaleString()}</p></Card>
        <Card><CardTitle>Today Cost</CardTitle><p className="mt-2 text-2xl font-bold">€{data.todayCostEur.toFixed(4)}</p></Card>
        <Card><CardTitle>Month Cost</CardTitle><p className="mt-2 text-2xl font-bold">€{data.monthCostEur.toFixed(4)}</p></Card>
        <Card><CardTitle>Active API Keys</CardTitle><p className="mt-2 text-2xl font-bold">{data.activeApiKeys}</p></Card>
        <Card><CardTitle>Active Projects</CardTitle><p className="mt-2 text-2xl font-bold">{data.activeProjects}</p></Card>
        <Card><CardTitle>Success Rate</CardTitle><p className="mt-2 text-2xl font-bold">{data.successRate}%</p></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Average Latency</CardTitle>
          <p className="mt-2 text-3xl font-bold">{data.averageLatency}ms</p>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>7-Day Usage Trend</CardTitle>
          {!data.hasUsageData ? (
            <EmptyState title="No usage data yet" description="Start using the API Playground or your API keys." />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Requests</th>
                    <th className="pb-2">Tokens</th>
                    <th className="pb-2">Cost (EUR)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.usageTrend.map((row) => (
                    <tr key={row.date} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{new Date(row.date).toLocaleDateString()}</td>
                      <td className="py-2">{row.requests}</td>
                      <td className="py-2">{row.tokens}</td>
                      <td className="py-2">€{(row.costCredits / 1000).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Provider Distribution</CardTitle>
          {data.providerDistribution.length === 0 ? (
            <EmptyState title="No usage data yet" />
          ) : (
            <DonutChart data={data.providerDistribution.map((p) => ({ label: p.provider, value: p.credits || p.requests }))} />
          )}
        </Card>
        <Card>
          <CardTitle>Model Distribution</CardTitle>
          {data.modelDistribution.length === 0 ? (
            <EmptyState title="No usage data yet" />
          ) : (
            <DonutChart data={data.modelDistribution.map((m) => ({ label: m.model, value: m.credits || m.requests }))} />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Recent API Requests</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Provider</th>
                  <th className="pb-2 pr-3">Model</th>
                  <th className="pb-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRequests.length === 0 && (
                  <tr><td colSpan={4}><EmptyState title="No requests yet" /></td></tr>
                )}
                {data.recentRequests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3">{new Date(r.time).toLocaleString()}</td>
                    <td className="py-2 pr-3">{r.provider}</td>
                    <td className="py-2 pr-3">{r.model}</td>
                    <td className="py-2">€{r.costEur.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardTitle>Recent Billing</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBilling.length === 0 && (
                  <tr><td colSpan={3}><EmptyState title="No billing records yet" /></td></tr>
                )}
                {data.recentBilling.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">{b.type}</td>
                    <td className="py-2">€{b.amountEur.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
