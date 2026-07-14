"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  DollarSign,
  RefreshCw,
  Server,
  Shield,
  TrendingUp,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";

type OpsDashboard = {
  generatedAt: string;
  revenue: { today: number; yesterday: number; thisMonth: number; lastMonth: number };
  profit: {
    grossMarginEur: number;
    netMarginEur: number;
    marginPercent: number;
    grossMarginPercent: number;
    netMarginPercent: number;
    providerCostMonth: number;
    revenueMonth: number;
  };
  apiUsage: {
    requestsToday: number;
    tokensToday: number;
    creditsSoldToday: number;
    creditsConsumedToday: number;
    activeCustomers: number;
  };
  providerHealth: {
    slug: string;
    name: string;
    status: string;
    enabled: boolean;
    avgLatencyMs: number | null;
    errorRate: number;
    successRate: number;
    routingWeight: number;
    currentCostEur: number;
    requestsToday: number;
    healthStatus: string;
    lastError?: string | null;
  }[];
  lifecycleAlerts: {
    deprecated: { id: string; modelCode: string; provider: string; displayName: string; endOfLifeDate: string | null }[];
    endOfLife30Days: { id: string; modelCode: string; provider: string; endOfLifeDate: string | null; daysRemaining: number | null }[];
    endOfLife7Days: { id: string; modelCode: string; provider: string; endOfLifeDate: string | null; daysRemaining: number | null }[];
    replacementAvailable: { id: string; modelCode: string; provider: string; replacement: string | null }[];
  };
  costTrend: { slug: string; series: { date: string; costEur: number }[]; totalEur: number }[];
  compliance: {
    euAiAct: { compliant: number; pendingReview: number; nonCompliant: number; exempt: number; total: number };
    gdpr: { euDataResidency: number; dpaRequired: number; dataMinimization: number; totalProfiles: number };
    transparency: { required: number; aiLabelRequired: number };
    deepfakeDisclosure: { required: number };
    auditLog: { id: string; action: string; actor: string; createdAt: string }[];
  };
  notifications: {
    id: string;
    severity: "info" | "warning" | "critical";
    title: string;
    message: string;
    href?: string;
    createdAt: string;
  }[];
};

function MetricCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | null;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        {trend === "up" && <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
        {trend === "down" && <ArrowDownRight className="h-4 w-4 text-red-500" />}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

function HealthBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    HEALTHY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    DEGRADED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    DOWN: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    DISABLED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    NOT_CONFIGURED: "bg-slate-100 text-slate-500",
    UNKNOWN: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors[status] ?? colors.UNKNOWN)}>
      {status}
    </span>
  );
}

function MiniCostChart({ series }: { series: { date: string; costEur: number }[] }) {
  const max = Math.max(...series.map((s) => s.costEur), 0.01);
  if (series.length === 0) {
    return <p className="text-xs text-slate-500">No cost data (30d)</p>;
  }
  return (
    <div className="flex h-12 items-end gap-px">
      {series.map((s) => (
        <div
          key={s.date}
          title={`${s.date}: €${s.costEur.toFixed(2)}`}
          className="min-w-[3px] flex-1 rounded-t bg-indigo-500/70 dark:bg-indigo-400/60"
          style={{ height: `${Math.max(4, (s.costEur / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function OpsDashboardClient() {
  const [data, setData] = useState<OpsDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ops-dashboard");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load dashboard");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Failed to load dashboard");
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) {
    return <ErrorState message={error} onRetry={load} />;
  }

  if (!data) {
    return <p className="text-sm text-slate-500">{loading ? "Loading operations dashboard…" : "No data"}</p>;
  }

  const revTrend =
    data.revenue.yesterday > 0
      ? data.revenue.today >= data.revenue.yesterday
        ? "up"
        : "down"
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Commercial Operations</h1>
          <p className="text-sm text-slate-500">
            Revenue, margin, usage, provider health & compliance — live from platform data.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Updated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Notifications */}
      {data.notifications.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            <CardTitle>Notification Center</CardTitle>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-100">
              {data.notifications.length}
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {data.notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-lg border border-amber-100 bg-white/80 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-slate-900/50">
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    n.severity === "critical" ? "text-red-500" : n.severity === "warning" ? "text-amber-500" : "text-slate-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  {n.href ? (
                    <Link href={n.href} className="font-medium text-slate-900 hover:underline dark:text-white">
                      {n.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{n.title}</span>
                  )}
                  <p className="text-slate-500">{n.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Revenue */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <DollarSign className="h-4 w-4" /> Revenue
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Today" value={`€${data.revenue.today.toFixed(2)}`} trend={revTrend} />
          <MetricCard label="Yesterday" value={`€${data.revenue.yesterday.toFixed(2)}`} />
          <MetricCard label="This Month" value={`€${data.revenue.thisMonth.toFixed(2)}`} />
          <MetricCard
            label="Last Month"
            value={`€${data.revenue.lastMonth.toFixed(2)}`}
            trend={
              data.revenue.lastMonth > 0 && data.revenue.thisMonth >= data.revenue.lastMonth ? "up" : "down"
            }
          />
        </div>
      </section>

      {/* Profit */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <TrendingUp className="h-4 w-4" /> Profit
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Gross Margin" value={`€${data.profit.grossMarginEur.toFixed(2)}`} sub="This month" />
          <MetricCard label="Net Margin" value={`€${data.profit.netMarginEur.toFixed(2)}`} sub="After 10% overhead" />
          <MetricCard label="Margin %" value={`${data.profit.marginPercent}%`} sub={`Gross ${data.profit.grossMarginPercent}% · Net ${data.profit.netMarginPercent}%`} />
          <MetricCard label="Provider Cost" value={`€${data.profit.providerCostMonth.toFixed(2)}`} sub={`vs €${data.profit.revenueMonth.toFixed(2)} revenue`} />
        </div>
      </section>

      {/* API Usage */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Activity className="h-4 w-4" /> API Usage
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Requests Today" value={data.apiUsage.requestsToday.toLocaleString()} />
          <MetricCard label="Tokens Today" value={data.apiUsage.tokensToday.toLocaleString()} />
          <MetricCard label="Credits Sold" value={data.apiUsage.creditsSoldToday.toLocaleString()} sub="Today (payments)" />
          <MetricCard label="Active Customers" value={String(data.apiUsage.activeCustomers)} sub="Used API (30d)" />
        </div>
      </section>

      {/* Provider Health */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <Server className="h-4 w-4" /> Provider Health
          </h2>
          <Link href="/dashboard/admin/providers" className="text-xs text-indigo-600 hover:underline">
            Manage providers →
          </Link>
        </div>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700">
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Avg Latency</th>
                <th className="px-4 py-3">Error Rate</th>
                <th className="px-4 py-3">Success Rate</th>
                <th className="px-4 py-3">Weight</th>
                <th className="px-4 py-3">Cost Today</th>
                <th className="px-4 py-3">Requests</th>
              </tr>
            </thead>
            <tbody>
              {data.providerHealth.map((p) => (
                <tr key={p.slug} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium capitalize">{p.slug}</td>
                  <td className="px-4 py-3">
                    <HealthBadge
                      status={
                        p.status === "NOT_CONFIGURED"
                          ? "NOT_CONFIGURED"
                          : !p.enabled
                            ? "DISABLED"
                            : p.healthStatus
                      }
                    />
                  </td>
                  <td className="px-4 py-3">{p.avgLatencyMs != null ? `${p.avgLatencyMs} ms` : "—"}</td>
                  <td className="px-4 py-3">{p.errorRate}%</td>
                  <td className="px-4 py-3">{p.successRate}%</td>
                  <td className="px-4 py-3">{p.routingWeight}</td>
                  <td className="px-4 py-3">€{p.currentCostEur.toFixed(2)}</td>
                  <td className="px-4 py-3">{p.requestsToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Model Lifecycle Alerts */}
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Model Lifecycle Alerts</CardTitle>
            <Link href="/dashboard/admin/models" className="text-xs text-indigo-600 hover:underline">
              Lifecycle →
            </Link>
          </div>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Deprecated ({data.lifecycleAlerts.deprecated.length})
              </p>
              {data.lifecycleAlerts.deprecated.length === 0 ? (
                <p className="text-slate-500">None</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {data.lifecycleAlerts.deprecated.slice(0, 5).map((m) => (
                    <li key={m.id} className="text-slate-600 dark:text-slate-400">
                      {m.provider}/{m.modelCode}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">
                End of life ≤30 days ({data.lifecycleAlerts.endOfLife30Days.length})
              </p>
              <ul className="mt-1 space-y-1">
                {data.lifecycleAlerts.endOfLife30Days.map((m) => (
                  <li key={m.id}>
                    {m.provider}/{m.modelCode} — {m.endOfLifeDate} ({m.daysRemaining}d)
                  </li>
                ))}
                {data.lifecycleAlerts.endOfLife30Days.length === 0 && <li className="text-slate-500">None</li>}
              </ul>
            </div>
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">
                End of life ≤7 days ({data.lifecycleAlerts.endOfLife7Days.length})
              </p>
              <ul className="mt-1 space-y-1">
                {data.lifecycleAlerts.endOfLife7Days.map((m) => (
                  <li key={m.id}>
                    {m.provider}/{m.modelCode} — {m.endOfLifeDate} ({m.daysRemaining}d)
                  </li>
                ))}
                {data.lifecycleAlerts.endOfLife7Days.length === 0 && <li className="text-slate-500">None</li>}
              </ul>
            </div>
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Replacement available ({data.lifecycleAlerts.replacementAvailable.length})
              </p>
              <ul className="mt-1 space-y-1">
                {data.lifecycleAlerts.replacementAvailable.slice(0, 5).map((m) => (
                  <li key={m.id}>
                    {m.provider}/{m.modelCode} → {m.replacement}
                  </li>
                ))}
                {data.lifecycleAlerts.replacementAvailable.length === 0 && <li className="text-slate-500">None</li>}
              </ul>
            </div>
          </div>
        </Card>

        {/* Compliance Center */}
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Compliance Center
            </CardTitle>
            <Link href="/dashboard/admin/compliance" className="text-xs text-indigo-600 hover:underline">
              Full center →
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs font-medium uppercase text-slate-500">EU AI Act</p>
              <p className="mt-1">
                <span className="text-emerald-600">{data.compliance.euAiAct.compliant} compliant</span>
                {" · "}
                <span className="text-amber-600">{data.compliance.euAiAct.pendingReview} pending</span>
                {" · "}
                <span className="text-red-600">{data.compliance.euAiAct.nonCompliant} non-compliant</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs font-medium uppercase text-slate-500">GDPR</p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                EU residency {data.compliance.gdpr.euDataResidency} · DPA {data.compliance.gdpr.dpaRequired} · Minimization {data.compliance.gdpr.dataMinimization}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs font-medium uppercase text-slate-500">Transparency</p>
              <p className="mt-1">{data.compliance.transparency.required} required · {data.compliance.transparency.aiLabelRequired} AI labels</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs font-medium uppercase text-slate-500">Deepfake disclosure</p>
              <p className="mt-1">{data.compliance.deepfakeDisclosure.required} models require disclosure</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase text-slate-500">Recent audit log</p>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
              {data.compliance.auditLog.length === 0 ? (
                <li className="text-slate-500">No compliance audit entries</li>
              ) : (
                data.compliance.auditLog.map((log) => (
                  <li key={log.id} className="flex justify-between gap-2 border-b border-slate-50 py-1 dark:border-slate-800">
                    <span className="truncate">{log.action}</span>
                    <span className="shrink-0 text-slate-400">{log.createdAt.slice(0, 10)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </Card>
      </div>

      {/* Cost Trend */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <TrendingUp className="h-4 w-4" /> Cost Trend (30 days)
          </h2>
          <Link href="/dashboard/admin/cost-calculator" className="text-xs text-indigo-600 hover:underline">
            Cost calculator →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {data.costTrend.map((p) => (
            <Card key={p.slug} className="p-4">
              <p className="text-sm font-semibold capitalize">{p.slug}</p>
              <p className="text-lg font-bold">€{p.totalEur.toFixed(2)}</p>
              <p className="text-xs text-slate-500">30-day provider cost</p>
              <div className="mt-3">
                <MiniCostChart series={p.series} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-6 dark:border-slate-800">
        {[
          { href: "/dashboard/admin/revenue", label: "Revenue detail" },
          { href: "/dashboard/admin/providers", label: "Providers" },
          { href: "/dashboard/admin/models", label: "Models" },
          { href: "/dashboard/admin/compliance", label: "Compliance" },
          { href: "/dashboard/admin/security-events", label: "Security" },
          { href: "/dashboard/admin/audit", label: "AI Audit" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
