"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonTable } from "@/components/ui/skeleton";

type ProviderRow = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  weight: number;
  priority: number;
  status: string;
  latencyMs: number | null;
  lastError: string | null;
  usageToday: number;
  errorRate: number;
  dailyCost: number;
  dailyRevenue: number;
  margin: number;
};

export function ProvidersAdminClient() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/providers");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load providers");
      setProviders([]);
    } else {
      setProviders(data.providers || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function refreshHealth() {
    await fetch("/api/v1/health");
    await load();
  }

  async function updateProvider(slug: string, patch: Partial<ProviderRow>) {
    await fetch("/api/admin/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...patch }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Provider Monitor</h1>
          <p className="text-sm text-slate-500">Health, cost, revenue, and routing controls</p>
        </div>
        <Button variant="secondary" onClick={refreshHealth} disabled={loading}>
          Refresh health
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      <Card>
        <CardTitle>Providers</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Requests</th>
                <th className="pb-2 pr-4">Error Rate</th>
                <th className="pb-2 pr-4">Latency</th>
                <th className="pb-2 pr-4">Daily Cost</th>
                <th className="pb-2 pr-4">Revenue</th>
                <th className="pb-2 pr-4">Margin</th>
                <th className="pb-2 pr-4">Weight</th>
                <th className="pb-2">Priority</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10}>
                    <SkeletonTable rows={5} />
                  </td>
                </tr>
              )}
              {!loading && providers.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-4 text-slate-500">
                    No providers configured
                  </td>
                </tr>
              )}
              {providers.map((p) => (
                <tr key={p.slug} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{p.name}</div>
                    <Button variant="secondary" size="sm" className="mt-1" onClick={() => updateProvider(p.slug, { enabled: !p.enabled })}>
                      {p.enabled ? "Disable" : "Enable"}
                    </Button>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={p.status === "ok" ? "text-green-600" : p.status === "unconfigured" ? "text-amber-600" : "text-red-600"}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{p.usageToday}</td>
                  <td className="py-3 pr-4">{p.errorRate}%</td>
                  <td className="py-3 pr-4">{p.latencyMs != null ? `${p.latencyMs}ms` : "—"}</td>
                  <td className="py-3 pr-4">€{p.dailyCost.toFixed(4)}</td>
                  <td className="py-3 pr-4">€{p.dailyRevenue.toFixed(4)}</td>
                  <td className="py-3 pr-4">{p.margin}%</td>
                  <td className="py-3 pr-4">
                    <Input
                      type="number"
                      className="w-20"
                      defaultValue={p.weight}
                      onBlur={(e) => updateProvider(p.slug, { weight: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-3">
                    <Input
                      type="number"
                      className="w-20"
                      defaultValue={p.priority}
                      onBlur={(e) => updateProvider(p.slug, { priority: Number(e.target.value) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
