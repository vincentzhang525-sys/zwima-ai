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
  maxEntries: number;
  maxEntryCharacters: number;
  retentionDays: number;
};

type MemoryEntry = {
  memoryId: string;
  memoryType?: string | null;
  scope: string;
  key: string;
  valuePreview: string;
  createdAt: string;
  expiresAt?: string | null;
};

function AgentMemorySection({ agentId }: { agentId: string }) {
  const [policy, setPolicy] = useState<MemoryPolicy | null>(null);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function refresh() {
    const [policyRes, entriesRes] = await Promise.all([
      agentsClient.getAgentMemoryPolicy(agentId),
      agentsClient.listAgentMemory(agentId),
    ]);
    if (!policyRes.success) setError(policyRes.error?.message || "Failed to load memory policy");
    else setPolicy(policyRes.data as MemoryPolicy);
    if (!entriesRes.success) setError(entriesRes.error?.message || "Failed to load memory entries");
    else setEntries((entriesRes.data as MemoryEntry[]) || []);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function toggleEnabled() {
    if (!policy) return;
    const res = await agentsClient.updateAgentMemoryPolicy(agentId, { memoryEnabled: !policy.memoryEnabled });
    if (!res.success) setError(res.error?.message || "Update failed");
    else {
      setError(null);
      setMsg(policy.memoryEnabled ? "Memory disabled" : "Memory enabled");
      await refresh();
    }
  }

  async function toggleType(field: "allowUserMemory" | "allowWorkspaceMemory") {
    if (!policy) return;
    const res = await agentsClient.updateAgentMemoryPolicy(agentId, { [field]: !policy[field] });
    if (!res.success) setError(res.error?.message || "Update failed");
    else await refresh();
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
          onChange={toggleEnabled}
        />
        Memory enabled for this agent
      </label>

      {policy.memoryEnabled && (
        <div className="space-y-2 pl-6 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="memory-allow-user-toggle"
              checked={policy.allowUserMemory}
              onChange={() => toggleType("allowUserMemory")}
            />
            Allow user-scoped memory
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="memory-allow-workspace-toggle"
              checked={policy.allowWorkspaceMemory}
              onChange={() => toggleType("allowWorkspaceMemory")}
            />
            Allow workspace-scoped memory
          </label>
          <p className="text-xs text-slate-500" data-testid="memory-limits">
            Limits: max {policy.maxEntries} entries, {policy.maxEntryCharacters} characters each, retained{" "}
            {policy.retentionDays} days.
          </p>
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
              <li key={e.memoryId} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div>
                  <span className="font-medium text-slate-800">
                    [{e.memoryType || e.scope}] {e.key}
                  </span>
                  <span className="ml-2 text-slate-500">{e.valuePreview}</span>
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
