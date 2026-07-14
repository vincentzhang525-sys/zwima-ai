"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonTable } from "@/components/ui/skeleton";

const STATUSES = ["ACTIVE", "PREVIEW", "DEPRECATED", "DISABLED"] as const;

type ModelRow = {
  id: string;
  modelCode: string;
  displayName: string;
  status: string;
  adminStatus: string;
  contextWindow: number | null;
  region: string | null;
  euAvailable: boolean;
  endOfLifeDate: string | null;
  releaseDate: string | null;
  removalDate: string | null;
  replacementModelId: string | null;
  provider: { id: string; slug: string; name: string };
  replacementModel?: { modelCode: string; displayName: string } | null;
  pricing: { pricingStatus: string }[];
};

type ProviderOption = { id: string; slug: string; name: string };

export function ModelsLifecycleAdminClient() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newModel, setNewModel] = useState({
    providerId: "",
    modelCode: "",
    displayName: "",
    contextWindow: "",
    region: "EU",
  });

  async function load() {
    setLoading(true);
    setError("");
    const [mRes, pRes] = await Promise.all([
      fetch("/api/admin/models"),
      fetch("/api/admin/providers"),
    ]);
    const mData = await mRes.json();
    const pData = await pRes.json();
    if (!mRes.ok) {
      setError(mData.error || "Failed to load models");
      setModels([]);
    } else {
      setModels(mData.models || []);
    }
    if (pRes.ok) {
      setProviders((pData.providers || []).map((p: { id: string; slug: string; name: string }) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
      })));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function patchModel(id: string, patch: Record<string, unknown>) {
    await fetch("/api/admin/models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    load();
  }

  async function createModel() {
    if (!newModel.providerId || !newModel.modelCode || !newModel.displayName) return;
    await fetch("/api/admin/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newModel,
        contextWindow: newModel.contextWindow ? Number(newModel.contextWindow) : undefined,
      }),
    });
    setNewModel({ providerId: "", modelCode: "", displayName: "", contextWindow: "", region: "EU" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Model Lifecycle</h1>
        <p className="text-sm text-slate-500">
          Provider, model, status, replacement, dates, context window, region & EU availability — all DB-backed.
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      <Card>
        <CardTitle>Add model</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={newModel.providerId}
            onChange={(e) => setNewModel({ ...newModel, providerId: e.target.value })}
          >
            <option value="">Provider…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.slug}
              </option>
            ))}
          </select>
          <Input
            placeholder="model-code"
            value={newModel.modelCode}
            onChange={(e) => setNewModel({ ...newModel, modelCode: e.target.value })}
          />
          <Input
            placeholder="Display name"
            value={newModel.displayName}
            onChange={(e) => setNewModel({ ...newModel, displayName: e.target.value })}
          />
          <Input
            placeholder="Context window"
            value={newModel.contextWindow}
            onChange={(e) => setNewModel({ ...newModel, contextWindow: e.target.value })}
          />
          <Button onClick={createModel}>Create</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Catalog</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                <th className="pb-2 pr-3">Provider</th>
                <th className="pb-2 pr-3">Model</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Context</th>
                <th className="pb-2 pr-3">Region</th>
                <th className="pb-2 pr-3">EU</th>
                <th className="pb-2 pr-3">Release</th>
                <th className="pb-2 pr-3">End of life</th>
                <th className="pb-2 pr-3">Removal</th>
                <th className="pb-2 pr-3">Replacement</th>
                <th className="pb-2">Pricing</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11}>
                    <SkeletonTable rows={6} />
                  </td>
                </tr>
              ) : (
                models.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3">{m.provider.slug}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{m.modelCode}</div>
                      <div className="text-xs text-slate-500">{m.displayName}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        className="rounded border border-slate-200 bg-transparent px-2 py-1 text-xs dark:border-slate-700"
                        value={m.adminStatus}
                        onChange={(e) => patchModel(m.id, { status: e.target.value })}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        className="h-8 w-24"
                        defaultValue={m.contextWindow ?? ""}
                        onBlur={(e) =>
                          patchModel(m.id, {
                            contextWindow: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        className="h-8 w-20"
                        defaultValue={m.region ?? ""}
                        onBlur={(e) => patchModel(m.id, { region: e.target.value || null })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={m.euAvailable}
                        onChange={(e) => patchModel(m.id, { euAvailable: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="date"
                        className="h-8 w-36"
                        defaultValue={m.releaseDate?.slice(0, 10) ?? ""}
                        onBlur={(e) =>
                          patchModel(m.id, { releaseDate: e.target.value || null })
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="date"
                        className="h-8 w-36"
                        defaultValue={m.endOfLifeDate?.slice(0, 10) ?? ""}
                        onBlur={(e) =>
                          patchModel(m.id, { endOfLifeDate: e.target.value || null })
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="date"
                        className="h-8 w-36"
                        defaultValue={m.removalDate?.slice(0, 10) ?? ""}
                        onBlur={(e) =>
                          patchModel(m.id, { removalDate: e.target.value || null })
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        className="rounded border border-slate-200 bg-transparent px-2 py-1 text-xs dark:border-slate-700"
                        value={m.replacementModelId ?? ""}
                        onChange={(e) =>
                          patchModel(m.id, { replacementModelId: e.target.value || null })
                        }
                      >
                        <option value="">—</option>
                        {models
                          .filter((x) => x.id !== m.id && x.provider.id === m.provider.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.modelCode}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="py-2">{m.pricing[0]?.pricingStatus ?? "—"}</td>
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
