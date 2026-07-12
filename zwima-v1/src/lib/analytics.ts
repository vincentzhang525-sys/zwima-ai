import { prisma } from "./prisma";

export type DateRange = "today" | "7d" | "30d" | "90d";

function rangeStart(range: DateRange): Date {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getDashboardStats(userId: string) {
  const startOfDay = rangeStart("today");
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [balance, todayUsage, monthUsage, activeKeys, subscription, recentUsage, providerDist] =
    await Promise.all([
      prisma.creditBalance.findUnique({ where: { userId } }),
      prisma.usageLog.aggregate({
        where: { userId, createdAt: { gte: startOfDay } },
        _sum: { costCredits: true, inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
      prisma.usageLog.aggregate({
        where: { userId, createdAt: { gte: startOfMonth } },
        _sum: { costCredits: true },
        _count: { id: true },
      }),
      prisma.apiKey.count({ where: { userId, enabled: true } }),
      prisma.subscription.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
      prisma.usageLog.findMany({
        where: { userId },
        include: { provider: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.usageLog.groupBy({
        by: ["providerId"],
        where: { userId, createdAt: { gte: startOfMonth } },
        _sum: { costCredits: true },
        _count: { id: true },
      }),
    ]);

  const providers = await prisma.provider.findMany();
  const providerMap = Object.fromEntries(providers.map((p) => [p.id, p]));

  const monthCredits = monthUsage._sum.costCredits ?? 0;
  const costSaved = Math.round(monthCredits * 0.15);

  return {
    balance: balance?.credits ?? 0,
    available: (balance?.credits ?? 0) - (balance?.frozenCredits ?? 0),
    todayRequests: todayUsage._count.id,
    todayCredits: todayUsage._sum.costCredits ?? 0,
    monthRequests: monthUsage._count.id,
    monthCredits,
    activeKeys,
    currentPlan: subscription?.plan ?? "FREE",
    costSaved,
    providerDistribution: providerDist.map((row) => ({
      provider: providerMap[row.providerId]?.name ?? "Unknown",
      slug: providerMap[row.providerId]?.slug ?? "",
      credits: row._sum.costCredits ?? 0,
      requests: row._count.id,
    })),
    recentRequests: recentUsage.map((r) => ({
      id: r.id,
      time: r.createdAt.toISOString(),
      provider: r.provider.name,
      model: r.model,
      cost: r.costCredits,
      latencyMs: r.latencyMs,
      success: r.success,
    })),
  };
}

export async function getAnalytics(userId: string, range: DateRange) {
  const since = rangeStart(range);
  const logs = await prisma.usageLog.findMany({
    where: { userId, createdAt: { gte: since } },
    include: { provider: true },
    orderBy: { createdAt: "asc" },
  });

  const tokenUsage = logs.reduce((s, l) => s + l.inputTokens + l.outputTokens, 0);
  const totalCost = logs.reduce((s, l) => s + l.costCredits, 0);
  const errors = logs.filter((l) => !l.success).length;
  const avgLatency =
    logs.length > 0 ? Math.round(logs.reduce((s, l) => s + (l.latencyMs ?? 0), 0) / logs.length) : 0;

  const byDay = new Map<string, { tokens: number; cost: number; requests: number; errors: number }>();
  for (const log of logs) {
    const day = log.createdAt.toISOString().slice(0, 10);
    const cur = byDay.get(day) ?? { tokens: 0, cost: 0, requests: 0, errors: 0 };
    cur.tokens += log.inputTokens + log.outputTokens;
    cur.cost += log.costCredits;
    cur.requests += 1;
    if (!log.success) cur.errors += 1;
    byDay.set(day, cur);
  }

  const costTrend = [...byDay.entries()].map(([date, v]) => ({ date, ...v }));

  const providerMap = new Map<string, number>();
  const modelMap = new Map<string, number>();
  const hourMap = new Map<number, number>();

  for (const log of logs) {
    providerMap.set(log.provider.name, (providerMap.get(log.provider.name) ?? 0) + 1);
    modelMap.set(log.model, (modelMap.get(log.model) ?? 0) + 1);
    const hour = log.createdAt.getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }

  return {
    range,
    tokenUsage,
    totalCost,
    requestCount: logs.length,
    errorRate: logs.length ? Math.round((errors / logs.length) * 1000) / 10 : 0,
    avgLatency,
    costTrend,
    providerDistribution: [...providerMap.entries()].map(([name, count]) => ({ name, count })),
    modelDistribution: [...modelMap.entries()].map(([name, count]) => ({ name, count })),
    requestsPerHour: [...hourMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hour, count]) => ({ hour, count })),
  };
}

export { rangeStart };
