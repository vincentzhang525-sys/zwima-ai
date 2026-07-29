"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { agentsClient } from "@/components/agents/agents-client";
import { AgentsDisclaimer, AgentsStateBox, AgentsSubnav } from "@/components/agents/agents-ui";

type RunRow = { runId: string; status: string; costEstimate?: number | null };

type PreviewRunResult = {
  runId: string | null;
  status: string;
  executionMode: string;
  durationMs: number | null;
  output: unknown;
  error: { code: string; message: string } | null;
  providerCallExecuted: boolean;
  paymentCreated: boolean;
  emailSent: boolean;
  externalSideEffectExecuted: boolean;
  safetyDecision?: { code: string; reason: string };
};

export default function AgentRunsPage() {
  const params = useParams<{ id: string }>();
  const [rows, setRows] = useState<RunRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("Hello from mock agent");
  const [running, setRunning] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewRunResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idempotencyRef = useRef<string | null>(null);

  async function refresh() {
    const res = await agentsClient.listRuns(`?agentId=${params.id}`);
    if (!res.success) setError(res.error?.message || "Failed");
    else setRows((res.data as RunRow[]) || []);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function inferScenario(text: string): "success" | "fail" | "timeout" {
    const lower = text.toLowerCase();
    if (/\bfail\b|强制失败|mock.?fail/.test(lower)) return "fail";
    if (/\btimeout\b|超时|mock.?timeout/.test(lower)) return "timeout";
    return "success";
  }

  async function runInPreview() {
    if (running) return;
    setRunning(true);
    setError(null);
    setPreviewResult(null);
    const idem = idempotencyRef.current ?? `gap020-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    idempotencyRef.current = idem;
    const controller = new AbortController();
    abortRef.current = controller;
    const scenario = inferScenario(input);

    try {
      const res = await fetch(`/api/agents/${params.id}/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idem,
        },
        body: JSON.stringify({
          input: { message: input, scenario },
          executionMode: "PREVIEW_SAFE",
          scenario,
          // Keep timeout scenario short so Preview UI settles; cancel path aborts earlier.
          timeoutMs: scenario === "timeout" ? 80 : 15_000,
        }),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: PreviewRunResult;
        error?: { code?: string; message?: string };
      } | null;

      if (!json) {
        setError(`HTTP ${res.status}: empty response`);
        return;
      }

      if (json.data) {
        setPreviewResult(json.data);
        if (json.data.status === "COMPLETED") {
          idempotencyRef.current = null;
          await refresh();
        } else if (json.data.status === "TIMED_OUT") {
          setError(json.data.error?.message || "Run timed out (mock)");
        } else if (json.data.status === "FAILED" || json.data.status === "CANCELLED") {
          setError(json.data.error?.message || json.error?.message || "Run failed");
        } else if (json.data.status === "BLOCKED_BY_SAFETY_GATE") {
          setError(json.data.error?.message || json.error?.message || "Blocked by safety gate");
        }
      } else if (!json.success) {
        setError(json.error?.message || `Request failed (${res.status})`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Run cancelled");
      } else {
        setError(err instanceof Error ? err.message : "Run failed");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function cancelPreview() {
    abortRef.current?.abort();
  }

  return (
    <div className="space-y-6 p-6" data-testid="agent-runs-page">
      <AgentsSubnav />
      <h1 className="text-2xl font-semibold">Agent Runs</h1>
      <AgentsDisclaimer />
      <p
        className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        data-testid="preview-safe-banner"
      >
        Preview-safe mock only. Real Provider calls, payments, email, and external side effects are
        never executed from this page — including after refresh.
      </p>
      {error && <AgentsStateBox state="error" message={error} />}
      <div className="flex flex-wrap gap-2">
        <input
          data-testid="run-input"
          className="min-w-[200px] flex-1 rounded border px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={running}
        />
        <button
          data-testid="run-preview"
          onClick={() => void runInPreview()}
          disabled={running}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {running ? "Running…" : "Run in Preview"}
        </button>
        {running && (
          <button
            data-testid="run-cancel"
            type="button"
            onClick={cancelPreview}
            className="rounded border px-3 py-2 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
      {running && (
        <AgentsStateBox state="loading" message="Preview mock run in progress…" />
      )}
      {previewResult && (
        <div
          className="space-y-2 rounded border bg-white p-4 text-sm"
          data-testid="preview-run-result"
        >
          <div>
            Status: <strong data-testid="preview-status">{previewResult.status}</strong>
          </div>
          <div>Mode: {previewResult.executionMode}</div>
          <div>Duration: {previewResult.durationMs ?? "—"} ms</div>
          <div data-testid="preview-side-effects">
            providerCallExecuted={String(previewResult.providerCallExecuted)} · paymentCreated=
            {String(previewResult.paymentCreated)} · emailSent={String(previewResult.emailSent)} ·
            externalSideEffectExecuted={String(previewResult.externalSideEffectExecuted)}
          </div>
          {previewResult.output != null && (
            <pre className="overflow-auto rounded bg-slate-50 p-2 text-xs" data-testid="preview-output">
              {JSON.stringify(previewResult.output, null, 2)}
            </pre>
          )}
          {previewResult.error && (
            <p className="text-red-700" data-testid="preview-error">
              {previewResult.error.code}: {previewResult.error.message}
            </p>
          )}
        </div>
      )}
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
