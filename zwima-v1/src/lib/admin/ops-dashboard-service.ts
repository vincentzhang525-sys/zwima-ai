import { prisma } from "../prisma";
import { parseComplianceNotes } from "../compliance/compliance-config";
import { enrichModelLifecycle } from "../model-lifecycle/lifecycle-service";

const CORE_PROVIDERS = ["openai", "gemini", "claude", "deepseek", "qwen"] as const;

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

async function revenueBetween(from: Date, to: Date) {
  const agg = await prisma.payment.aggregate({
    where: { status: "COMPLETED", createdAt: { gte: from, lt: to } },
    _sum: { amountEur: true, credits: true },
  });
  return {
    eur: num(agg._sum.amountEur),
    credits: agg._sum.credits ?? 0,
  };
}

async function usageBetween(from: Date, to: Date) {
  const [agg, providerCost] = await Promise.all([
    prisma.usageLog.aggregate({
      where: { createdAt: { gte: from, lt: to } },
      _count: { id: true },
      _sum: { inputTokens: true, outputTokens: true, costCredits: true },
    }),
    prisma.usageLog.aggregate({
      where: { createdAt: { gte: from, lt: to } },
      _sum: { providerCost: true },
    }),
  ]);
  return {
    requests: agg._count.id,
    tokens: (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0),
    creditsConsumed: agg._sum.costCredits ?? 0,
    providerCostEur: num(providerCost._sum.providerCost),
  };
}

export async function getOpsDashboardData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const trendStart = daysFromNow(-30);
  const activeSince = daysFromNow(-30);
  const eol30 = daysFromNow(30);
  const eol7 = daysFromNow(7);

  const [
    revToday,
    revYesterday,
    revThisMonth,
    revLastMonth,
    usageToday,
    usageMonth,
    activeCustomers,
    providers,
    modelsRaw,
    complianceProfiles,
    complianceAudit,
    securityEvents,
    costLogs,
    creditsSoldToday,
  ] = await Promise.all([
    revenueBetween(todayStart, tomorrowStart),
    revenueBetween(yesterdayStart, todayStart),
    revenueBetween(monthStart, tomorrowStart),
    revenueBetween(lastMonthStart, monthStart),
    usageBetween(todayStart, tomorrowStart),
    usageBetween(monthStart, tomorrowStart),
    prisma.usageLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: activeSince } },
    }),
    prisma.provider.findMany({
      include: { health: true },
      orderBy: { priority: "desc" },
    }),
    prisma.providerModel.findMany({
      include: {
        provider: true,
        replacementModel: { select: { modelCode: true, displayName: true } },
        compliance: true,
      },
    }),
    prisma.modelComplianceProfile.findMany({
      include: { providerModel: { include: { provider: true } } },
    }),
    prisma.auditLog.findMany({
      where: { category: "COMPLIANCE" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { email: true } } },
    }),
    prisma.securityEvent.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.usageLog.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true, providerCost: true, providerId: true },
    }),
    prisma.payment.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: todayStart, lt: tomorrowStart } },
      _sum: { credits: true },
    }),
  ]);

  const providerMap = Object.fromEntries(providers.map((p) => [p.id, p]));
  const todayUsageByProvider = await prisma.usageLog.groupBy({
    by: ["providerId"],
    where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
    _count: { id: true },
    _avg: { latencyMs: true },
    _sum: { providerCost: true },
  });
  const todayErrorsByProvider = await prisma.usageLog.groupBy({
    by: ["providerId"],
    where: { createdAt: { gte: todayStart, lt: tomorrowStart }, success: false },
    _count: { id: true },
  });
  const usageTodayMap = Object.fromEntries(todayUsageByProvider.map((u) => [u.providerId, u]));
  const errorsTodayMap = Object.fromEntries(todayErrorsByProvider.map((e) => [e.providerId, e._count.id]));

  const revenueMonthEur = revThisMonth.eur;
  const providerCostMonth = usageMonth.providerCostEur;
  const grossMarginEur = revenueMonthEur - providerCostMonth;
  const netMarginEur = revenueMonthEur - providerCostMonth * 1.1;
  const grossMarginPct =
    revenueMonthEur > 0 ? Math.round((grossMarginEur / revenueMonthEur) * 1000) / 10 : 0;
  const netMarginPct =
    revenueMonthEur > 0 ? Math.round((netMarginEur / revenueMonthEur) * 1000) / 10 : 0;
  const marginPct = grossMarginPct;

  const providerHealth = CORE_PROVIDERS.map((slug) => {
    const p = providers.find((x) => x.slug === slug);
    if (!p) {
      return {
        slug,
        name: slug,
        status: "NOT_CONFIGURED",
        enabled: false,
        avgLatencyMs: null,
        errorRate: 0,
        successRate: 0,
        routingWeight: 0,
        currentCostEur: 0,
        requestsToday: 0,
        healthStatus: "UNKNOWN",
      };
    }
    const usage = usageTodayMap[p.id];
    const requests = usage?._count.id ?? 0;
    const errors = errorsTodayMap[p.id] ?? 0;
    const errorRate = requests ? Math.round((errors / requests) * 1000) / 10 : 0;
    const successRate = requests ? Math.round((100 - errorRate) * 10) / 10 : p.health?.successRate ? num(p.health.successRate) * 100 : 100;
    const avgLatency =
      usage?._avg.latencyMs != null
        ? Math.round(usage._avg.latencyMs)
        : p.health?.latencyP50 ?? p.lastLatency ?? null;

    return {
      slug: p.slug,
      name: p.name,
      status: p.enabled ? p.status : "DISABLED",
      enabled: p.enabled,
      avgLatencyMs: avgLatency,
      errorRate,
      successRate,
      routingWeight: p.weight,
      priority: p.priority,
      currentCostEur: num(usage?._sum.providerCost),
      requestsToday: requests,
      healthStatus: p.health?.status ?? "UNKNOWN",
      lastError: p.lastError,
    };
  });

  const models = modelsRaw.map(enrichModelLifecycle);
  const deprecated = models.filter((m) => m.adminStatus === "DEPRECATED" || m.status === "SUNSET");
  const eol30List = models.filter(
    (m) =>
      m.deprecationDate &&
      m.deprecationDate <= eol30 &&
      m.deprecationDate >= now &&
      m.adminStatus !== "DISABLED",
  );
  const eol7List = models.filter(
    (m) =>
      m.deprecationDate &&
      m.deprecationDate <= eol7 &&
      m.deprecationDate >= now &&
      m.adminStatus !== "DISABLED",
  );
  const replacementAvailable = models.filter((m) => m.replacementModelId && m.replacementModel);

  const costByProviderDay = new Map<string, Map<string, number>>();
  for (const log of costLogs) {
    const provider = providerMap[log.providerId];
    if (!provider) continue;
    const day = log.createdAt.toISOString().slice(0, 10);
    if (!costByProviderDay.has(provider.slug)) {
      costByProviderDay.set(provider.slug, new Map());
    }
    const dayMap = costByProviderDay.get(provider.slug)!;
    dayMap.set(day, (dayMap.get(day) ?? 0) + num(log.providerCost));
  }

  const costTrend = CORE_PROVIDERS.map((slug) => {
    const dayMap = costByProviderDay.get(slug) ?? new Map<string, number>();
    const series = [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, costEur]) => ({ date, costEur: Math.round(costEur * 100) / 100 }));
    const total = series.reduce((s, x) => s + x.costEur, 0);
    return { slug, series, totalEur: Math.round(total * 100) / 100 };
  });

  let euAiActCompliant = 0;
  let euAiActPending = 0;
  let euAiActNonCompliant = 0;
  let transparencyRequired = 0;
  let deepfakeRequired = 0;
  let gdprEuResidency = 0;
  let gdprDpaRequired = 0;
  let gdprDataMinimization = 0;

  for (const profile of complianceProfiles) {
    if (profile.complianceStatus === "COMPLIANT") euAiActCompliant++;
    else if (profile.complianceStatus === "NON_COMPLIANT") euAiActNonCompliant++;
    else if (profile.complianceStatus === "PENDING_REVIEW") euAiActPending++;
    if (profile.transparencyRequired) transparencyRequired++;
    if (profile.deepfakeDisclosureRequired) deepfakeRequired++;
    const gdpr = parseComplianceNotes(profile.notes).gdpr ?? {};
    if (gdpr.euDataResidency) gdprEuResidency++;
    if (gdpr.requiresDpa) gdprDpaRequired++;
    if (gdpr.dataMinimization) gdprDataMinimization++;
  }

  const notifications: {
    id: string;
    severity: "info" | "warning" | "critical";
    title: string;
    message: string;
    href?: string;
    createdAt: string;
  }[] = [];

  for (const ev of securityEvents) {
    if (ev.severity === "HIGH" || ev.severity === "CRITICAL") {
      notifications.push({
        id: `sec-${ev.id}`,
        severity: ev.severity === "CRITICAL" ? "critical" : "warning",
        title: `Security: ${ev.type}`,
        message: `Unresolved ${ev.severity.toLowerCase()} event`,
        href: "/dashboard/admin/security-events",
        createdAt: ev.createdAt.toISOString(),
      });
    }
  }

  for (const m of eol7List) {
    notifications.push({
      id: `eol-${m.id}`,
      severity: "critical",
      title: "Model end-of-life in 7 days",
      message: `${m.provider.slug}/${m.modelCode} — EOL ${m.deprecationDate?.toISOString().slice(0, 10)}`,
      href: "/dashboard/admin/models",
      createdAt: now.toISOString(),
    });
  }

  for (const p of providerHealth) {
    if (p.status === "NOT_CONFIGURED") continue;
    if (p.healthStatus === "DOWN" || !p.enabled) {
      notifications.push({
        id: `prov-${p.slug}`,
        severity: p.healthStatus === "DOWN" ? "critical" : "warning",
        title: `Provider ${p.name}`,
        message: p.healthStatus === "DOWN" ? "Provider is DOWN" : "Provider disabled",
        href: "/dashboard/admin/providers",
        createdAt: now.toISOString(),
      });
    }
    if (p.errorRate > 10 && p.requestsToday > 0) {
      notifications.push({
        id: `err-${p.slug}`,
        severity: "warning",
        title: `High error rate: ${p.name}`,
        message: `${p.errorRate}% errors today (${p.requestsToday} requests)`,
        href: "/dashboard/admin/providers",
        createdAt: now.toISOString(),
      });
    }
  }

  if (euAiActNonCompliant > 0) {
    notifications.push({
      id: "compliance-non",
      severity: "warning",
      title: "Compliance review needed",
      message: `${euAiActNonCompliant} model(s) marked NON_COMPLIANT`,
      href: "/dashboard/admin/compliance",
      createdAt: now.toISOString(),
    });
  }

  if (grossMarginPct < 15 && revenueMonthEur > 0) {
    notifications.push({
      id: "margin-low",
      severity: "warning",
      title: "Low gross margin",
      message: `Month gross margin is ${grossMarginPct}% (target ≥15%)`,
      href: "/dashboard/admin/revenue",
      createdAt: now.toISOString(),
    });
  }

  notifications.sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  return {
    generatedAt: now.toISOString(),
    revenue: {
      today: revToday.eur,
      yesterday: revYesterday.eur,
      thisMonth: revThisMonth.eur,
      lastMonth: revLastMonth.eur,
    },
    profit: {
      grossMarginEur: Math.round(grossMarginEur * 100) / 100,
      netMarginEur: Math.round(netMarginEur * 100) / 100,
      marginPercent: marginPct,
      grossMarginPercent: grossMarginPct,
      netMarginPercent: netMarginPct,
      providerCostMonth: Math.round(providerCostMonth * 100) / 100,
      revenueMonth: revenueMonthEur,
    },
    apiUsage: {
      requestsToday: usageToday.requests,
      tokensToday: usageToday.tokens,
      creditsSoldToday: creditsSoldToday._sum.credits ?? 0,
      creditsConsumedToday: usageToday.creditsConsumed,
      activeCustomers: activeCustomers.length,
    },
    providerHealth,
    lifecycleAlerts: {
      deprecated: deprecated.map((m) => ({
        id: m.id,
        modelCode: m.modelCode,
        provider: m.provider.slug,
        displayName: m.displayName,
        endOfLifeDate: m.endOfLifeDate,
      })),
      endOfLife30Days: eol30List.map((m) => ({
        id: m.id,
        modelCode: m.modelCode,
        provider: m.provider.slug,
        endOfLifeDate: m.deprecationDate?.toISOString().slice(0, 10) ?? null,
        daysRemaining: m.deprecationDate
          ? Math.ceil((m.deprecationDate.getTime() - now.getTime()) / 86400000)
          : null,
      })),
      endOfLife7Days: eol7List.map((m) => ({
        id: m.id,
        modelCode: m.modelCode,
        provider: m.provider.slug,
        endOfLifeDate: m.deprecationDate?.toISOString().slice(0, 10) ?? null,
        daysRemaining: m.deprecationDate
          ? Math.ceil((m.deprecationDate.getTime() - now.getTime()) / 86400000)
          : null,
      })),
      replacementAvailable: replacementAvailable.map((m) => ({
        id: m.id,
        modelCode: m.modelCode,
        provider: m.provider.slug,
        replacement: m.replacementModel
          ? `${m.replacementModel.modelCode} (${m.replacementModel.displayName})`
          : null,
      })),
    },
    costTrend,
    compliance: {
      euAiAct: {
        compliant: euAiActCompliant,
        pendingReview: euAiActPending,
        nonCompliant: euAiActNonCompliant,
        exempt: complianceProfiles.filter((p) => p.complianceStatus === "EXEMPT").length,
        total: complianceProfiles.length,
      },
      gdpr: {
        euDataResidency: gdprEuResidency,
        dpaRequired: gdprDpaRequired,
        dataMinimization: gdprDataMinimization,
        totalProfiles: complianceProfiles.length,
      },
      transparency: {
        required: transparencyRequired,
        aiLabelRequired: complianceProfiles.filter((p) => p.aiGeneratedLabelRequired).length,
      },
      deepfakeDisclosure: {
        required: deepfakeRequired,
      },
      auditLog: complianceAudit.map((log) => ({
        id: log.id,
        action: log.action,
        actor: log.user?.email ?? "system",
        createdAt: log.createdAt.toISOString(),
        detail: log.detail,
      })),
    },
    notifications: notifications.slice(0, 15),
  };
}
