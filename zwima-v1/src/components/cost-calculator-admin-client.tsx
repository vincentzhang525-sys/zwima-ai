"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";

type RecordRow = {
  id: string;
  pricingStatus: string;
  inputPricePerMillionTokens: string;
  outputPricePerMillionTokens: string;
  cachedInputPricePerMillionTokens: string | null;
  cacheWritePricePerMillionTokens: string | null;
  longContextPricePerMillionTokens: string | null;
  searchToolPricePerRequest: string | null;
  batchDiscount: string | null;
  retryCostMultiplier: string | null;
  effectiveFrom: string;
  promotionEndDate: string | null;
  providerModel: { modelCode: string; provider: { slug: string } };
};

type ModelOption = {
  id: string;
  modelCode: string;
  provider: { slug: string };
};

const emptyPricingForm = {
  providerModelId: "",
  currency: "EUR",
  inputPricePerMillionTokens: "",
  outputPricePerMillionTokens: "",
  cachedInputPricePerMillionTokens: "",
  cacheWritePricePerMillionTokens: "",
  longContextPricePerMillionTokens: "",
  searchToolPricePerRequest: "",
  batchDiscount: "",
  retryCostMultiplier: "1",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveUntil: "",
  promotionEndDate: "",
  promotionName: "",
  promotionActive: false,
  pricingStatus: "DRAFT",
  platformMarkupPercent: "30",
  requestPrice: "",
  imagePrice: "",
  audioPrice: "",
  notes: "",
};

export function CostCalculatorAdminClient() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [error, setError] = useState("");
  const [estimate, setEstimate] = useState<string>("");
  const [pricingForm, setPricingForm] = useState(emptyPricingForm);
  const [sim, setSim] = useState({
    providerSlug: "openai",
    modelCode: "gpt-5-mini",
    inputTokens: "1000",
    outputTokens: "500",
    cachedInputTokens: "0",
    cacheWriteTokens: "0",
    longContextTokens: "0",
    searchToolCalls: "0",
    embeddingTokens: "0",
    imageUnits: "0",
    audioUnits: "0",
    videoUnits: "0",
    batchMode: false,
    retryCount: "0",
  });

  async function load() {
    const [recordsRes, modelsRes] = await Promise.all([
      fetch("/api/admin/pricing-records"),
      fetch("/api/admin/models"),
    ]);
    const data = await recordsRes.json();
    const modelsData = await modelsRes.json();
    if (!recordsRes.ok) {
      setError(data.error || "Failed");
      return;
    }
    setRecords(data.records || []);
    if (modelsRes.ok) {
      setModels(
        (modelsData.models || []).map((m: ModelOption) => ({
          id: m.id,
          modelCode: m.modelCode,
          provider: m.provider,
        })),
      );
    }
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  async function runEstimate() {
    const res = await fetch("/api/admin/cost-calculator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...sim,
        inputTokens: Number(sim.inputTokens),
        outputTokens: Number(sim.outputTokens),
        cachedInputTokens: Number(sim.cachedInputTokens),
        cacheWriteTokens: Number(sim.cacheWriteTokens),
        longContextTokens: Number(sim.longContextTokens),
        searchToolCalls: Number(sim.searchToolCalls),
        embeddingTokens: Number(sim.embeddingTokens),
        imageUnits: Number(sim.imageUnits),
        audioUnits: Number(sim.audioUnits),
        videoUnits: Number(sim.videoUnits),
        retryCount: Number(sim.retryCount),
      }),
    });
    const data = await res.json();
    setEstimate(JSON.stringify(data.estimate ?? data.error, null, 2));
  }

  async function verifyRecord(id: string) {
    await fetch("/api/admin/pricing-records", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pricingStatus: "VERIFIED" }),
    });
    load();
  }

  async function createPricingRecord() {
    if (!pricingForm.providerModelId) return;
    const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
    const res = await fetch("/api/admin/pricing-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerModelId: pricingForm.providerModelId,
        currency: pricingForm.currency,
        inputPricePerMillionTokens: Number(pricingForm.inputPricePerMillionTokens || 0),
        outputPricePerMillionTokens: Number(pricingForm.outputPricePerMillionTokens || 0),
        cachedInputPricePerMillionTokens: numOrNull(pricingForm.cachedInputPricePerMillionTokens),
        cacheWritePricePerMillionTokens: numOrNull(pricingForm.cacheWritePricePerMillionTokens),
        longContextPricePerMillionTokens: numOrNull(pricingForm.longContextPricePerMillionTokens),
        searchToolPricePerRequest: numOrNull(pricingForm.searchToolPricePerRequest),
        requestPrice: numOrNull(pricingForm.requestPrice),
        imagePrice: numOrNull(pricingForm.imagePrice),
        audioPrice: numOrNull(pricingForm.audioPrice),
        batchDiscount: numOrNull(pricingForm.batchDiscount),
        retryCostMultiplier: numOrNull(pricingForm.retryCostMultiplier) ?? 1,
        effectiveFrom: pricingForm.effectiveFrom,
        effectiveUntil: pricingForm.effectiveUntil || null,
        promotionName: pricingForm.promotionName || null,
        promotionActive: pricingForm.promotionActive,
        promotionEndDate: pricingForm.promotionEndDate || null,
        pricingStatus: pricingForm.pricingStatus,
        platformMarkupPercent: Number(pricingForm.platformMarkupPercent || 30),
        notes: pricingForm.notes || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create pricing record");
      return;
    }
    setPricingForm(emptyPricingForm);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cost Calculator V2</h1>
        <p className="text-sm text-slate-500">
          Full cost stack with real margin, suggested selling price, and promotion end dates — admin-maintained pricing.
        </p>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}

      <Card>
        <CardTitle>New pricing record (V2)</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={pricingForm.providerModelId}
            onChange={(e) => setPricingForm({ ...pricingForm, providerModelId: e.target.value })}
          >
            <option value="">Model…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.provider.slug}/{m.modelCode}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={pricingForm.currency}
            onChange={(e) => setPricingForm({ ...pricingForm, currency: e.target.value })}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={pricingForm.pricingStatus}
            onChange={(e) => setPricingForm({ ...pricingForm, pricingStatus: e.target.value })}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="VERIFIED">VERIFIED</option>
          </select>
          <Input
            placeholder="Input €/M tokens"
            value={pricingForm.inputPricePerMillionTokens}
            onChange={(e) => setPricingForm({ ...pricingForm, inputPricePerMillionTokens: e.target.value })}
          />
          <Input
            placeholder="Output €/M tokens"
            value={pricingForm.outputPricePerMillionTokens}
            onChange={(e) => setPricingForm({ ...pricingForm, outputPricePerMillionTokens: e.target.value })}
          />
          <Input
            placeholder="Cache read €/M"
            value={pricingForm.cachedInputPricePerMillionTokens}
            onChange={(e) => setPricingForm({ ...pricingForm, cachedInputPricePerMillionTokens: e.target.value })}
          />
          <Input
            placeholder="Cache write €/M"
            value={pricingForm.cacheWritePricePerMillionTokens}
            onChange={(e) => setPricingForm({ ...pricingForm, cacheWritePricePerMillionTokens: e.target.value })}
          />
          <Input
            placeholder="Long context €/M"
            value={pricingForm.longContextPricePerMillionTokens}
            onChange={(e) => setPricingForm({ ...pricingForm, longContextPricePerMillionTokens: e.target.value })}
          />
          <Input
            placeholder="Search tool €/request"
            value={pricingForm.searchToolPricePerRequest}
            onChange={(e) => setPricingForm({ ...pricingForm, searchToolPricePerRequest: e.target.value })}
          />
          <Input placeholder="Video €/unit (uses request price)" value={pricingForm.requestPrice} onChange={(e) => setPricingForm({ ...pricingForm, requestPrice: e.target.value })} />
          <Input placeholder="Image €/unit" value={pricingForm.imagePrice} onChange={(e) => setPricingForm({ ...pricingForm, imagePrice: e.target.value })} />
          <Input placeholder="Audio €/unit" value={pricingForm.audioPrice} onChange={(e) => setPricingForm({ ...pricingForm, audioPrice: e.target.value })} />
          <Input
            placeholder="Batch discount (0–1)"
            value={pricingForm.batchDiscount}
            onChange={(e) => setPricingForm({ ...pricingForm, batchDiscount: e.target.value })}
          />
          <Input
            placeholder="Retry multiplier"
            value={pricingForm.retryCostMultiplier}
            onChange={(e) => setPricingForm({ ...pricingForm, retryCostMultiplier: e.target.value })}
          />
          <Input
            type="date"
            value={pricingForm.effectiveFrom}
            onChange={(e) => setPricingForm({ ...pricingForm, effectiveFrom: e.target.value })}
          />
          <Input
            type="date"
            placeholder="Effective until"
            value={pricingForm.effectiveUntil}
            onChange={(e) => setPricingForm({ ...pricingForm, effectiveUntil: e.target.value })}
          />
          <Input
            type="date"
            placeholder="Promotion end"
            value={pricingForm.promotionEndDate}
            onChange={(e) => setPricingForm({ ...pricingForm, promotionEndDate: e.target.value })}
          />
          <Input
            placeholder="Platform markup %"
            value={pricingForm.platformMarkupPercent}
            onChange={(e) => setPricingForm({ ...pricingForm, platformMarkupPercent: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pricingForm.promotionActive}
              onChange={(e) => setPricingForm({ ...pricingForm, promotionActive: e.target.checked })}
            />
            Promotion active
          </label>
          <Button onClick={createPricingRecord}>Create record</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Estimate simulator</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Input value={sim.providerSlug} onChange={(e) => setSim({ ...sim, providerSlug: e.target.value })} placeholder="provider slug" />
          <Input value={sim.modelCode} onChange={(e) => setSim({ ...sim, modelCode: e.target.value })} placeholder="model code" />
          <Input value={sim.inputTokens} onChange={(e) => setSim({ ...sim, inputTokens: e.target.value })} placeholder="input tokens" />
          <Input value={sim.outputTokens} onChange={(e) => setSim({ ...sim, outputTokens: e.target.value })} placeholder="output tokens" />
          <Input value={sim.cachedInputTokens} onChange={(e) => setSim({ ...sim, cachedInputTokens: e.target.value })} placeholder="cache read tokens" />
          <Input value={sim.cacheWriteTokens} onChange={(e) => setSim({ ...sim, cacheWriteTokens: e.target.value })} placeholder="cache write tokens" />
          <Input value={sim.longContextTokens} onChange={(e) => setSim({ ...sim, longContextTokens: e.target.value })} placeholder="long context tokens" />
          <Input value={sim.searchToolCalls} onChange={(e) => setSim({ ...sim, searchToolCalls: e.target.value })} placeholder="search tool calls" />
          <Input value={sim.embeddingTokens} onChange={(e) => setSim({ ...sim, embeddingTokens: e.target.value })} placeholder="embedding tokens" />
          <Input value={sim.imageUnits} onChange={(e) => setSim({ ...sim, imageUnits: e.target.value })} placeholder="image units" />
          <Input value={sim.audioUnits} onChange={(e) => setSim({ ...sim, audioUnits: e.target.value })} placeholder="audio units" />
          <Input value={sim.videoUnits} onChange={(e) => setSim({ ...sim, videoUnits: e.target.value })} placeholder="video units" />
          <Input value={sim.retryCount} onChange={(e) => setSim({ ...sim, retryCount: e.target.value })} placeholder="retry count" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sim.batchMode} onChange={(e) => setSim({ ...sim, batchMode: e.target.checked })} />
            Batch API discount
          </label>
          <Button onClick={runEstimate}>Calculate</Button>
        </div>
        {estimate && <pre className="mt-4 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-green-400">{estimate}</pre>}
      </Card>

      <Card>
        <CardTitle>Pricing records</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 pr-3">Model</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">In/Out €/M</th>
                <th className="pb-2 pr-3">Cache R/W</th>
                <th className="pb-2 pr-3">Long ctx</th>
                <th className="pb-2 pr-3">Search</th>
                <th className="pb-2 pr-3">Batch</th>
                <th className="pb-2 pr-3">Retry×</th>
                <th className="pb-2 pr-3">Promo end</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 30).map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3">
                    {r.providerModel.provider.slug}/{r.providerModel.modelCode}
                  </td>
                  <td className="py-2 pr-3">{r.pricingStatus}</td>
                  <td className="py-2 pr-3">
                    {r.inputPricePerMillionTokens}/{r.outputPricePerMillionTokens}
                  </td>
                  <td className="py-2 pr-3">
                    {r.cachedInputPricePerMillionTokens ?? "—"}/{r.cacheWritePricePerMillionTokens ?? "—"}
                  </td>
                  <td className="py-2 pr-3">{r.longContextPricePerMillionTokens ?? "—"}</td>
                  <td className="py-2 pr-3">{r.searchToolPricePerRequest ?? "—"}</td>
                  <td className="py-2 pr-3">{r.batchDiscount ?? "—"}</td>
                  <td className="py-2 pr-3">{r.retryCostMultiplier ?? "1"}</td>
                  <td className="py-2 pr-3">{r.promotionEndDate?.slice(0, 10) ?? "—"}</td>
                  <td className="py-2">
                    {r.pricingStatus !== "VERIFIED" && (
                      <Button size="sm" variant="secondary" onClick={() => verifyRecord(r.id)}>
                        Verify
                      </Button>
                    )}
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
