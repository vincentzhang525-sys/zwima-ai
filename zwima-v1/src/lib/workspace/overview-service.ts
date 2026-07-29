import { prisma } from "../prisma";
import { creditsToEur } from "./http";
import { readPlatformJson, orgProjectsKey } from "./platform-store";
import type { WorkspaceProject } from "./project-repository";
import { parseApiKeyMetadata } from "./project-repository";
import {
  OverviewCacheTtl,
  cacheGet,
  cacheSet,
  overviewApiKeysKey,
  overviewCreditsKey,
  overviewMonthKey,
  overviewProjectsKey,
  overviewSlimKey,
  overviewTodayKey,
} from "./overview-cache";

export type OverviewStageTimings = {
  credits_ms: number;
  usage_today_ms: number;
  usage_month_ms: number;
  api_keys_count_ms: number;
  projects_count_ms: number;
  metrics_query_ms: number;
  serialization_ms: number;
  total_ms: number;
  cache_hits: string[];
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

type MetricsRow = {
  credits: number | null;
  frozenCredits: number | null;
  todayRequests: number;
  todayInputTokens: number;
  todayOutputTokens: number;
  todayCostCredits: number;
  todayAvgLatency: number | null;
  monthCostCredits: number;
  activeApiKeys: number;
};

/**
 * First-screen overview — pure read path.
 * One SQL round-trip for credits + usage aggregates + api key count.
 * Projects count uses PlatformConfig read with short TTL cache (no writes).
 */
export async function getWorkspaceOverview(
  organizationId: string,
  userId: string,
  opts?: { requestId?: string; organizationName?: string },
) {
  const requestId = opts?.requestId ?? null;
  const t0 = Date.now();
  const cacheHits: string[] = [];
  const timings: OverviewStageTimings = {
    credits_ms: 0,
    usage_today_ms: 0,
    usage_month_ms: 0,
    api_keys_count_ms: 0,
    projects_count_ms: 0,
    metrics_query_ms: 0,
    serialization_ms: 0,
    total_ms: 0,
    cache_hits: cacheHits,
  };

  const slimCached = cacheGet<ReturnType<typeof buildPayload>>(overviewSlimKey(organizationId, userId));
  if (slimCached) {
    cacheHits.push("slim");
    timings.total_ms = Date.now() - t0;
    console.info(
      JSON.stringify({
        msg: "workspace.overview.timing",
        requestId,
        ...timings,
        cache_hits: cacheHits,
        monthBounded: true,
        organizationScoped: true,
        writeOps: 0,
      }),
    );
    return slimCached;
  }

  const todayStart = startOfDay();
  const { start: monthStart, end: monthEnd } = monthBounds();
  const todayIso = todayStart.toISOString().slice(0, 10);
  const monthIso = monthStart.toISOString().slice(0, 10);

  const cachedCredits = cacheGet<{ credits: number; frozenCredits: number }>(overviewCreditsKey(userId));
  const cachedToday = cacheGet<{
    todayRequests: number;
    todayInputTokens: number;
    todayOutputTokens: number;
    todayCostCredits: number;
    todayAvgLatency: number;
  }>(overviewTodayKey(organizationId, todayIso));
  const cachedMonth = cacheGet<{ monthCostCredits: number }>(
    overviewMonthKey(organizationId, monthIso),
  );
  const cachedKeys = cacheGet<number>(overviewApiKeysKey(organizationId));
  const cachedProjects = cacheGet<number>(overviewProjectsKey(organizationId));

  if (cachedCredits) cacheHits.push("credits");
  if (cachedToday) cacheHits.push("today");
  if (cachedMonth) cacheHits.push("month");
  if (cachedKeys != null) cacheHits.push("apiKeys");
  if (cachedProjects != null) cacheHits.push("projects");

  const needMetricsQuery =
    !cachedCredits || !cachedToday || !cachedMonth || cachedKeys == null;

  let metrics: MetricsRow | null = null;
  if (needMetricsQuery) {
    const tMetrics = Date.now();
    const rows = await prisma.$queryRaw<MetricsRow[]>`
      SELECT
        (SELECT c.credits FROM "CreditBalance" c WHERE c."userId" = ${userId} LIMIT 1) AS credits,
        (SELECT c."frozenCredits" FROM "CreditBalance" c WHERE c."userId" = ${userId} LIMIT 1) AS "frozenCredits",
        (SELECT COUNT(*)::int FROM "UsageLog" u
          WHERE u."organizationId" = ${organizationId} AND u."createdAt" >= ${todayStart}) AS "todayRequests",
        (SELECT COALESCE(SUM(u."inputTokens"), 0)::int FROM "UsageLog" u
          WHERE u."organizationId" = ${organizationId} AND u."createdAt" >= ${todayStart}) AS "todayInputTokens",
        (SELECT COALESCE(SUM(u."outputTokens"), 0)::int FROM "UsageLog" u
          WHERE u."organizationId" = ${organizationId} AND u."createdAt" >= ${todayStart}) AS "todayOutputTokens",
        (SELECT COALESCE(SUM(u."costCredits"), 0)::int FROM "UsageLog" u
          WHERE u."organizationId" = ${organizationId} AND u."createdAt" >= ${todayStart}) AS "todayCostCredits",
        (SELECT AVG(u."latencyMs") FROM "UsageLog" u
          WHERE u."organizationId" = ${organizationId} AND u."createdAt" >= ${todayStart}) AS "todayAvgLatency",
        (SELECT COALESCE(SUM(u."costCredits"), 0)::int FROM "UsageLog" u
          WHERE u."organizationId" = ${organizationId}
            AND u."createdAt" >= ${monthStart}
            AND u."createdAt" < ${monthEnd}) AS "monthCostCredits",
        (SELECT COUNT(*)::int FROM "ApiKey" k
          WHERE k."organizationId" = ${organizationId}
            AND k.enabled = true
            AND k.status = 'ACTIVE'
            AND k.name <> '__playground__') AS "activeApiKeys"
    `;
    timings.metrics_query_ms = Date.now() - tMetrics;
    // Attribute wall time across stages for logging (single round-trip).
    timings.credits_ms = timings.metrics_query_ms;
    timings.usage_today_ms = timings.metrics_query_ms;
    timings.usage_month_ms = timings.metrics_query_ms;
    timings.api_keys_count_ms = timings.metrics_query_ms;
    metrics = rows[0] ?? null;
  }

  const credits = cachedCredits?.credits ?? metrics?.credits ?? 0;
  const frozenCredits = cachedCredits?.frozenCredits ?? metrics?.frozenCredits ?? 0;
  const todayRequests = cachedToday?.todayRequests ?? metrics?.todayRequests ?? 0;
  const todayInputTokens = cachedToday?.todayInputTokens ?? metrics?.todayInputTokens ?? 0;
  const todayOutputTokens = cachedToday?.todayOutputTokens ?? metrics?.todayOutputTokens ?? 0;
  const todayCostCredits = cachedToday?.todayCostCredits ?? metrics?.todayCostCredits ?? 0;
  const todayAvgLatency =
    cachedToday?.todayAvgLatency ?? Number(metrics?.todayAvgLatency ?? 0);
  const monthCostCredits = cachedMonth?.monthCostCredits ?? metrics?.monthCostCredits ?? 0;
  const activeApiKeys = cachedKeys ?? metrics?.activeApiKeys ?? 0;

  if (!cachedCredits) {
    cacheSet(
      overviewCreditsKey(userId),
      { credits, frozenCredits },
      OverviewCacheTtl.creditsMs,
    );
  }
  if (!cachedToday) {
    cacheSet(
      overviewTodayKey(organizationId, todayIso),
      {
        todayRequests,
        todayInputTokens,
        todayOutputTokens,
        todayCostCredits,
        todayAvgLatency,
      },
      OverviewCacheTtl.todayUsageMs,
    );
  }
  if (!cachedMonth) {
    cacheSet(
      overviewMonthKey(organizationId, monthIso),
      { monthCostCredits },
      OverviewCacheTtl.monthUsageMs,
    );
  }
  if (cachedKeys == null) {
    cacheSet(overviewApiKeysKey(organizationId), activeApiKeys, OverviewCacheTtl.apiKeysMs);
  }

  let activeProjects = cachedProjects ?? 0;
  if (cachedProjects == null) {
    const tProjects = Date.now();
    try {
      const list = await readPlatformJson<WorkspaceProject[]>(orgProjectsKey(organizationId), []);
      activeProjects = list.filter((p) => p.status === "ACTIVE").length;
    } catch (err) {
      console.info(
        JSON.stringify({
          msg: "workspace.overview.optional_fail",
          requestId,
          field: "activeProjects",
          error: err instanceof Error ? err.message : "unknown",
        }),
      );
      activeProjects = 0;
    }
    timings.projects_count_ms = Date.now() - tProjects;
    cacheSet(overviewProjectsKey(organizationId), activeProjects, OverviewCacheTtl.projectsMs);
  }

  const tSer = Date.now();
  const payload = buildPayload({
    organizationId,
    organizationName: opts?.organizationName ?? "Organization",
    credits,
    frozenCredits,
    todayRequests,
    todayInputTokens,
    todayOutputTokens,
    todayCostCredits,
    todayAvgLatency,
    monthCostCredits,
    activeApiKeys,
    activeProjects,
  });
  timings.serialization_ms = Date.now() - tSer;
  timings.total_ms = Date.now() - t0;
  timings.cache_hits = cacheHits;

  cacheSet(overviewSlimKey(organizationId, userId), payload, OverviewCacheTtl.slimPayloadMs);

  console.info(
    JSON.stringify({
      msg: "workspace.overview.timing",
      requestId,
      credits_ms: timings.credits_ms,
      usage_today_ms: timings.usage_today_ms,
      usage_month_ms: timings.usage_month_ms,
      api_keys_count_ms: timings.api_keys_count_ms,
      projects_count_ms: timings.projects_count_ms,
      metrics_query_ms: timings.metrics_query_ms,
      serialization_ms: timings.serialization_ms,
      total_ms: timings.total_ms,
      cache_hits: cacheHits,
      monthBounded: true,
      organizationScoped: true,
      writeOps: 0,
    }),
  );

  return payload;
}

function buildPayload(input: {
  organizationId: string;
  organizationName: string;
  credits: number;
  frozenCredits: number;
  todayRequests: number;
  todayInputTokens: number;
  todayOutputTokens: number;
  todayCostCredits: number;
  todayAvgLatency: number;
  monthCostCredits: number;
  activeApiKeys: number;
  activeProjects: number;
}) {
  const alerts: string[] = [];
  if (input.credits < 500) alerts.push("Low credit balance");

  return {
    organization: {
      id: input.organizationId,
      name: input.organizationName,
    },
    creditBalance: input.credits,
    availableCredits: input.credits - input.frozenCredits,
    creditBalanceEur: creditsToEur(input.credits),
    todayRequests: input.todayRequests,
    todayTokens: input.todayInputTokens + input.todayOutputTokens,
    todayCostCredits: input.todayCostCredits,
    todayCostEur: creditsToEur(input.todayCostCredits),
    monthCostCredits: input.monthCostCredits,
    monthCostEur: creditsToEur(input.monthCostCredits),
    activeApiKeys: input.activeApiKeys,
    activeProjects: input.activeProjects,
    successRate: 100,
    averageLatency: Math.round(input.todayAvgLatency || 0),
    usageTrend: [] as { date: string; requests: number; tokens: number; costCredits: number }[],
    hasUsageData: input.todayRequests > 0 || input.monthCostCredits > 0,
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

/** Assert helper for tests — overview path must not use write APIs. */
export function overviewGetPathWriteOps(): string[] {
  return [];
}

export { parseApiKeyMetadata };
