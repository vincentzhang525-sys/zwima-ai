"use client";

import { Copy, RefreshCw, Trash2, Power } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  enabled: boolean;
  status: string;
  projectId: string | null;
  projectName: string | null;
  routingMode: string;
  requests: number;
  spendCredits: number;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
  monthlyBudget: number | null;
};

type Project = { id: string; name: string };

const ROUTING_MODES = ["BALANCED", "LOWEST_COST", "LOWEST_LATENCY", "HIGHEST_QUALITY", "EU_COMPLIANCE"];

export function WorkspaceApiKeysClient() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [routingMode, setRoutingMode] = useState("BALANCED");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [keysRes, projectsRes] = await Promise.all([
      fetch("/api/workspace/api-keys"),
      fetch("/api/workspace/projects"),
    ]);
    const keysData = await keysRes.json();
    const projectsData = await projectsRes.json();
    if (!keysRes.ok) setError(keysData.error?.message || "Failed");
    else {
      setKeys(keysData.keys ?? []);
      setError("");
    }
    setProjects((projectsData.projects ?? []).map((p: Project) => ({ id: p.id, name: p.name })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createKey(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/workspace/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectId: projectId || undefined, routingMode }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewKey(data.fullKey);
      setName("");
      load();
    }
  }

  async function toggleKey(id: string, enabled: boolean) {
    await fetch(`/api/workspace/api-keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  }

  async function rotateKey(id: string) {
    if (!confirm("Rotate this key? The old key will stop working immediately.")) return;
    const res = await fetch(`/api/workspace/api-keys/${id}/rotate`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setNewKey(data.fullKey);
    load();
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key permanently?")) return;
    await fetch(`/api/workspace/api-keys/${id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true, reason: "Revoked by user" }),
    });
    load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading API keys…</p>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      {newKey && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
          <CardTitle>New API Key — copy now</CardTitle>
          <p className="mt-2 break-all font-mono text-sm">{newKey}</p>
          <Button className="mt-3" onClick={() => { navigator.clipboard.writeText(newKey); }}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
        </Card>
      )}

      <Card>
        <CardTitle>Create API Key</CardTitle>
        <form onSubmit={createKey} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div>
            <Label>Project</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">General (default)</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Routing Mode</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={routingMode} onChange={(e) => setRoutingMode(e.target.value)}>
              {ROUTING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <Button type="submit" className="w-fit">Create Key</Button>
        </form>
      </Card>

      {keys.length === 0 ? (
        <EmptyState title="No API keys yet" description="Create an API key to start integrating." />
      ) : (
        <Card>
          <CardTitle>Your API Keys</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Key</th>
                  <th className="pb-2 pr-3">Project</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Routing</th>
                  <th className="pb-2 pr-3">Requests</th>
                  <th className="pb-2 pr-3">Last Used</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3">{k.name}</td>
                    <td className="py-2 pr-3 font-mono">{k.prefix}</td>
                    <td className="py-2 pr-3">{k.projectName ?? "General"}</td>
                    <td className="py-2 pr-3">{k.status}</td>
                    <td className="py-2 pr-3">{k.routingMode}</td>
                    <td className="py-2 pr-3">{k.requests}</td>
                    <td className="py-2 pr-3">{k.lastUsed ? new Date(k.lastUsed).toLocaleString() : "—"}</td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="secondary" onClick={() => toggleKey(k.id, !k.enabled)}><Power className="h-3 w-3" /></Button>
                        <Button size="sm" variant="secondary" onClick={() => rotateKey(k.id)}><RefreshCw className="h-3 w-3" /></Button>
                        <Button size="sm" variant="secondary" onClick={() => revokeKey(k.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
