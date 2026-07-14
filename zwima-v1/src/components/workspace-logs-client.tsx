"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

type LogRow = {
  id: string;
  timestamp: string;
  requestId: string;
  project: string;
  apiKey: string;
  provider: string;
  model: string;
  httpStatus: number;
  latencyMs: number | null;
  credits: number;
  costEur: number;
  routingMode: string;
  failover: boolean;
};

type LogDetail = Record<string, unknown>;

export function WorkspaceLogsClient() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [detail, setDetail] = useState<LogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/workspace/logs");
    const data = await res.json();
    if (!res.ok) setError(data.error?.message || "Failed");
    else { setLogs(data.items ?? []); setError(""); }
    setLoading(false);
  }

  async function openDetail(id: string) {
    const res = await fetch(`/api/workspace/logs/${id}`);
    const data = await res.json();
    if (res.ok) setDetail(data.log);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading logs…</p>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      {logs.length === 0 ? (
        <EmptyState title="No request logs yet" description="API requests will appear here with routing metadata." />
      ) : (
        <Card>
          <CardTitle>Request Logs</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-2">Time</th>
                  <th className="pb-2 pr-2">Request ID</th>
                  <th className="pb-2 pr-2">Provider</th>
                  <th className="pb-2 pr-2">Model</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2 pr-2">Latency</th>
                  <th className="pb-2 pr-2">Cost</th>
                  <th className="pb-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-2">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{log.requestId.slice(0, 12)}…</td>
                    <td className="py-2 pr-2">{log.provider}</td>
                    <td className="py-2 pr-2">{log.model}</td>
                    <td className="py-2 pr-2">{log.httpStatus}</td>
                    <td className="py-2 pr-2">{log.latencyMs ?? "—"}ms</td>
                    <td className="py-2 pr-2">€{log.costEur.toFixed(4)}</td>
                    <td className="py-2">
                      <Button size="sm" variant="secondary" onClick={() => openDetail(log.id)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {detail && (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Request Detail</CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setDetail(null)}>Close</Button>
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(detail).map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-500">{k}</dt>
                <dd className="break-all">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
