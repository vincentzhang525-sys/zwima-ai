"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { agentsClient } from "@/components/agents/agents-client";
import { AgentsDisclaimer, AgentsStateBox, AgentsSubnav } from "@/components/agents/agents-ui";

type TemplateRow = {
  templateId: string;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  isSystemTemplate: boolean;
  isActive: boolean;
};

export default function AgentTemplatesPage() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    setLoading(true);
    agentsClient
      .listTemplates(qs, ac.signal)
      .then((res) => {
        if (!res.success) setError(res.error?.message || "Failed");
        else {
          setError(null);
          setRows((res.data as TemplateRow[]) || []);
        }
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [category]);

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);

  return (
    <div className="space-y-6 p-6" data-testid="agent-templates-page">
      <AgentsSubnav />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Agent Templates</h1>
          <p className="mt-1 text-sm text-slate-600">
            Reusable system and workspace-custom agent templates — Mock provider only.
          </p>
        </div>
      </div>
      <AgentsDisclaimer />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Category:</span>
        <button
          onClick={() => setCategory("")}
          className={`rounded border px-2 py-1 ${category === "" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
          data-testid="template-category-all"
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded border px-2 py-1 ${category === c ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
            data-testid={`template-category-${c}`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && <AgentsStateBox state="loading" message="Loading templates…" />}
      {error && <AgentsStateBox state="error" message={error} />}
      {!loading && !error && rows.length === 0 && <AgentsStateBox state="empty" message="No templates found." />}

      <ul className="divide-y rounded border border-slate-200 bg-white" data-testid="agent-templates-list">
        {rows.map((t) => (
          <li key={t.templateId} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div>
              <Link
                href={`/dashboard/agents/templates/${t.templateId}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {t.name}
              </Link>
              <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {t.isSystemTemplate && (
                <span
                  className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                  data-testid="template-system-badge"
                >
                  System
                </span>
              )}
              {!t.isActive && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Inactive</span>
              )}
              <span className="text-xs text-slate-500">{t.category}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
