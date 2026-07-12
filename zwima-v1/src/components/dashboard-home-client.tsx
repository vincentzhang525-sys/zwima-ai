"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { DonutChart } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { formatCredits } from "@/lib/utils";

type Stats = {
  balance: number;
  available: number;
  todayRequests: number;
  todayCredits: number;
  monthRequests: number;
  monthCredits: number;
  activeKeys: number;
  currentPlan: string;
  costSaved: number;
  providerDistribution: { provider: string; credits: number; requests: number }[];
  recentRequests: { id: string; time: string; provider: string; model: string; cost: number; latencyMs: number | null; success: boolean }[];
};

export function DashboardHomeClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/dashboard/stats");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load");
    } else {
      setStats(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonTable />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>Current Balance</CardTitle>
          <p className="mt-2 text-3xl font-bold">{formatCredits(stats.balance)}</p>
          <p className="text-sm text-slate-500">{formatCredits(stats.available)} available</p>
        </Card>
        <Card>
          <CardTitle>Today Usage</CardTitle>
          <p className="mt-2 text-3xl font-bold">{formatCredits(stats.todayCredits)}</p>
          <p className="text-sm text-slate-500">{stats.todayRequests} requests</p>
        </Card>
        <Card>
          <CardTitle>Monthly Usage</CardTitle>
          <p className="mt-2 text-3xl font-bold">{formatCredits(stats.monthCredits)}</p>
          <p className="text-sm text-slate-500">{stats.monthRequests} requests</p>
        </Card>
        <Card>
          <CardTitle>Current Plan</CardTitle>
          <p className="mt-2 text-3xl font-bold">{stats.currentPlan}</p>
          <p className="text-sm text-slate-500">{stats.activeKeys} active API keys</p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Cost Saved</CardTitle>
          <p className="mt-2 text-3xl font-bold text-green-600">{formatCredits(stats.costSaved)}</p>
          <p className="text-sm text-slate-500">Estimated vs direct provider pricing</p>
        </Card>
        <Card>
          <CardTitle>Provider Distribution</CardTitle>
          <div className="mt-4">
            {stats.providerDistribution.length === 0 ? (
              <EmptyState title="No usage yet" />
            ) : (
              <DonutChart
                data={stats.providerDistribution.map((p) => ({ label: p.provider, value: p.credits || p.requests }))}
              />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Recent Requests</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4">Model</th>
                <th className="pb-2 pr-4">Cost</th>
                <th className="pb-2 pr-4">Latency</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentRequests.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No requests yet" description="Use the API Playground or your API keys to get started." />
                  </td>
                </tr>
              )}
              {stats.recentRequests.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-4">{new Date(r.time).toLocaleString()}</td>
                  <td className="py-2 pr-4">{r.provider}</td>
                  <td className="py-2 pr-4">{r.model}</td>
                  <td className="py-2 pr-4">{r.cost}</td>
                  <td className="py-2 pr-4">{r.latencyMs != null ? `${r.latencyMs}ms` : "—"}</td>
                  <td className={`py-2 ${r.success ? "text-green-600" : "text-red-600"}`}>{r.success ? "OK" : "Error"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
