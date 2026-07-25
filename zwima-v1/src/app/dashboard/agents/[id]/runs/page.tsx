"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { agentsClient } from "@/components/agents/agents-client";
import { AgentsDisclaimer, AgentsStateBox, AgentsSubnav } from "@/components/agents/agents-ui";

type RunRow = { runId: string; status: string; costEstimate?: number | null };

export default function AgentRunsPage() {
  const params = useParams<{ id: string }>();
  const [rows, setRows] = useState<RunRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("Hello from mock agent");

  async function refresh() {
    const res = await agentsClient.listRuns(`?agentId=${params.id}`);
    if (!res.success) setError(res.error?.message || "Failed");
    else setRows((res.data as RunRow[]) || []);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function runNow() {
    const res = await agentsClient.createRun(
      params.id,
      { input: { message: input }, execute: true },
      `idem-${Date.now()}`,
    );
    if (!res.success) setError(res.error?.message || "Run failed");
    else await refresh();
  }

  return (
    <div className="space-y-6 p-6" data-testid="agent-runs-page">
      <AgentsSubnav />
      <h1 className="text-2xl font-semibold">Agent Runs</h1>
      <AgentsDisclaimer />
      {error && <AgentsStateBox state="error" message={error} />}
      <div className="flex gap-2">
        <input
          data-testid="run-input"
          className="flex-1 rounded border px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          data-testid="run-execute"
          onClick={runNow}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
        >
          Run (Mock)
        </button>
      </div>
      <ul className="divide-y rounded border bg-white" data-testid="runs-list">
        {rows.map((r) => (
          <li key={r.runId} className="flex justify-between px-4 py-3 text-sm">
            <Link href={`/dashboard/agent-runs/${r.runId}`} className="underline">
              {r.runId}
            </Link>
            <span>
              {r.status} · est {r.costEstimate ?? "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
