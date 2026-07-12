"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ProviderRow = {
  slug: string;
  name: string;
  enabled: boolean;
  status: string;
  latencyMs: number | null;
  lastError: string | null;
  lastHealthAt: string | null;
  usageToday: number;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Providers</h1>
          <p className="text-sm text-slate-500">API status, latency, and usage</p>
        </div>
        <Button variant="secondary" onClick={refreshHealth} disabled={loading}>
          Refresh health
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardTitle>API Status</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Latency</th>
                <th className="pb-2 pr-4">Last Error</th>
                <th className="pb-2">Usage Today</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && providers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    No providers configured
                  </td>
                </tr>
              )}
              {providers.map((p) => (
                <tr key={p.slug} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3 pr-4 font-medium">{p.name}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        p.status === "ok"
                          ? "text-green-600"
                          : p.status === "unconfigured"
                            ? "text-amber-600"
                            : "text-red-600"
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{p.latencyMs != null ? `${p.latencyMs}ms` : "—"}</td>
                  <td className="py-3 pr-4 max-w-xs truncate text-slate-500">{p.lastError || "—"}</td>
                  <td className="py-3">{p.usageToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
