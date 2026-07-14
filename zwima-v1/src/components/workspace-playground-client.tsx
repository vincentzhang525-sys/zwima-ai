"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

type ModelRow = { id: string; provider: string; name: string };
type ApiKeyRow = { id: string; name: string };
type Project = { id: string; name: string };

const ROUTING_MODES = ["BALANCED", "LOWEST_COST", "LOWEST_LATENCY", "HIGHEST_QUALITY", "EU_COMPLIANCE"];

export function WorkspacePlaygroundClient() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [apiKeyId, setApiKeyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [model, setModel] = useState("");
  const [routingMode, setRoutingMode] = useState("BALANCED");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("Hello, how are you?");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [stream, setStream] = useState(false);
  const [response, setResponse] = useState("");
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/models").then((r) => r.json()),
      fetch("/api/workspace/api-keys").then((r) => r.json()),
      fetch("/api/workspace/projects").then((r) => r.json()),
    ]).then(([modelsData, keysData, projectsData]) => {
      const list = modelsData.models ?? [];
      setModels(list);
      if (list[0]) setModel(list[0].id);
      const activeKeys = (keysData.keys ?? []).filter((k: { status: string; enabled: boolean }) => k.enabled && k.status === "ACTIVE");
      setKeys(activeKeys);
      if (activeKeys[0]) setApiKeyId(activeKeys[0].id);
      setProjects(projectsData.projects ?? []);
    }).catch(() => setError("Failed to load playground data"));
  }, []);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!apiKeyId) {
      setError("Select an API key");
      return;
    }
    setLoading(true);
    setError("");
    setResponse("");
    setMeta(null);

    const res = await fetch("/api/workspace/playground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKeyId,
        projectId: projectId || undefined,
        model,
        routingMode,
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        stream,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setError(data.error?.message || data.error || "Request failed");
    } else {
      setResponse(String(data.content ?? ""));
      setMeta(data);
    }
    setLoading(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>Request</CardTitle>
        <form onSubmit={run} className="mt-4 space-y-3">
          <div>
            <Label>Project</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Label>API Key</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={apiKeyId} onChange={(e) => setApiKeyId(e.target.value)} required>
              <option value="">Select key</option>
              {keys.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Model</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={model} onChange={(e) => setModel(e.target.value)}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.provider} / {m.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Routing Mode</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={routingMode} onChange={(e) => setRoutingMode(e.target.value)}>
              {ROUTING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><Label>System Prompt</Label><textarea className="w-full rounded-md border p-2 text-sm" rows={2} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} /></div>
          <div><Label>User Prompt</Label><textarea className="w-full rounded-md border p-2 text-sm" rows={4} value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Temperature</Label><input type="number" step="0.1" min={0} max={2} className="w-full rounded-md border px-3 py-2 text-sm" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} /></div>
            <div><Label>Max Tokens</Label><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} /> Streaming (non-stream response in V1)</label>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>{loading ? "Sending…" : "Send"}</Button>
            <Button type="button" variant="secondary" onClick={() => { setResponse(""); setMeta(null); setError(""); }}>Clear</Button>
          </div>
        </form>
        {error && <ErrorState message={error} />}
      </Card>

      <Card>
        <CardTitle>Response</CardTitle>
        {!response && !meta ? (
          <EmptyState title="No response yet" description="Send a request to see AI output and routing metadata." />
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <pre className="whitespace-pre-wrap rounded bg-slate-100 p-3 dark:bg-slate-800">{response}</pre>
            {meta && (
              <dl className="grid grid-cols-2 gap-2">
                <div><dt className="text-slate-500">Provider</dt><dd>{String(meta.selectedProvider ?? "—")}</dd></div>
                <div><dt className="text-slate-500">Model</dt><dd>{String(meta.selectedModel ?? "—")}</dd></div>
                <div><dt className="text-slate-500">Routing</dt><dd>{String(meta.routingMode ?? "—")}</dd></div>
                <div><dt className="text-slate-500">Reason</dt><dd>{String(meta.routingReason ?? "—")}</dd></div>
                <div><dt className="text-slate-500">Latency</dt><dd>{meta.latencyMs != null ? `${meta.latencyMs}ms` : "—"}</dd></div>
                <div><dt className="text-slate-500">Cost</dt><dd>{meta.estimatedCostEur != null ? `€${meta.estimatedCostEur}` : "—"}</dd></div>
                <div><dt className="text-slate-500">Credits</dt><dd>{String(meta.creditsUsed ?? "—")}</dd></div>
                <div><dt className="text-slate-500">Request ID</dt><dd className="font-mono text-xs">{String(meta.requestId ?? "—")}</dd></div>
                <div><dt className="text-slate-500">Failover</dt><dd>{meta.failoverOccurred ? "Yes" : "No"}</dd></div>
              </dl>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
