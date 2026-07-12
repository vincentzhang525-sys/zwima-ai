"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { BarChart, DonutChart, LineChart } from "@/components/ui/chart";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { cn, formatCredits } from "@/lib/utils";

type Range = "today" | "7d" | "30d" | "90d";

type Analytics = {
  tokenUsage: number;
  totalCost: number;
  requestCount: number;
  errorRate: number;
  avgLatency: number;
  costTrend: { date: string; cost: number; tokens: number; requests: number }[];
  providerDistribution: { name: string; count: number }[];
  modelDistribution: { name: string; count: number }[];
  requestsPerHour: { hour: number; count: number }[];
};

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
];

export function AnalyticsClient() {
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(r: Range) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/dashboard/analytics?range=${r}`);
    const json = await res.json();
    if (!res.ok) setError(json.error || "Failed");
    else setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load(range);
  }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              range === r.id ? "bg-blue-900 text-white dark:bg-blue-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={() => load(range)} />}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardTitle>Token Usage</CardTitle>
              <p className="mt-2 text-2xl font-bold">{formatCredits(data.tokenUsage)}</p>
            </Card>
            <Card>
              <CardTitle>Total Cost</CardTitle>
              <p className="mt-2 text-2xl font-bold">{formatCredits(data.totalCost)} credits</p>
            </Card>
            <Card>
              <CardTitle>Requests</CardTitle>
              <p className="mt-2 text-2xl font-bold">{data.requestCount}</p>
            </Card>
            <Card>
              <CardTitle>Average Latency</CardTitle>
              <p className="mt-2 text-2xl font-bold">{data.avgLatency}ms</p>
            </Card>
            <Card>
              <CardTitle>Error Rate</CardTitle>
              <p className="mt-2 text-2xl font-bold">{data.errorRate}%</p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle>Cost Trend</CardTitle>
              <div className="mt-4">
                <LineChart data={data.costTrend.map((d) => ({ label: d.date.slice(5), value: d.cost }))} />
              </div>
            </Card>
            <Card>
              <CardTitle>Requests Per Hour</CardTitle>
              <div className="mt-4">
                <BarChart data={data.requestsPerHour.map((h) => ({ label: `${h.hour}h`, value: h.count }))} />
              </div>
            </Card>
            <Card>
              <CardTitle>Provider Distribution</CardTitle>
              <div className="mt-4">
                <DonutChart data={data.providerDistribution.map((p) => ({ label: p.name, value: p.count }))} />
              </div>
            </Card>
            <Card>
              <CardTitle>Model Distribution</CardTitle>
              <div className="mt-4">
                <DonutChart data={data.modelDistribution.map((m) => ({ label: m.name, value: m.count }))} />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
