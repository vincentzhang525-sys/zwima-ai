import { prisma } from "../prisma";

export async function getRoutingOverview() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [usageToday, usageYesterday, providers, auditDecisions] = await Promise.all([
    prisma.usageLog.findMany({ where: { createdAt: { gte: todayStart, lt: tomorrow } } }),
    prisma.usageLog.findMany({
      where: {
        createdAt: {
          gte: new Date(todayStart.getTime() - 86400000),
          lt: todayStart,
        },
      },
    }),
    prisma.provider.findMany({ include: { health: true } }),
    prisma.auditLog.findMany({
      where: { action: "smart_routing_decision", createdAt: { gte: todayStart } },
      take: 500,
    }),
  ]);

  const requestsToday = usageToday.length;
  const avgCost =
    requestsToday > 0
      ? usageToday.reduce((s, u) => s + Number(u.providerCost ?? 0), 0) / requestsToday
      : 0;
  const avgLatency =
    requestsToday > 0
      ? Math.round(usageToday.reduce((s, u) => s + (u.latencyMs ?? 0), 0) / requestsToday)
      : 0;
  const successRate =
    requestsToday > 0
      ? Math.round((usageToday.filter((u) => u.success).length / requestsToday) * 1000) / 10
      : 100;
  const fallbackLogs = await prisma.aiAuditLog.count({
    where: { createdAt: { gte: todayStart }, fallbackCount: { gt: 0 } },
  });
  const fallbackRate = requestsToday ? Math.round((fallbackLogs / requestsToday) * 1000) / 10 : 0;

  const providerStats = providers.map((p) => {
    const logs = usageToday.filter((u) => u.providerId === p.id);
    const reqs = logs.length;
    const selectedPct = requestsToday ? Math.round((reqs / requestsToday) * 1000) / 10 : 0;
    const errors = logs.filter((l) => !l.success).length;
    return {
      slug: p.slug,
      name: p.name,
      status: p.enabled ? p.status : "DISABLED",
      priority: p.priority,
      weight: p.weight,
      successRate: reqs ? Math.round(((reqs - errors) / reqs) * 1000) / 10 : p.health?.successRate ? Number(p.health.successRate) * 100 : 100,
      latencyP50: p.health?.latencyP50 ?? p.lastLatency,
      latencyP95: p.health?.latencyP95,
      costToday: logs.reduce((s, l) => s + Number(l.providerCost ?? 0), 0),
      requestsToday: reqs,
      selectedPct,
      fallbackIn: 0,
      fallbackOut: 0,
    };
  });

  const euRequests = auditDecisions.filter((a) => {
    const d = a.detail as Record<string, unknown> | null;
    const flags = d?.complianceFlags as Record<string, unknown> | undefined;
    return flags?.euDataResidency;
  }).length;

  const baselineCost = usageYesterday.reduce((s, u) => s + Number(u.providerCost ?? 0), 0);
  const todayCost = usageToday.reduce((s, u) => s + Number(u.providerCost ?? 0), 0);
  const estimatedSavings = Math.max(0, baselineCost - todayCost);

  return {
    requestsToday,
    averageCost: Math.round(avgCost * 10000) / 10000,
    averageLatency: avgLatency,
    successRate,
    fallbackRate,
    estimatedSavings: Math.round(estimatedSavings * 100) / 100,
    activeProviders: providers.filter((p) => p.enabled).length,
    euCompliantRequests: euRequests,
    providerStats,
  };
}

export async function listRoutingDecisions(params: {
  limit?: number;
  offset?: number;
  provider?: string;
  mode?: string;
  from?: Date;
  to?: Date;
}) {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;
  const where: Record<string, unknown> = { action: "smart_routing_decision" };
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  let items = logs.map((log) => {
    const d = (log.detail ?? {}) as Record<string, unknown>;
    return {
      id: log.id,
      requestId: d.requestId,
      selectedProvider: d.selectedProvider,
      selectedModel: d.selectedModel,
      mode: d.optimizationMode,
      cost: d.estimatedCost,
      score: d.totalScore,
      reason: Array.isArray(d.decisionReasons) ? (d.decisionReasons as string[]).join("; ") : "",
      fallbackCount: 0,
      compliance: d.complianceFlags,
      createdAt: log.createdAt.toISOString(),
      detail: d,
    };
  });

  if (params.provider) {
    items = items.filter((i) => i.selectedProvider === params.provider);
  }
  if (params.mode) {
    items = items.filter((i) => i.mode === params.mode);
  }

  return { items, total, limit, offset };
}

export async function getRoutingDecisionById(id: string) {
  const log = await prisma.auditLog.findUnique({ where: { id } });
  if (!log || log.action !== "smart_routing_decision") return null;
  return { id: log.id, createdAt: log.createdAt.toISOString(), detail: log.detail };
}
