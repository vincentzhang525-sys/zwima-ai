"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AgentsDisclaimer, AgentsStateBox, AgentsSubnav } from "@/components/agents/agents-ui";

type VersionRow = {
  versionId: string;
  status: string;
  systemPrompt?: string;
  temperature?: number;
  reviewRequired?: boolean;
};

export default function AgentConfigPage() {
  const params = useParams<{ id: string }>();
  const [versionId, setVersionId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [reviewRequired, setReviewRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/agents/${params.id}/config`)
      .then((r) => r.json())
      .then((res: {
        success: boolean;
        error?: { message?: string };
        data?: { agent?: { currentVersionId?: string }; versions?: VersionRow[] };
      }) => {
        if (!res.success) setError(res.error?.message || "Failed");
        else {
          const draft =
            (res.data?.versions || []).find((v) => v.status === "DRAFT") || res.data?.versions?.[0];
          const resolvedVersionId = draft?.versionId || res.data?.agent?.currentVersionId || "";
          if (draft) {
            setSystemPrompt(draft.systemPrompt || "");
            setTemperature(draft.temperature ?? 0.7);
            setReviewRequired(Boolean(draft.reviewRequired));
          }
          setVersionId(resolvedVersionId);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const res = await fetch(`/api/v1/agents/${params.id}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId, systemPrompt, temperature, reviewRequired }),
    }).then((r) => r.json());
    if (!res.success) setError(res.error?.message || "Save failed");
    else {
      setError(null);
      setSaved(true);
    }
  }

  return (
    <div className="space-y-6 p-6" data-testid="agent-config-page">
      <AgentsSubnav />
      <h1 className="text-2xl font-semibold">Agent Config</h1>
      <AgentsDisclaimer />
      {error && <AgentsStateBox state="error" message={error} />}
      {saved && (
        <p className="text-sm text-emerald-700" data-testid="agent-config-saved">
          Saved
        </p>
      )}
      {!loading && versionId && (
        <p className="sr-only" data-testid="config-ready">
          ready
        </p>
      )}
      <form onSubmit={save} className="max-w-xl space-y-3 text-sm">
        <label className="block">
          System prompt
          <textarea
            data-testid="config-prompt"
            className="mt-1 w-full rounded border px-3 py-2"
            rows={5}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </label>
        <label className="block">
          Temperature
          <input
            data-testid="config-temperature"
            type="number"
            step="0.1"
            min={0}
            max={2}
            className="mt-1 w-full rounded border px-3 py-2"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            data-testid="config-review-required"
            type="checkbox"
            checked={reviewRequired}
            onChange={(e) => setReviewRequired(e.target.checked)}
          />
          Require human review
        </label>
        <button
          data-testid="config-save"
          disabled={loading || !versionId}
          className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
        >
          Save
        </button>
      </form>
    </div>
  );
}
