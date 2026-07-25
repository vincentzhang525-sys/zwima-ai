"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { agentsClient } from "@/components/agents/agents-client";
import { AgentsDisclaimer, AgentsSubnav } from "@/components/agents/agents-ui";

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful mock assistant.");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await agentsClient.createAgent({ name, systemPrompt, reviewRequired: false });
    setSaving(false);
    if (!res.success || !res.data) {
      setError(res.error?.message || "Create failed");
      return;
    }
    const agentId = (res.data as { agent?: { agentId?: string } }).agent?.agentId;
    if (!agentId) {
      setError("Create succeeded but agentId missing");
      return;
    }
    router.push(`/dashboard/agents/${agentId}`);
  }

  return (
    <div className="space-y-6 p-6" data-testid="agents-new-page">
      <AgentsSubnav />
      <h1 className="text-2xl font-semibold text-slate-900">New Agent</h1>
      <AgentsDisclaimer />
      <form onSubmit={onSubmit} className="max-w-xl space-y-4">
        <label className="block text-sm">
          Name
          <input
            data-testid="agent-name-input"
            className="mt-1 w-full rounded border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          System prompt
          <textarea
            data-testid="agent-prompt-input"
            className="mt-1 w-full rounded border px-3 py-2"
            rows={5}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          data-testid="agent-create-submit"
          disabled={saving}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create"}
        </button>
      </form>
    </div>
  );
}
