"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";

type Overview = {
  requestsToday: number;
  averageCost: number;
  averageLatency: number;
  successRate: number;
  fallbackRate: number;
  estimatedSavings: number;
  activeProviders: number;
  euCompliantRequests: number;
  providerStats: Array<{
    slug: string;
    status: string;
    priority: number;
    weight: number;
    successRate: number;
    latencyP50: number | null;
    costToday: number;
    requestsToday: number;
    selectedPct: number;
  }>;
};

type DecisionRow = {
  id: string;
  requestId: string;
  selectedProvider: string;
  selectedModel: string;
  mode: string;
  cost: number;
  score: number;
  reason: string;
  createdAt: string;
  detail?: Record<string, unknown>;
};

const MODES = ["BALANCED", "LOWEST_COST", "LOWEST_LATENCY", "HIGHEST_QUALITY", "EU_COMPLIANCE"];

export function RoutingAdminClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<DecisionRow | null>(null);
  const [policy, setPolicy] = useState<Record<string, unknown>>({ optimizationMode: "BALANCED", euOnly: false, allowFallback: true, maxFallbackAttempts: 2 });
  const [error, setError] = useState("");
  const [sim, setSim] = useState({
    model: "gemini-2.5-flash",
    capability: "chat",
    inputTokens: "500",
    outputTokens: "1024",
    region: "EU",
    optimizationMode: "BALANCED",
    streaming: false,
    euOnly: false,
  });
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setError("");
    const [oRes, dRes, pRes] = await Promise.all([
      fetch("/api/admin/routing/overview"),
      fetch("/api/admin/routing/decisions?limit=20"),
      fetch("/api/admin/routing/policies"),
    ]);
    const o = await oRes.json();
    const d = await dRes.json();
    const p = await pRes.json();
    if (oRes.ok) setOverview(o);
    if (dRes.ok) setDecisions(d.items || []);
    if (pRes.ok) setPolicy((prev) => p.systemPolicy || prev);
    if (!oRes.ok) setError(o.error || "Failed to load");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runSimulate() {
    const res = await fetch("/api/admin/routing/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: "smart",
        model: sim.model,
        capability: sim.capability,
        inputTokens: Number(sim.inputTokens),
        outputTokens: Number(sim.outputTokens),
        region: sim.region,
        optimizationMode: sim.optimizationMode,
        streaming: sim.streaming,
        euOnly: sim.euOnly,
      }),
    });
    setSimResult(await res.json());
  }

  async function savePolicy() {
    await fetch("/api/admin/routing/policies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy }),
    });
    load();
  }

  if (error && !overview) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Smart Routing Engine V1</h1>
        <p className="text-sm text-slate-500">Explainable, configurable routing with failover — simulator charges no credits.</p>
      </div>

      {overview && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Routing Overview</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4"><CardTitle className="text-sm">Requests Today</CardTitle><p className="mt-2 text-2xl font-bold">{overview.requestsToday}</p></Card>
            <Card className="p-4"><CardTitle className="text-sm">Avg Cost</CardTitle><p className="mt-2 text-2xl font-bold">€{overview.averageCost.toFixed(4)}</p></Card>
            <Card className="p-4"><CardTitle className="text-sm">Avg Latency</CardTitle><p className="mt-2 text-2xl font-bold">{overview.averageLatency}ms</p></Card>
            <Card className="p-4"><CardTitle className="text-sm">Success Rate</CardTitle><p className="mt-2 text-2xl font-bold">{overview.successRate}%</p></Card>
            <Card className="p-4"><CardTitle className="text-sm">Fallback Rate</CardTitle><p className="mt-2 text-2xl font-bold">{overview.fallbackRate}%</p></Card>
            <Card className="p-4"><CardTitle className="text-sm">Est. Savings</CardTitle><p className="mt-2 text-2xl font-bold">€{overview.estimatedSavings.toFixed(2)}</p></Card>
            <Card className="p-4"><CardTitle className="text-sm">Active Providers</CardTitle><p className="mt-2 text-2xl font-bold">{overview.activeProviders}</p></Card>
            <Card className="p-4"><CardTitle className="text-sm">EU Requests</CardTitle><p className="mt-2 text-2xl font-bold">{overview.euCompliantRequests}</p></Card>
          </div>
        </section>
      )}

      {overview && (
        <Card>
          <CardTitle>Provider Routing Table</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-3">Provider</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Priority</th>
                  <th className="pb-2 pr-3">Weight</th>
                  <th className="pb-2 pr-3">Success</th>
                  <th className="pb-2 pr-3">P50</th>
                  <th className="pb-2 pr-3">Cost Today</th>
                  <th className="pb-2 pr-3">Requests</th>
                  <th className="pb-2">Selected %</th>
                </tr>
              </thead>
              <tbody>
                {overview.providerStats.map((p) => (
                  <tr key={p.slug} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 font-mono">{p.slug}</td>
                    <td className="py-2 pr-3">{p.status}</td>
                    <td className="py-2 pr-3">{p.priority}</td>
                    <td className="py-2 pr-3">{p.weight}</td>
                    <td className="py-2 pr-3">{p.successRate}%</td>
                    <td className="py-2 pr-3">{p.latencyP50 ?? "—"}</td>
                    <td className="py-2 pr-3">€{p.costToday.toFixed(2)}</td>
                    <td className="py-2 pr-3">{p.requestsToday}</td>
                    <td className="py-2">{p.selectedPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Decision Explorer</CardTitle>
          <div className="mt-4 max-h-64 overflow-y-auto text-sm">
            {decisions.length === 0 ? (
              <p className="text-slate-500">No smart routing decisions logged yet.</p>
            ) : (
              decisions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="mb-2 block w-full rounded border border-slate-100 px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  onClick={() => setSelectedDecision(d)}
                >
                  <div className="font-mono text-xs">{d.requestId ?? d.id}</div>
                  <div>{d.selectedProvider}/{d.selectedModel} · {d.mode} · score {d.score}</div>
                  <div className="truncate text-xs text-slate-500">{d.reason}</div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Candidate Details</CardTitle>
          {selectedDecision ? (
            <pre className="mt-4 max-h-64 overflow-auto rounded bg-slate-950 p-3 text-xs text-green-400">
              {JSON.stringify(selectedDecision.detail, null, 2)}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Select a decision to inspect candidates and policy snapshot.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Routing Policy Editor (System Default)</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Mode</p>
            <select className="mt-1 w-full rounded border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={String(policy.optimizationMode)} onChange={(e) => setPolicy({ ...policy, optimizationMode: e.target.value })}>
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Max fallback attempts</p>
            <Input value={String(policy.maxFallbackAttempts ?? 2)} onChange={(e) => setPolicy({ ...policy, maxFallbackAttempts: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={Boolean(policy.euOnly)} onChange={(e) => setPolicy({ ...policy, euOnly: e.target.checked })} />
            EU Only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={policy.allowFallback !== false} onChange={(e) => setPolicy({ ...policy, allowFallback: e.target.checked })} />
            Allow Fallback
          </label>
          <Button onClick={savePolicy}>Save Policy</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Route Simulator</CardTitle>
        <p className="mt-2 text-sm text-slate-500">Decision only — no provider call, no credit deduction.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Input value={sim.model} onChange={(e) => setSim({ ...sim, model: e.target.value })} placeholder="model" />
          <select className="rounded border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={sim.capability} onChange={(e) => setSim({ ...sim, capability: e.target.value })}>
            {["chat", "embedding", "image", "audio", "video"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="rounded border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={sim.optimizationMode} onChange={(e) => setSim({ ...sim, optimizationMode: e.target.value })}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Input value={sim.inputTokens} onChange={(e) => setSim({ ...sim, inputTokens: e.target.value })} placeholder="input tokens" />
          <Input value={sim.outputTokens} onChange={(e) => setSim({ ...sim, outputTokens: e.target.value })} placeholder="output tokens" />
          <Input value={sim.region} onChange={(e) => setSim({ ...sim, region: e.target.value })} placeholder="region" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sim.streaming} onChange={(e) => setSim({ ...sim, streaming: e.target.checked })} />Streaming</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sim.euOnly} onChange={(e) => setSim({ ...sim, euOnly: e.target.checked })} />EU Only</label>
          <Button onClick={runSimulate}>Simulate Route</Button>
        </div>
        {simResult && (
          <pre className="mt-4 overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-200">{JSON.stringify(simResult, null, 2)}</pre>
        )}
      </Card>
    </div>
  );
}
