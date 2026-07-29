import { prisma } from "../prisma";
import { creditsToEur } from "./http";
import { readPlatformJson, orgProjectsKey } from "./platform-store";
import type { WorkspaceProject } from "./project-repository";
import { parseApiKeyMetadata } from "./project-repository";

export type OverviewTiming = {
  credit_balance_ms: number;
  usage_aggregation_ms: number;
  billing_lookup_ms: number;
  projects_ms: number;
  api_keys_ms: number;
  total_ms: number;
};

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function monthBounds(d = new Date()): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

/** Bounded usage filter: organization + time window only (uses @@index([organizationId, createdAt])). */
export function boundedOrgUsageWhere(
  organizationId: string,
  range: { gte: Date; lt?: Date },
) {
  return {
    organizationId,
    createdAt: range.lt ? { gte: range.gte, lt: range.lt } : { gte: range.gte },
  };
}

async function timed<T>(
  bucket: Partial<OverviewTiming>,
  key: keyof OverviewTiming,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    bucket[key] = Date.now() - t0;
  }
}

/**
 * First-screen overview only.
 * Expensive charts / recent tables are deferred to getWorkspaceOverviewDetails.
 */
export async function getWorkspaceOverview(
  organizationId: string,
  userId: string,
  opts?: { requestId?: string; organizationName?: string },
) {
  const requestId = opts?.requestId ?? null;
  const timing: Partial<OverviewTiming> = {};
  const t0 = Date.now();
  const todayStart = startOfDay();
  const { start: monthStart, end: monthEnd } = monthBounds();

  const todayWhere = boundedOrgUsageWhere(organizationId, { gte: todayStart });
  const monthWhere = boundedOrgUsageWhere(organizationId, { gte: monthStart, lt: monthEnd });

  const usageAggStarted = Date.now();
  const [balance, todayAgg, monthAgg, activeKeys, projects] = await Promise.all([
    timed(timing, "credit_balance_ms", () =>
      prisma.creditBalance.findUnique({
        where: { userId },
        select: { credits: true, frozenCredits: true },
      }),
    ),
    prisma.usageLog.aggregate({
      where: todayWhere,
      _sum: { costCredits: true, inputTokens: true, outputTokens: true },
      _count: { id: true },
      _avg: { latencyMs: true },
    }),
    prisma.usageLog.aggregate({
      where: monthWhere,
      _sum: { costCredits: true },
      _count: { id: true },
    }),
    timed(timing, "api_keys_ms", () =>
      prisma.apiKey.count({
        where: {
          organizationId,
          enabled: true,
          status: "ACTIVE",
          name: { not: "__playground__" },
        },
      }),
    ),
    timed(timing, "projects_ms", async () => {
      try {
        const list = await readPlatformJson<WorkspaceProject[]>(orgProjectsKey(organizationId), []);
        return list.filter((p) => p.status === "ACTIVE").length;
      } catch (err) {
        console.info(
          JSON.stringify({
            msg: "workspace.overview.optional_fail",
            requestId,
            field: "activeProjects",
            error: err instanceof Error ? err.message : "unknown",
          }),
        );
        return 0;
      }
    }),
  ]);
  timing.usage_aggregation_ms = Date.now() - usageAggStarted;
  timing.billing_lookup_ms = 0;
  timing.total_ms = Date.now() - t0;

  const todayTotal = todayAgg._count.id;
  const monthCredits = monthAgg._sum.costCredits ?? 0;
  const balanceCredits = balance?.credits ?? 0;

  const alerts: string[] = [];
  if (balanceCredits < 500) alerts.push("Low credit balance");

  console.info(
    JSON.stringify({
      msg: "workspace.overview.timing",
      requestId,
      credit_balance_ms: timing.credit_balance_ms ?? 0,
      usage_aggregation_ms: timing.usage_aggregation_ms ?? 0,
      billing_lookup_ms: timing.billing_lookup_ms ?? 0,
      projects_ms: timing.projects_ms ?? 0,
      api_keys_ms: timing.api_keys_ms ?? 0,
      total_ms: timing.total_ms,
      monthBounded: true,
      organizationScoped: true,
    }),
  );

  return {
    organization: {
      id: organizationId,
      name: opts?.organizationName ?? "Organization",
    },
    creditBalance: balanceCredits,
    availableCredits: balanceCredits - (balance?.frozenCredits ?? 0),
    creditBalanceEur: creditsToEur(balanceCredits),
    todayRequests: todayTotal,
    todayTokens: (todayAgg._sum.inputTokens ?? 0) + (todayAgg._sum.outputTokens ?? 0),
    todayCostCredits: todayAgg._sum.costCredits ?? 0,
    todayCostEur: creditsToEur(todayAgg._sum.costCredits ?? 0),
    monthCostCredits: monthCredits,
    monthCostEur: creditsToEur(monthCredits),
    activeApiKeys: activeKeys,
    activeProjects: projects,
    // Optional first-screen defaults — details endpoint fills these
    successRate: todayTotal ? 100 : 100,
    averageLatency: Math.round(todayAgg._avg.latencyMs ?? 0),
    usageTrend: [] as { date: string; requests: number; tokens: number; costCredits: number }[],
    hasUsageData: todayTotal > 0 || monthCredits > 0,
    recentRequests: [] as unknown[],
    recentBilling: [] as unknown[],
    providerDistribution: [] as unknown[],
    modelDistribution: [] as unknown[],
    alerts,
    currency: "EUR" as const,
    detailsDeferred: true,
  };
}

/**
 * Non-blocking details for charts / recent tables.
 * Failures return safe defaults — never throw for optional stats.
 */
export async function getWorkspaceOverviewDetails(
  organizationId: string,
  userId: string,
  opts?: { requestId?: string },
) {
  const requestId = opts?.requestId ?? null;
  const t0 = Date.now();
  const todayStart = startOfDay();
  const weekStart = new Date(Date.now() - 7 * 86400000);
  const { start: monthStart, end: monthEnd } = monthBounds();
  const weekWhere = boundedOrgUsageWhere(organizationId, { gte: weekStart });
  const monthWhere = boundedOrgUsageWhere(organizationId, { gte: monthStart, lt: monthEnd });
  const todayWhere = boundedOrgUsageWhere(organizationId, { gte: todayStart });

  const empty = {
    successRate: 100,
    usageTrend: [] as { date: string; requests: number; tokens: number; costCredits: number }[],
    hasUsageData: false,
    recentRequests: [] as unknown[],
    recentBilling: [] as unknown[],
    providerDistribution: [] as unknown[],
    modelDistribution: [] as unknown[],
  };

  try {
    const [weekLogs, recentUsage, recentTx, providerDist, modelDist, todaySuccess, todayTotal] =
      await Promise.all([
        prisma.usageLog
          .findMany({
            where: weekWhere,
            select: {
              createdAt: true,
              costCredits: true,
              inputTokens: true,
              outputTokens: true,
              success: true,
            },
            orderBy: { createdAt: "asc" },
            take: 500,
          })
          .catch(() => []),
        prisma.usageLog
          .findMany({
            where: monthWhere,
            include: { provider: { select: { name: true } }, apiKey: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 10,
          })
          .catch(() => []),
        prisma.transaction
          .findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              type: true,
              amountEur: true,
              amount: true,
              description: true,
              createdAt: true,
            },
          })
          .catch(() => []),
        prisma.usageLog
          .groupBy({
            by: ["providerId"],
            where: monthWhere,
            _sum: { costCredits: true },
            _count: { id: true },
          })
          .catch(() => []),
        prisma.usageLog
          .groupBy({
            by: ["model"],
            where: monthWhere,
            _sum: { costCredits: true },
            _count: { id: true },
          })
          .catch(() => []),
        prisma.usageLog.count({ where: { ...todayWhere, success: true } }).catch(() => 0),
        prisma.usageLog.count({ where: todayWhere }).catch(() => 0),
      ]);

    const trendMap = new Map<string, { requests: number; tokens: number; costCredits: number }>();
    for (const log of weekLogs) {
      const day = log.createdAt.toISOString().slice(0, 10);
      const cur = trendMap.get(day) ?? { requests: 0, tokens: 0, costCredits: 0 };
      cur.requests += 1;
      cur.tokens += log.inputTokens + log.outputTokens;
      cur.costCredits += log.costCredits;
      trendMap.set(day, cur);
    }
    const usageTrend = [...trendMap.entries()].map(([date, v]) => ({ date, ...v }));

    let providerMap: Record<string, { name: string }> = {};
    try {
      const ids = providerDist.map((p) => p.providerId);
      if (ids.length) {
        const providers = await prisma.provider.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        });
        providerMap = Object.fromEntries(providers.map((p) => [p.id, p]));
      }
    } catch (err) {
      console.info(
        JSON.stringify({
          msg: "workspace.overview.optional_fail",
          requestId,
          field: "providers",
          error: err instanceof Error ? err.message : "unknown",
        }),
      );
    }

    const successRate =
      todayTotal > 0 ? Math.round((todaySuccess / todayTotal) * 1000) / 10 : 100;

    console.info(
      JSON.stringify({
        msg: "workspace.overview.details.timing",
        requestId,
        total_ms: Date.now() - t0,
      }),
    );

    return {
      successRate,
      usageTrend,
      hasUsageData: usageTrend.length > 0,
      recentRequests: recentUsage.map((r) => ({
        id: r.id,
        requestId: r.requestId,
        time: r.createdAt.toISOString(),
        provider: r.provider.name,
        model: r.model,
        costCredits: r.costCredits,
        costEur: creditsToEur(r.costCredits),
        latencyMs: r.latencyMs,
        success: r.success,
        apiKeyName: r.apiKey?.name ?? null,
      })),
      recentBilling: recentTx.map((t) => ({
        id: t.id,
        type: t.type,
        amountEur: Number(t.amountEur ?? 0),
        credits: t.amount,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
      providerDistribution: providerDist.map((row) => ({
        provider: providerMap[row.providerId]?.name ?? "Unknown",
        credits: row._sum.costCredits ?? 0,
        requests: row._count.id,
      })),
      modelDistribution: modelDist.map((row) => ({
        model: row.model,
        credits: row._sum.costCredits ?? 0,
        requests: row._count.id,
      })),
    };
  } catch (err) {
    console.info(
      JSON.stringify({
        msg: "workspace.overview.details.fail",
        requestId,
        error: err instanceof Error ? err.message : "unknown",
        total_ms: Date.now() - t0,
      }),
    );
    return empty;
  }
}

export { parseApiKeyMetadata };
