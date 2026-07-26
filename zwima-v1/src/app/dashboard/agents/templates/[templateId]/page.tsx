"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { agentsClient } from "@/components/agents/agents-client";
import { AgentsDisclaimer, AgentsStateBox, AgentsSubnav } from "@/components/agents/agents-ui";

type TemplateDetail = {
  templateId: string;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  systemPrompt: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxSteps: number;
  defaultTimeoutMs: number;
  defaultCostCeiling: number;
  allowedToolKeys: string[];
  isSystemTemplate: boolean;
  isActive: boolean;
};

export default function AgentTemplateDetailPage() {
  const params = useParams<{ templateId: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    agentsClient
      .getTemplate(params.templateId, ac.signal)
      .then((res) => {
        if (!res.success) setError(res.error?.message || "Failed");
        else {
          setError(null);
          setTemplate(res.data as TemplateDetail);
        }
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, [params.templateId]);

  async function createFromTemplate() {
    setCreating(true);
    setCreateError(null);
    const res = await agentsClient.createAgentFromTemplate({
      templateId: params.templateId,
      name: agentName.trim() || undefined,
    });
    setCreating(false);
    if (!res.success || !res.data) {
      setCreateError(res.error?.message || "Create failed");
      return;
    }
    const agentId = (res.data as { agent?: { agentId?: string } }).agent?.agentId;
    if (agentId) router.push(`/dashboard/agents/${agentId}`);
  }

  return (
    <div className="space-y-6 p-6" data-testid="agent-template-detail-page">
      <AgentsSubnav />
      <h1 className="text-2xl font-semibold text-slate-900">{template?.name || "Template"}</h1>
      <AgentsDisclaimer />
      {error && <AgentsStateBox state="error" message={error} />}

      {template && (
        <div className="max-w-2xl space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {template.isSystemTemplate && (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">System</span>
            )}
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{template.category}</span>
            {!template.isActive && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Inactive</span>
            )}
          </div>

          <p className="text-slate-600">{template.description}</p>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">System prompt</h2>
            <pre
              data-testid="template-system-prompt"
              className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800"
            >
              {template.systemPrompt}
            </pre>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">Allowed tools</h2>
            <ul className="mt-1 flex flex-wrap gap-2" data-testid="template-tools">
              {template.allowedToolKeys.map((key) => (
                <li key={key} className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">
                  {key}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded border border-slate-200 bg-white p-3 text-xs text-slate-700">
            <div>Model: {template.defaultModel}</div>
            <div>Temperature: {template.defaultTemperature}</div>
            <div>Max steps: {template.defaultMaxSteps}</div>
            <div>Timeout: {template.defaultTimeoutMs}ms</div>
            <div>Cost ceiling: ${template.defaultCostCeiling.toFixed(2)}</div>
          </div>

          <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
            <label className="block text-xs text-slate-600">
              Agent name (optional)
              <input
                data-testid="from-template-name-input"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder={template.name}
              />
            </label>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <button
              data-testid="create-agent-from-template"
              onClick={createFromTemplate}
              disabled={creating}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Agent from Template"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
