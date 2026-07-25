"use client";

import { useCallback, useEffect, useState } from "react";

type Tab = "overview" | "rates" | "policies" | "margins" | "alerts";

export function FxCostControlAdminClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<unknown[]>([]);
  const [rates, setRates] = useState<{ items: unknown[]; note?: string } | null>(null);
  const [policies, setPolicies] = useState<{ items: unknown[]; defaults?: Record<string, string>; note?: string } | null>(
    null,
  );
  const [margins, setMargins] = useState<{ items: unknown[]; note?: string } | null>(null);
  const [alerts, setAlerts] = useState<{ items: unknown[]; autoPriceChange?: boolean; note?: string } | null>(null);

  const load = useCallback(async (next: Tab) => {
    setLoading(true);
    setError(null);
    try {
      if (next === "overview") {
        const r = await fetch("/api/v1/admin/cost-optimization/fx-policies");
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        setPolicies(d);
        // provider overview derived from defaults until provider currency API is loaded via margins filters
        setOverview(
          Object.entries(d.defaults || {}).map(([currency, bufferRate]) => ({
            currency,
            defaultBufferRate: bufferRate,
          })),
        );
      } else if (next === "rates") {
        const r = await fetch("/api/v1/admin/cost-optimization/fx-rates?pageSize=50");
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        setRates(d);
      } else if (next === "policies") {
        const r = await fetch("/api/v1/admin/cost-optimization/fx-policies");
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        setPolicies(d);
      } else if (next === "margins") {
        const r = await fetch("/api/v1/admin/cost-optimization/margins?pageSize=50");
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        setMargins(d);
      } else if (next === "alerts") {
        const r = await fetch("/api/v1/admin/cost-optimization/repricing-alerts?pageSize=50");
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        setAlerts(d);
      }
      setTab(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("overview");
  }, [load]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Provider Currency / Buffer Defaults" },
    { id: "rates", label: "Current FX Rates" },
    { id: "policies", label: "FX Buffer Policies" },
    { id: "margins", label: "Usage Margins (EUR)" },
    { id: "alerts", label: "Package Repricing Alerts" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => void load(t.id)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "overview" && (
        <Section title="System FX Buffer Defaults (EUR/USD/GBP/CNY/other)">
          <SimpleTable
            rows={overview as Array<Record<string, string>>}
            columns={[
              { key: "currency", label: "Currency" },
              { key: "defaultBufferRate", label: "Default Buffer Rate" },
            ]}
          />
          <p className="mt-2 text-xs text-slate-500">
            LIVE_PROVIDER_CALLS_ENABLED remains false. No provider secrets are shown.
          </p>
        </Section>
      )}

      {tab === "rates" && rates && (
        <Section title="FX Rate Snapshots / Status">
          {rates.note && <p className="mb-2 text-xs text-amber-700">{rates.note}</p>}
          <SimpleTable
            rows={rates.items as Array<Record<string, string>>}
            columns={[
              { key: "pair", label: "Pair" },
              { key: "rate", label: "Rate" },
              { key: "status", label: "Status" },
              { key: "source", label: "Source" },
              { key: "effectiveAt", label: "Effective At" },
            ]}
          />
        </Section>
      )}

      {tab === "policies" && policies && (
        <Section title="FX Buffer Policies">
          {policies.note && <p className="mb-2 text-xs text-amber-700">{policies.note}</p>}
          <SimpleTable
            rows={policies.items as Array<Record<string, string>>}
            columns={[
              { key: "label", label: "Label" },
              { key: "providerSlug", label: "Provider" },
              { key: "currency", label: "Currency" },
              { key: "bufferRate", label: "Buffer Rate" },
              { key: "enabled", label: "Enabled" },
            ]}
          />
        </Section>
      )}

      {tab === "margins" && margins && (
        <Section title="Cost in Provider Currency → EUR → Buffered → Margin">
          {margins.note && <p className="mb-2 text-xs text-amber-700">{margins.note}</p>}
          <SimpleTable
            rows={margins.items as Array<Record<string, string>>}
            columns={[
              { key: "providerSlug", label: "Provider" },
              { key: "model", label: "Model" },
              { key: "providerCurrency", label: "Currency" },
              { key: "costInProviderCurrency", label: "Cost (PC)" },
              { key: "costInEur", label: "Cost EUR" },
              { key: "bufferedCostEur", label: "Buffered EUR" },
              { key: "revenueEur", label: "Revenue EUR" },
              { key: "grossMarginEur", label: "Margin EUR" },
              { key: "grossMarginRate", label: "Margin %" },
              { key: "fxRateStatus", label: "FX Status" },
            ]}
          />
        </Section>
      )}

      {tab === "alerts" && alerts && (
        <Section title="Package Repricing Alerts (manual only — no auto price change)">
          {alerts.note && <p className="mb-2 text-xs text-amber-700">{alerts.note}</p>}
          <p className="mb-2 text-xs text-slate-600">
            autoPriceChange={String(alerts.autoPriceChange ?? false)}
          </p>
          <SimpleTable
            rows={alerts.items as Array<Record<string, string>>}
            columns={[
              { key: "status", label: "Status" },
              { key: "alertCode", label: "Code" },
              { key: "packageLabel", label: "Package" },
              { key: "fxChangePct", label: "FX Δ" },
              { key: "currentMarginRate", label: "Margin" },
              { key: "suggestedAction", label: "Suggestion" },
              { key: "message", label: "Message" },
            ]}
          />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function SimpleTable({
  rows,
  columns,
}: {
  rows: Array<Record<string, unknown>>;
  columns: Array<{ key: string; label: string }>;
}) {
  if (!rows?.length) {
    return <p className="text-sm text-slate-500">No rows yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className="px-2 py-1 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100">
              {columns.map((c) => (
                <td key={c.key} className="px-2 py-1 text-slate-700">
                  {row[c.key] == null ? "—" : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
