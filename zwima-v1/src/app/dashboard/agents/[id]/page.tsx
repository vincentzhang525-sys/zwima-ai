"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { agentsClient } from "@/components/agents/agents-client";
import { AgentsDisclaimer, AgentsStateBox, AgentsSubnav } from "@/components/agents/agents-ui";

type AgentDetail = {
  agent?: { agentId: string; name: string; status: string; currentVersionId?: string | null };
  versions?: Array<{ versionId: string }>;
};

type MemoryPolicy = {
  memoryEnabled: boolean;
  allowUserMemory: boolean;
  allowWorkspaceMemory: boolean;
  allowAgentMemory: boolean;
  allowRead: boolean;
  allowExecutionSummaryWrite: boolean;
  maxEntries: number;
  maxEntryCharacters: number;
  retentionDays: number;
  workspaceMemoryDeferred?: boolean;
};

type MemoryEntry = {
  memoryId: string;
  memoryType?: string | null;
  scope: string;
  key: string;
  valuePreview: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string | null;
};

function AgentMemorySection({ agentId }: { agentId: string }) {
  const [policy, setPolicy] = useState<MemoryPolicy | null>(null);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftLimits, setDraftLimits] = useState({ maxEntries: 50, maxEntryCharacters: 2000, retentionDays: 30 });

  async function refresh() {
    setLoading(true);
    const [policyRes, entriesRes] = await Promise.all([
      agentsClient.getAgentMemoryPolicy(agentId),
      agentsClient.listAgentMemory(agentId),
    ]);
    if (!policyRes.success) setError(policyRes.error?.message || "Failed to load memory policy");
    else {
      const p = policyRes.data as MemoryPolicy;
      setPolicy(p);
      setDraftLimits({
        maxEntries: p.maxEntries,
        maxEntryCharacters: p.maxEntryCharacters,
        retentionDays: p.retentionDays,
      });
    }
    if (!entriesRes.success) setError(entriesRes.error?.message || "Failed to load memory entries");
    else setEntries((entriesRes.data as MemoryEntry[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function patchPolicy(body: Record<string, unknown>, successMsg?: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await agentsClient.updateAgentMemoryPolicy(agentId, body);
    setSaving(false);
    if (!res.success) setError(res.error?.message || "Update failed");
    else {
      setMsg(successMsg || "Policy saved");
      await refresh();
    }
  }

  async function toggleEnabled() {
    if (!policy) return;
    await patchPolicy(
      { memoryEnabled: !policy.memoryEnabled },
      policy.memoryEnabled ? "Memory disabled" : "Memory enabled",
    );
  }

  async function toggleFlag(
    field: "allowUserMemory" | "allowAgentMemory" | "allowRead" | "allowExecutionSummaryWrite",
  ) {
    if (!policy) return;
    await patchPolicy({ [field]: !policy[field] });
  }

  async function saveLimits() {
    await patchPolicy({ ...draftLimits }, "Limits saved");
  }

  async function deleteEntry(memoryId: string) {
    const res = await agentsClient.deleteAgentMemory(agentId, memoryId);
    if (!res.success) setError(res.error?.message || "Delete failed");
    else await refresh();
  }

  async function clearAll() {
    const res = await agentsClient.clearAgentMemory(agentId);
    setConfirmClear(false);
    if (!res.success) setError(res.error?.message || "Clear failed");
    else {
      setMsg("All memory cleared");
      await refresh();
    }
  }

  if (loading && !policy) {
    return <AgentsStateBox state="loading" message="Loading memory…" />;
  }
  if (!policy) return null;

  return (
    <div className="max-w-2xl space-y-4 rounded border border-slate-200 bg-white p-4" data-testid="agent-memory-section">
      <h2 className="text-lg font-semibold text-slate-900">Memory</h2>
      {error && <AgentsStateBox state="error" message={error} />}
      {msg && (
        <p className="text-sm text-emerald-700" data-testid="agent-memory-msg">
          {msg}
        </p>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          data-testid="memory-enabled-toggle"
          checked={policy.memoryEnabled}
          disabled={saving}
          onChange={toggleEnabled}
        />
        Memory enabled for this agent
      </label>

      {policy.memoryEnabled && (
        <div className="space-y-3 pl-6 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="memory-allow-user-toggle"
              checked={policy.allowUserMemory}
              disabled={saving}
              onChange={() => toggleFlag("allowUserMemory")}
            />
            Allow USER memory
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="memory-allow-agent-toggle"
              checked={policy.allowAgentMemory}
              disabled={saving}
              onChange={() => toggleFlag("allowAgentMemory")}
            />
            Allow AGENT memory
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="memory-allow-execution-summary-toggle"
              checked={policy.allowExecutionSummaryWrite}
              disabled={saving}
              onChange={() => toggleFlag("allowExecutionSummaryWrite")}
            />
            Allow EXECUTION_SUMMARY auto-write
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="memory-allow-read-toggle"
              checked={policy.allowRead}
              disabled={saving}
              onChange={() => toggleFlag("allowRead")}
            />
            Allow reading historical memory into runs
          </label>

          <div
            className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
            data-testid="memory-workspace-disabled"
          >
            <label className="flex items-center gap-2 opacity-60">
              <input
                type="checkbox"
                data-testid="memory-allow-workspace-toggle"
                checked={false}
                disabled
                readOnly
              />
              Allow WORKSPACE memory (disabled)
            </label>
            <p className="mt-1" data-testid="memory-workspace-deferred-note">
              Workspace memory is temporarily unavailable until authenticated workspace binding is
              enabled.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs" data-testid="memory-limits-form">
            <label>
              maxEntries
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                data-testid="memory-max-entries"
                value={draftLimits.maxEntries}
                onChange={(e) => setDraftLimits((d) => ({ ...d, maxEntries: Number(e.target.value) }))}
              />
            </label>
            <label>
              maxEntryCharacters
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                data-testid="memory-max-chars"
                value={draftLimits.maxEntryCharacters}
                onChange={(e) =>
                  setDraftLimits((d) => ({ ...d, maxEntryCharacters: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              retentionDays
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                data-testid="memory-retention-days"
                value={draftLimits.retentionDays}
                onChange={(e) => setDraftLimits((d) => ({ ...d, retentionDays: Number(e.target.value) }))}
              />
            </label>
          </div>
          <button
            type="button"
            data-testid="memory-save-limits"
            disabled={saving}
            onClick={saveLimits}
            className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save limits"}
          </button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Entries ({entries.length})</h3>
          {entries.length > 0 && !confirmClear && (
            <button
              data-testid="memory-clear-all-btn"
              onClick={() => setConfirmClear(true)}
              className="text-xs text-red-600 underline"
            >
              Clear all
            </button>
          )}
          {confirmClear && (
            <div className="flex items-center gap-2 text-xs">
              <span>Delete all memory entries?</span>
              <button data-testid="memory-clear-confirm" onClick={clearAll} className="text-red-600 underline">
                Confirm
              </button>
              <button onClick={() => setConfirmClear(false)} className="text-slate-500 underline">
                Cancel
              </button>
            </div>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500" data-testid="memory-empty">
            No memory entries yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y rounded border border-slate-200" data-testid="memory-entries-list">
            {entries.map((e) => (
              <li key={e.memoryId} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                <div>
                  <span className="font-medium text-slate-800">
                    [{e.memoryType || e.scope}] {e.key}
                  </span>
                  <span className="ml-2 text-slate-500" data-testid={`memory-preview-${e.memoryId}`}>
                    {e.valuePreview}
                  </span>
                  <div className="mt-1 text-[10px] text-slate-400">
                    created {new Date(e.createdAt).toLocaleString()}
                    {e.updatedAt ? ` · updated ${new Date(e.updatedAt).toLocaleString()}` : ""}
                    {e.expiresAt ? ` · expires ${new Date(e.expiresAt).toLocaleString()}` : ""}
                    {e.createdBy ? ` · by ${e.createdBy}` : ""}
                  </div>
                </div>
                <button
                  data-testid={`memory-delete-${e.memoryId}`}
                  onClick={() => deleteEntry(e.memoryId)}
                  className="text-red-600 underline"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<AgentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    agentsClient
      .getAgent(params.id, ac.signal)
      .then((res) => {
        if (!res.success) setError(res.error?.message || "Failed");
        else setData(res.data as AgentDetail);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, [params.id]);

  async function publish() {
    const versionId = data?.agent?.currentVersionId || data?.versions?.[0]?.versionId;
    if (!versionId) return;
    const res = await agentsClient.publishAgent(params.id, versionId);
    if (!res.success) setMsg(res.error?.message || "Publish failed");
    else {
      setMsg("Published");
      const refreshed = await agentsClient.getAgent(params.id);
      if (refreshed.success) setData(refreshed.data as AgentDetail);
    }
  }

  const agent = data?.agent;

  return (
    <div className="space-y-6 p-6" data-testid="agent-detail-page">
      <AgentsSubnav />
      <h1 className="text-2xl font-semibold text-slate-900">{agent?.name || "Agent"}</h1>
      <AgentsDisclaimer />
      {error && <AgentsStateBox state="error" message={error} />}
      {msg && (
        <p className="text-sm text-emerald-700" data-testid="agent-publish-msg">
          {msg}
        </p>
      )}
      {agent && (
        <div className="space-y-3 text-sm">
          <p>
            Status: <span data-testid="agent-status">{agent.status}</span>
          </p>
          <p>ID: {agent.agentId}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/dashboard/agents/${agent.agentId}/config`} className="underline">
              Config
            </Link>
            <Link href={`/dashboard/agents/${agent.agentId}/runs`} className="underline">
              Runs
            </Link>
            <button
              data-testid="agent-publish-btn"
              onClick={publish}
              className="rounded bg-slate-900 px-3 py-1.5 text-white"
            >
              Publish
            </button>
          </div>
        </div>
      )}
      {agent && <AgentMemorySection agentId={agent.agentId} />}
    </div>
  );
}
