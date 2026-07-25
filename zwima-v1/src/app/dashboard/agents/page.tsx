"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { agentsClient } from "@/components/agents/agents-client";
import { AgentsDisclaimer, AgentsStateBox, AgentsSubnav } from "@/components/agents/agents-ui";

type AgentRow = { agentId: string; name: string; status: string };

export default function AgentsPage() {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    agentsClient
      .listAgents(ac.signal)
      .then((res) => {
        if (!res.success) setError(res.error?.message || "Failed");
        else setRows((res.data as AgentRow[]) || []);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  return (
    <div className="space-y-6 p-6" data-testid="agents-page">
      <AgentsSubnav />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Agents</h1>
          <p className="mt-1 text-sm text-slate-600">M8 Agent Registry — Mock provider only.</p>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
          data-testid="agents-new-link"
        >
          New Agent
        </Link>
      </div>
      <AgentsDisclaimer />
      {loading && <AgentsStateBox state="loading" message="Loading agents…" />}
      {error && <AgentsStateBox state="error" message={error} />}
      {!loading && !error && rows.length === 0 && <AgentsStateBox state="empty" message="No agents yet." />}
      <ul className="divide-y rounded border border-slate-200 bg-white" data-testid="agents-list">
        {rows.map((a) => (
          <li key={a.agentId} className="flex items-center justify-between px-4 py-3 text-sm">
            <Link href={`/dashboard/agents/${a.agentId}`} className="font-medium text-slate-900 hover:underline">
              {a.name}
            </Link>
            <span className="text-slate-500">{a.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
