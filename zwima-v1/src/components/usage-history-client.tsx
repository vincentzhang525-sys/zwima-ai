"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonTable } from "@/components/ui/skeleton";

type Log = {
  id: string;
  time: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number | null;
  success: boolean;
  apiKey: string | null;
};

export function UsageHistoryClient() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (provider) params.set("provider", provider);
    if (model) params.set("model", model);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/usage/history?${params}`);
    const data = await res.json();
    if (!res.ok) setError(data.error || "Failed");
    else setLogs(data.logs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (provider) params.set("provider", provider);
    if (model) params.set("model", model);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    window.open(`/api/usage/history?${params}&export=csv`, "_blank");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Filters</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Search</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Model or error" />
          </div>
          <div>
            <Label>Provider</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="openai" />
          </div>
          <div>
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-5" />
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={load}>Search</Button>
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={load} />}

      <Card>
        <CardTitle>Usage History</CardTitle>
        {loading ? (
          <div className="mt-4">
            <SkeletonTable rows={8} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No usage records" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Provider</th>
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4">Tokens</th>
                  <th className="pb-2 pr-4">Cost</th>
                  <th className="pb-2 pr-4">Latency</th>
                  <th className="pb-2">Key</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4">{new Date(l.time).toLocaleString()}</td>
                    <td className="py-2 pr-4">{l.provider}</td>
                    <td className="py-2 pr-4">{l.model}</td>
                    <td className="py-2 pr-4">
                      {l.inputTokens}+{l.outputTokens}
                    </td>
                    <td className="py-2 pr-4">{l.cost}</td>
                    <td className="py-2 pr-4">{l.latencyMs != null ? `${l.latencyMs}ms` : "—"}</td>
                    <td className="py-2">{l.apiKey ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
