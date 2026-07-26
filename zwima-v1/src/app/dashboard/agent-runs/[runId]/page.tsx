"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { agentsClient } from "@/components/agents/agents-client";
import { AgentsDisclaimer, AgentsStateBox, AgentsSubnav } from "@/components/agents/agents-ui";

type RunStep = {
  stepId: string;
  stepType: string;
  status: string;
  sequence: number;
  errorMessage?: string | null;
  output?: unknown;
};

type RunDetail = {
  run?: {
    runId: string;
    agentId: string;
    status: string;
    tokenUsage?: { inputTokens?: number; outputTokens?: number };
    costEstimate?: number | null;
    costActual?: number | null;
    errorMessage?: string | null;
    output?: { text?: string } | null;
    createdAt?: string;
    completedAt?: string | null;
  };
  steps?: RunStep[];
};

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"]);

export default function AgentRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const [data, setData] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await agentsClient.getRun(params.runId);
    if (!res.success) setError(res.error?.message || "Failed to load run");
    else {
      setError(null);
      setData(res.data as RunDetail);
    }
    setLoading(false);
  }, [params.runId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function cancel() {
    setActionMsg(null);
    const res = await agentsClient.cancelRun(params.runId);
    if (!res.success) setActionMsg(res.error?.message || "Cancel failed");
    else {
      setActionMsg("Run cancelled");
      await refresh();
    }
  }

  const run = data?.run;
  const steps = data?.steps ?? [];
  const canCancel = run && !TERMINAL.has(run.status);

  return (
    <div className="space-y-6 p-6" data-testid="agent-run-detail-page">
      <AgentsSubnav />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Agent Run</h1>
        {run && (
          <Link href={`/dashboard/agents/${run.agentId}/runs`} className="text-sm text-slate-600 hover:underline">
            Back to runs
          </Link>
        )}
      </div>
      <AgentsDisclaimer />
      {loading && <AgentsStateBox state="loading" message="Loading run…" />}
      {error && <AgentsStateBox state="error" message={error} />}
      {actionMsg && (
        <p className="text-sm text-emerald-700" data-testid="run-action-msg">
          {actionMsg}
        </p>
      )}

      {run && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 rounded border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Run ID</dt>
              <dd className="font-mono text-xs" data-testid="run-id">
                {run.runId}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium" data-testid="run-status">
                {run.status}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Input tokens</dt>
              <dd data-testid="run-input-tokens">{run.tokenUsage?.inputTokens ?? 0}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Output tokens</dt>
              <dd data-testid="run-output-tokens">{run.tokenUsage?.outputTokens ?? 0}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estimated cost</dt>
              <dd data-testid="run-cost-estimate">{run.costEstimate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Actual cost</dt>
              <dd data-testid="run-cost-actual">{run.costActual ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd>{run.createdAt ? new Date(run.createdAt).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Completed</dt>
              <dd>{run.completedAt ? new Date(run.completedAt).toLocaleString() : "—"}</dd>
            </div>
          </dl>

          {run.errorMessage && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="run-error">
              {run.errorMessage}
            </div>
          )}

          {run.output?.text && (
            <div className="rounded border border-slate-200 bg-white p-4 text-sm">
              <p className="mb-1 font-medium text-slate-700">Output</p>
              <p className="whitespace-pre-wrap text-slate-800" data-testid="run-output-text">
                {run.output.text}
              </p>
            </div>
          )}

          {canCancel && (
            <button
              data-testid="run-cancel-btn"
              onClick={cancel}
              className="rounded bg-red-600 px-3 py-2 text-sm text-white"
            >
              Cancel run
            </button>
          )}

          <div>
            <p className="mb-2 font-medium text-slate-700">Steps</p>
            <ul className="divide-y rounded border bg-white" data-testid="run-steps-list">
              {steps.map((s) => (
                <li key={s.stepId} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    #{s.sequence} {s.stepType}
                  </span>
                  <span className={s.status === "FAILED" ? "text-red-700" : "text-slate-600"}>
                    {s.status}
                    {s.errorMessage ? ` — ${s.errorMessage}` : ""}
                  </span>
                </li>
              ))}
              {steps.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">No steps recorded yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
