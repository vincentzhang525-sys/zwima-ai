"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";

type ModelRow = { id: string; provider: string; name: string };

export function PlaygroundClient() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("Hello, how are you?");
  const [response, setResponse] = useState("");
  const [meta, setMeta] = useState<{ costCredits?: number; latencyMs?: number; provider?: string; inputTokens?: number; outputTokens?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/models")
      .then((r) => r.json())
      .then((d) => {
        const list = d.models ?? [];
        setModels(list);
        if (list[0]) {
          setProvider(list[0].provider);
          setModel(list[0].id);
        }
      })
      .catch(() => setError("Failed to load models"));
  }, []);

  const providers = [...new Set(models.map((m) => m.provider))];
  const filteredModels = models.filter((m) => m.provider === provider);

  async function run(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResponse("");
    setMeta(null);

    const res = await fetch("/api/playground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, prompt, stream: true }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Request failed");
      setLoading(false);
      return;
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let text = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "meta") setMeta(evt);
            if (evt.type === "chunk") {
              text += evt.content;
              setResponse(text);
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
    setLoading(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardTitle>API Playground</CardTitle>
          <form onSubmit={run} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    const first = models.find((m) => m.provider === e.target.value);
                    if (first) setModel(first.id);
                  }}
                >
                  {providers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <select
                  id="model"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="prompt">Prompt</Label>
              <textarea
                id="prompt"
                className="mt-1 min-h-[120px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Streaming…" : "Send"}
            </Button>
          </form>
        </Card>

        {error && <ErrorState message={error} />}

        <Card>
          <CardTitle>Response</CardTitle>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800">
            {response || (loading ? "Waiting for response…" : "No response yet")}
          </pre>
        </Card>
      </div>

      <Card>
        <CardTitle>Metrics</CardTitle>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Provider</dt>
            <dd className="font-medium">{meta?.provider ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Input Tokens</dt>
            <dd className="font-medium">{meta?.inputTokens ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Output Tokens</dt>
            <dd className="font-medium">{meta?.outputTokens ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Cost</dt>
            <dd className="font-medium">{meta?.costCredits != null ? `${meta.costCredits} credits` : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Latency</dt>
            <dd className="font-medium">{meta?.latencyMs != null ? `${meta.latencyMs}ms` : "—"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
