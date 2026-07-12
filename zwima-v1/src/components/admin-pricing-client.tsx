"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PricingRow = {
  providerSlug: string;
  modelId: string;
  inputTokenCost: number;
  outputTokenCost: number;
  marginPercent: number;
  customerPriceIn: number;
  customerPriceOut: number;
};

export function AdminPricingClient() {
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [margins, setMargins] = useState<{ scope: string; multiplier: number; label: string | null }[]>([]);

  async function load() {
    const [p, m] = await Promise.all([
      fetch("/api/admin/pricing").then((r) => r.json()),
      fetch("/api/admin/margins").then((r) => r.json()),
    ]);
    setPricing(p.pricing ?? []);
    setMargins(m.margins ?? []);
  }

  useEffect(() => { load(); }, []);

  async function savePricing(row: PricingRow) {
    await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    await load();
  }

  async function saveMargin(scope: string, multiplier: number) {
    await fetch("/api/admin/margins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, multiplier }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pricing & Margins</h1>
        <p className="text-sm text-slate-500">Admin price management</p>
      </div>

      <Card>
        <CardTitle>Model Pricing</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 pr-2">Provider</th>
                <th className="pb-2 pr-2">Model</th>
                <th className="pb-2 pr-2">Input Cost</th>
                <th className="pb-2 pr-2">Output Cost</th>
                <th className="pb-2 pr-2">Margin %</th>
                <th className="pb-2">Customer In/Out</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((row) => (
                <tr key={`${row.providerSlug}-${row.modelId}`} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-2">{row.providerSlug}</td>
                  <td className="py-2 pr-2">{row.modelId}</td>
                  <td className="py-2 pr-2">
                    <Input
                      className="h-8 w-20"
                      defaultValue={row.inputTokenCost}
                      onBlur={(e) => savePricing({ ...row, inputTokenCost: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      className="h-8 w-20"
                      defaultValue={row.outputTokenCost}
                      onBlur={(e) => savePricing({ ...row, outputTokenCost: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      className="h-8 w-16"
                      defaultValue={row.marginPercent}
                      onBlur={(e) => savePricing({ ...row, marginPercent: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2">{row.customerPriceIn.toFixed(2)} / {row.customerPriceOut.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle>Margin Rules</CardTitle>
        <div className="mt-4 space-y-3">
          {margins.map((m) => (
            <div key={m.scope} className="flex items-center gap-3">
              <span className="w-28 text-sm font-medium">{m.scope}</span>
              <Input
                className="h-9 w-24"
                defaultValue={m.multiplier}
                onBlur={(e) => saveMargin(m.scope, Number(e.target.value))}
              />
              <span className="text-sm text-slate-500">{m.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
