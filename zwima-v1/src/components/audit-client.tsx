"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonTable } from "@/components/ui/skeleton";

type Log = {
  id: string;
  action: string;
  category: string;
  createdAt: string;
  detail: unknown;
  user?: { email: string };
};

export function AuditClient() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const params = category ? `?category=${category}` : "";
    const res = await fetch(`/api/audit${params}`);
    const data = await res.json();
    if (!res.ok) setError(data.error || "Failed");
    else setLogs(data.logs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const categories = ["", "LOGIN", "API_KEY", "BILLING", "RECHARGE", "PROVIDER", "ADMIN", "TEAM"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c || "all"}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-lg px-3 py-1.5 text-sm ${category === c ? "bg-blue-900 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
          >
            {c || "All"}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      <Card>
        <CardTitle>Audit Log</CardTitle>
        {loading ? (
          <div className="mt-4">
            <SkeletonTable />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No audit entries" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2">User</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{l.category}</td>
                    <td className="py-2 pr-4">{l.action}</td>
                    <td className="py-2">{l.user?.email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
