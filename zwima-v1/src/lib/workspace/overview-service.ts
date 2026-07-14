import { prisma } from "../prisma";
import { buildOrgUsageWhere } from "./isolation";
import { projectRepository, parseApiKeyMetadata } from "./project-repository";
import { settingsService } from "./settings-service";
import { creditsToEur } from "./http";

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

export async function getWorkspaceOverview(organizationId: string, userId: string) {
  await projectRepository.ensureDefault(organizationId);
  const settings = await settingsService.get(organizationId, userId);

  const usageWhere = await buildOrgUsageWhere(organizationId);
  const todayStart = startOfDay();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const weekStart = daysAgo(7);

  const [
    balance,
    todayAgg,
    monthAgg,
    activeKeys,
    activeProjects,
    weekLogs,
    recentUsage,
    recentTx,
    providerDist,
    modelDist,
    org,
  ] = await Promise.all([
    prisma.creditBalance.findUnique({ where: { userId } }),
    prisma.usageLog.aggregate({
      where: { ...usageWhere, createdAt: { gte: todayStart } },
      _sum: { costCredits: true, inputTokens: true, outputTokens: true },
      _count: { id: true },
      _avg: { latencyMs: true },
    }),
    prisma.usageLog.aggregate({
      where: { ...usageWhere, createdAt: { gte: monthStart } },
      _sum: { costCredits: true },
      _count: { id: true },
    }),
    prisma.apiKey.count({
      where: { organizationId, enabled: true, status: "ACTIVE", name: { not: "__playground__" } },
    }),
    projectRepository.list(organizationId).then((p) => p.filter((x) => x.status === "ACTIVE").length),
    prisma.usageLog.findMany({
      where: { ...usageWhere, createdAt: { gte: weekStart } },
      select: { createdAt: true, costCredits: true, inputTokens: true, outputTokens: true, success: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.usageLog.findMany({
      where: usageWhere,
      include: { provider: true, apiKey: { select: { name: true, prefix: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.usageLog.groupBy({
      by: ["providerId"],
      where: { ...usageWhere, createdAt: { gte: monthStart } },
      _sum: { costCredits: true },
      _count: { id: true },
    }),
    prisma.usageLog.groupBy({
      by: ["model"],
      where: { ...usageWhere, createdAt: { gte: monthStart } },
      _sum: { costCredits: true },
      _count: { id: true },
    }),
    prisma.organization.findUnique({ where: { id: organizationId } }),
  ]);

  const todaySuccess = await prisma.usageLog.count({
    where: { ...usageWhere, createdAt: { gte: todayStart }, success: true },
  });
  const todayTotal = todayAgg._count.id;
  const successRate = todayTotal ? Math.round((todaySuccess / todayTotal) * 1000) / 10 : 100;

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
  const providers = await prisma.provider.findMany();
  const providerMap = Object.fromEntries(providers.map((p) => [p.id, p]));

  const monthCredits = monthAgg._sum.costCredits ?? 0;
  const balanceCredits = balance?.credits ?? 0;
  const alerts: string[] = [];
  if (settings.monthlyBudget != null && monthCredits >= settings.monthlyBudget) {
    alerts.push("Monthly budget exceeded");
  } else if (settings.monthlyBudget != null && monthCredits >= settings.monthlyBudget * 0.8) {
    alerts.push("Approaching monthly budget limit");
  }
  if (balanceCredits < 500) alerts.push("Low credit balance");

  return {
    organization: { id: organizationId, name: org?.name ?? "Organization" },
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
    activeProjects,
    successRate,
    averageLatency: Math.round(todayAgg._avg.latencyMs ?? 0),
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
    alerts,
    currency: "EUR" as const,
  };
}

export { parseApiKeyMetadata };
