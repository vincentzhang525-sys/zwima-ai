"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonTable } from "@/components/ui/skeleton";

const SECTIONS = [
  "customers",
  "organizations",
  "api-keys",
  "transactions",
  "invoices",
  "subscriptions",
  "coupons",
  "providers",
  "pricing",
  "margins",
  "audit",
] as const;

type Section = (typeof SECTIONS)[number];

const SECTION_KEYS: Record<Section, string> = {
  customers: "customers",
  organizations: "organizations",
  "api-keys": "apiKeys",
  transactions: "transactions",
  invoices: "invoices",
  subscriptions: "subscriptions",
  coupons: "coupons",
  providers: "providers",
  pricing: "pricing",
  margins: "margins",
  audit: "audit",
};

export function AdminConsoleClient() {
  const [section, setSection] = useState<Section>("customers");
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ type: string; id: string; label: string; sub: string }[]>([]);
  const [data, setData] = useState<Record<string, unknown[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(s: Section) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/console", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: s }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Failed");
    else setData(json);
    setLoading(false);
  }

  async function search() {
    if (!q.trim()) return;
    const res = await fetch(`/api/admin/console?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    setSearchResults(json.results ?? []);
  }

  useEffect(() => {
    load(section);
  }, [section]);

  const rows = (data[SECTION_KEYS[section]] ?? []) as Record<string, unknown>[];

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Global Search</CardTitle>
        <div className="mt-4 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers, keys, invoices…" className="flex-1" />
          <Button onClick={search}>Search</Button>
        </div>
        {searchResults.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {searchResults.map((r) => (
              <li key={`${r.type}-${r.id}`} className="rounded border border-slate-200 px-3 py-2 dark:border-slate-700">
                <span className="font-medium">{r.label}</span>
                <span className="ml-2 text-slate-500">[{r.type}]</span>
                <span className="ml-2 text-slate-400">{r.sub}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Button key={s} variant={section === s ? "primary" : "secondary"} size="sm" onClick={() => setSection(s)}>
            {s}
          </Button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={() => load(section)} />}

      <Card>
        <CardTitle>{section}</CardTitle>
        {loading ? (
          <div className="mt-4">
            <SkeletonTable />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td className="py-4 text-slate-500">No records</td>
                  </tr>
                )}
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">
                      <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(row, null, 0).slice(0, 300)}</pre>
                    </td>
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
