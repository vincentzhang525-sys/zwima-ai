"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonTable } from "@/components/ui/skeleton";

const PROVIDER_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE", "DEPRECATED"] as const;

type ApiKeyRow = { id: string; label: string; masked: string; enabled: boolean };

type ProviderRow = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  weight: number;
  priority: number;
  status: string;
  baseUrl?: string | null;
  region?: string;
  dataResidency?: string;
  regions?: string[];
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsEmbedding: boolean;
  apiKeys: ApiKeyRow[];
  usageToday: number;
  errorRate: number;
  margin: number;
  modelCount: number;
};

const emptyProvider = {
  slug: "",
  name: "",
  baseUrl: "",
  region: "EU",
  dataResidency: "EU",
  regions: "EU,US",
  weight: "100",
  priority: "0",
};

export function ProvidersManagementAdminClient() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newProvider, setNewProvider] = useState(emptyProvider);
  const [keyDraft, setKeyDraft] = useState<Record<string, { label: string; secret: string }>>({});

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/providers");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed");
      setProviders([]);
    } else {
      setProviders(data.providers || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function update(slug: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/admin/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...patch }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Update failed");
    }
    load();
  }

  async function createProvider() {
    if (!newProvider.slug || !newProvider.name) return;
    const res = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newProvider.slug,
        name: newProvider.name,
        baseUrl: newProvider.baseUrl || null,
        region: newProvider.region,
        dataResidency: newProvider.dataResidency,
        regions: newProvider.regions.split(",").map((r) => r.trim()).filter(Boolean),
        weight: Number(newProvider.weight),
        priority: Number(newProvider.priority),
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Create failed");
      return;
    }
    setNewProvider(emptyProvider);
    load();
  }

  async function deprecate(slug: string) {
    if (!confirm(`Deprecate provider ${slug}?`)) return;
    await fetch(`/api/admin/providers?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    load();
  }

  async function saveApiKey(slug: string) {
    const draft = keyDraft[slug];
    if (!draft?.label || !draft?.secret) return;
    const provider = providers.find((p) => p.slug === slug);
    const keys = [
      ...(provider?.apiKeys || []).map((k) => ({
        id: k.id,
        label: k.label,
        enabled: k.enabled,
      })),
      { label: draft.label, secret: draft.secret, enabled: true },
    ];

    await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setApiKeys", slug, keys }),
    });
    setKeyDraft((d) => ({ ...d, [slug]: { label: "", secret: "" } }));
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Provider Management</h1>
        <p className="text-sm text-slate-500">
          CRUD, API keys, routing priority, availability, regions, streaming & embedding — all admin-configurable.
        </p>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}

      <Card>
        <CardTitle>Add provider</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Input placeholder="slug (e.g. openai)" value={newProvider.slug} onChange={(e) => setNewProvider({ ...newProvider, slug: e.target.value })} />
          <Input placeholder="Display name" value={newProvider.name} onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })} />
          <Input placeholder="Base URL" value={newProvider.baseUrl} onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })} />
          <Input placeholder="Regions (comma)" value={newProvider.regions} onChange={(e) => setNewProvider({ ...newProvider, regions: e.target.value })} />
          <Input placeholder="Weight" value={newProvider.weight} onChange={(e) => setNewProvider({ ...newProvider, weight: e.target.value })} />
          <Input placeholder="Priority" value={newProvider.priority} onChange={(e) => setNewProvider({ ...newProvider, priority: e.target.value })} />
          <Button onClick={createProvider}>Create</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Providers</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                <th className="pb-2 pr-3">Slug</th>
                <th className="pb-2 pr-3">Name / URL</th>
                <th className="pb-2 pr-3">Available</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Regions</th>
                <th className="pb-2 pr-3">Capabilities</th>
                <th className="pb-2 pr-3">Priority</th>
                <th className="pb-2 pr-3">Weight</th>
                <th className="pb-2 pr-3">API Keys</th>
                <th className="pb-2">Ops</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>
                    <SkeletonTable rows={5} />
                  </td>
                </tr>
              ) : (
                providers.map((p) => (
                  <tr key={p.slug} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="py-3 pr-3 font-mono">{p.slug}</td>
                    <td className="py-3 pr-3">
                      <Input className="mb-1 h-8" defaultValue={p.name} onBlur={(e) => update(p.slug, { name: e.target.value })} />
                      <Input className="h-8 text-xs" placeholder="base URL" defaultValue={p.baseUrl ?? ""} onBlur={(e) => update(p.slug, { baseUrl: e.target.value })} />
                    </td>
                    <td className="py-3 pr-3">
                      <input type="checkbox" checked={p.enabled} onChange={(e) => update(p.slug, { enabled: e.target.checked })} />
                    </td>
                    <td className="py-3 pr-3">
                      <select className="rounded border px-2 py-1 text-xs dark:border-slate-700" defaultValue={p.status} onChange={(e) => update(p.slug, { status: e.target.value })}>
                        {PROVIDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <Input className="h-8 w-28" defaultValue={(p.regions || []).join(",")} onBlur={(e) => update(p.slug, { regions: e.target.value.split(",").map((r) => r.trim()).filter(Boolean), region: e.target.value.split(",")[0]?.trim() })} />
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      <label className="flex gap-1"><input type="checkbox" checked={p.supportsStreaming} onChange={(e) => update(p.slug, { supportsStreaming: e.target.checked })} />Stream</label>
                      <label className="flex gap-1"><input type="checkbox" checked={p.supportsEmbedding} onChange={(e) => update(p.slug, { supportsEmbedding: e.target.checked })} />Embed</label>
                      <label className="flex gap-1"><input type="checkbox" checked={p.supportsTools} onChange={(e) => update(p.slug, { supportsTools: e.target.checked })} />Tools</label>
                      <label className="flex gap-1"><input type="checkbox" checked={p.supportsVision} onChange={(e) => update(p.slug, { supportsVision: e.target.checked })} />Vision</label>
                    </td>
                    <td className="py-3 pr-3">
                      <Input className="h-8 w-16" type="number" defaultValue={p.priority} onBlur={(e) => update(p.slug, { priority: Number(e.target.value) })} />
                    </td>
                    <td className="py-3 pr-3">
                      <Input className="h-8 w-16" type="number" defaultValue={p.weight} onBlur={(e) => update(p.slug, { weight: Number(e.target.value) })} />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="space-y-1 text-xs">
                        {p.apiKeys.map((k) => (
                          <div key={k.id} className="font-mono">{k.label}: {k.masked}</div>
                        ))}
                        <Input className="h-7" placeholder="Key label" value={keyDraft[p.slug]?.label ?? ""} onChange={(e) => setKeyDraft({ ...keyDraft, [p.slug]: { ...keyDraft[p.slug], label: e.target.value, secret: keyDraft[p.slug]?.secret ?? "" } })} />
                        <Input className="h-7" placeholder="Secret" type="password" value={keyDraft[p.slug]?.secret ?? ""} onChange={(e) => setKeyDraft({ ...keyDraft, [p.slug]: { label: keyDraft[p.slug]?.label ?? "", secret: e.target.value } })} />
                        <Button size="sm" variant="secondary" onClick={() => saveApiKey(p.slug)}>Add key</Button>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="text-xs text-slate-500">{p.modelCount} models</div>
                      <div className="text-xs">{p.usageToday} req · {p.margin}% margin</div>
                      <Button size="sm" variant="secondary" className="mt-1" onClick={() => deprecate(p.slug)}>Deprecate</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
