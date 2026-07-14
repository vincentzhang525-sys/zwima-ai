"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

type UsageData = {
  summary: {
    requests: number;
    tokens: number;
    credits: number;
    billedAmountEur: number;
    successRate: number;
    errorRate: number;
    averageLatency: number;
    p95Latency: number;
  };
  charts: { hasData: boolean };
  items: {
    id: string;
    timestamp: string;
    requestId: string | null;
    project: string;
    apiKey: string;
    provider: string;
    model: string;
    status: string;
    latencyMs: number | null;
    tokens: number;
    costEur: number;
    routingMode: string;
  }[];
  pagination: { page: number; totalPages: number; total: number };
};

export function WorkspaceUsageClient() {
  const [range, setRange] = useState("7d");
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true);
    const res = await fetch(`/api/workspace/usage?range=${range}&page=${nextPage}`);
    const json = await res.json();
    if (!res.ok) setError(json.error?.message || "Failed");
    else { setData(json); setError(""); }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    setPage(1);
    void load(1);
  }, [load]);

  useEffect(() => {
    if (page === 1) return;
    void load(page);
  }, [page, load]);

  if (loading && !data) return <p className="text-sm text-slate-500">Loading usage…</p>;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {["today", "7d", "30d"].map((r) => (
          <Button key={r} variant={range === r ? "primary" : "secondary"} size="sm" onClick={() => setRange(r)}>
            {r === "today" ? "Today" : r === "7d" ? "7 Days" : "30 Days"}
          </Button>
        ))}
        <a href={`/api/workspace/usage/export?range=${range}`} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700">Export CSV</a>
        <Link href="/dashboard/usage/history" className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700">Legacy Usage Explorer</Link>
      </div>

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardTitle>Requests</CardTitle><p className="mt-2 text-2xl font-bold">{data.summary.requests}</p></Card>
            <Card><CardTitle>Tokens</CardTitle><p className="mt-2 text-2xl font-bold">{data.summary.tokens.toLocaleString()}</p></Card>
            <Card><CardTitle>Billed (EUR)</CardTitle><p className="mt-2 text-2xl font-bold">€{data.summary.billedAmountEur.toFixed(4)}</p></Card>
            <Card><CardTitle>Success Rate</CardTitle><p className="mt-2 text-2xl font-bold">{data.summary.successRate}%</p></Card>
          </div>

          {!data.charts.hasData ? (
            <EmptyState title="No usage data yet" />
          ) : (
            <Card>
              <CardTitle>Usage Details</CardTitle>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="pb-2 pr-2">Time</th>
                      <th className="pb-2 pr-2">Project</th>
                      <th className="pb-2 pr-2">Provider</th>
                      <th className="pb-2 pr-2">Model</th>
                      <th className="pb-2 pr-2">Status</th>
                      <th className="pb-2 pr-2">Latency</th>
                      <th className="pb-2 pr-2">Cost</th>
                      <th className="pb-2">Routing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-2">{new Date(row.timestamp).toLocaleString()}</td>
                        <td className="py-2 pr-2">{row.project}</td>
                        <td className="py-2 pr-2">{row.provider}</td>
                        <td className="py-2 pr-2">{row.model}</td>
                        <td className="py-2 pr-2">{row.status}</td>
                        <td className="py-2 pr-2">{row.latencyMs ?? "—"}ms</td>
                        <td className="py-2 pr-2">€{row.costEur.toFixed(4)}</td>
                        <td className="py-2">{row.routingMode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span className="self-center text-sm text-slate-500">Page {data.pagination.page} / {data.pagination.totalPages}</span>
                <Button size="sm" variant="secondary" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
