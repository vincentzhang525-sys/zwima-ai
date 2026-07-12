"use client";

import { useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type UsageRow = {
  id: string;
  time: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number | null;
};

const PAGE_SIZE = 10;

export function UsageClient({ initialLogs }: { initialLogs: UsageRow[] }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(initialLogs.length / PAGE_SIZE));
  const rows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return initialLogs.slice(start, start + PAGE_SIZE);
  }, [initialLogs, page]);

  return (
    <Card>
      <CardTitle>Usage Logs</CardTitle>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
              <th className="pb-2 pr-4">Time</th>
              <th className="pb-2 pr-4">Provider</th>
              <th className="pb-2 pr-4">Model</th>
              <th className="pb-2 pr-4">Input Tokens</th>
              <th className="pb-2 pr-4">Output Tokens</th>
              <th className="pb-2 pr-4">Cost</th>
              <th className="pb-2">Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500">
                  No usage records yet
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4 whitespace-nowrap">{new Date(row.time).toLocaleString()}</td>
                <td className="py-2 pr-4">{row.provider}</td>
                <td className="py-2 pr-4">{row.model}</td>
                <td className="py-2 pr-4">{row.inputTokens}</td>
                <td className="py-2 pr-4">{row.outputTokens}</td>
                <td className="py-2 pr-4">{row.cost}</td>
                <td className="py-2">{row.latencyMs != null ? `${row.latencyMs}ms` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
