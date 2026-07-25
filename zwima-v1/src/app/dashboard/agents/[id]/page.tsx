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
    </div>
  );
}
