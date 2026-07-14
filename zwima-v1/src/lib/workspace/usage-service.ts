import { prisma } from "../prisma";
import { buildOrgUsageWhere, getOrgApiKeyIds } from "./isolation";
import { parseApiKeyMetadata, projectRepository } from "./project-repository";
import { creditsToEur, paginate } from "./http";
import type { usageQuerySchema } from "./schemas";
import type { z } from "zod";

type UsageQuery = z.infer<typeof usageQuerySchema>;

function resolveRange(query: UsageQuery): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date();
  if (query.range === "custom" && query.from) {
    return { from: new Date(query.from), to };
  }
  const from = new Date();
  if (query.range === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (query.range === "30d") {
    from.setDate(from.getDate() - 30);
  } else {
    from.setDate(from.getDate() - 7);
  }
  return { from, to };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export async function getWorkspaceUsage(organizationId: string, query: UsageQuery) {
  const { from, to } = resolveRange(query);
  const usageWhere = await buildOrgUsageWhere(organizationId);

  let apiKeyFilter: string[] | undefined;
  if (query.projectId) {
    const keys = await prisma.apiKey.findMany({
      where: { organizationId, name: { not: "__playground__" } },
      select: { id: true, metadata: true },
    });
    apiKeyFilter = keys
      .filter((k) => parseApiKeyMetadata(k.metadata).projectId === query.projectId)
      .map((k) => k.id);
    if (!apiKeyFilter.length) {
      return emptyUsageResponse(query);
    }
  }

  const where = {
    ...usageWhere,
    createdAt: { gte: from, lte: to },
    ...(query.apiKeyId ? { apiKeyId: query.apiKeyId } : {}),
    ...(apiKeyFilter ? { apiKeyId: { in: apiKeyFilter } } : {}),
    ...(query.model ? { model: query.model } : {}),
    ...(query.status === "success" ? { success: true } : {}),
    ...(query.status === "error" ? { success: false } : {}),
  };

  const logs = await prisma.usageLog.findMany({
    where,
    include: {
      provider: true,
      apiKey: { select: { id: true, name: true, prefix: true, metadata: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = query.provider
    ? logs.filter((l) => l.provider.slug === query.provider || l.provider.name === query.provider)
    : logs;

  const auditByRequest = await prisma.aiAuditLog.findMany({
    where: {
      organizationId,
      requestId: { in: filtered.map((l) => l.requestId).filter(Boolean) as string[] },
    },
    select: { requestId: true, strategy: true, routingReason: true },
  });
  const auditMap = Object.fromEntries(auditByRequest.map((a) => [a.requestId, a]));

  const routingFiltered = query.routingMode
    ? filtered.filter((l) => {
        if (!l.requestId) return false;
        const audit = auditMap[l.requestId];
        return audit?.strategy === query.routingMode;
      })
    : filtered;

  const latencies = routingFiltered.map((l) => l.latencyMs ?? 0).filter((n) => n > 0);
  const successCount = routingFiltered.filter((l) => l.success).length;
  const errorCount = routingFiltered.length - successCount;
  const totalCredits = routingFiltered.reduce((s, l) => s + l.costCredits, 0);
  const totalTokens = routingFiltered.reduce((s, l) => s + l.inputTokens + l.outputTokens, 0);
  const grossCost = routingFiltered.reduce((s, l) => s + Number(l.providerCost ?? 0), 0);

  const projects = await projectRepository.list(organizationId);
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const byDay = new Map<string, { requests: number; tokens: number; costCredits: number }>();
  const providerMap = new Map<string, number>();
  const modelMap = new Map<string, number>();
  const errorMap = new Map<string, number>();

  for (const log of routingFiltered) {
    const day = log.createdAt.toISOString().slice(0, 10);
    const cur = byDay.get(day) ?? { requests: 0, tokens: 0, costCredits: 0 };
    cur.requests += 1;
    cur.tokens += log.inputTokens + log.outputTokens;
    cur.costCredits += log.costCredits;
    byDay.set(day, cur);

    providerMap.set(log.provider.name, (providerMap.get(log.provider.name) ?? 0) + 1);
    modelMap.set(log.model, (modelMap.get(log.model) ?? 0) + 1);
    if (!log.success) {
      const err = log.errorMessage?.slice(0, 40) || "Unknown";
      errorMap.set(err, (errorMap.get(err) ?? 0) + 1);
    }
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const rows = routingFiltered.map((l) => {
    const meta = parseApiKeyMetadata(l.apiKey?.metadata);
    const audit = l.requestId ? auditMap[l.requestId] : undefined;
    return {
      id: l.id,
      timestamp: l.createdAt.toISOString(),
      requestId: l.requestId,
      project: meta.projectId ? projectMap[meta.projectId] ?? "—" : "—",
      projectId: meta.projectId ?? null,
      apiKey: l.apiKey?.name ?? "—",
      apiKeyId: l.apiKeyId,
      provider: l.provider.name,
      model: l.model,
      status: l.success ? "success" : "error",
      latencyMs: l.latencyMs,
      tokens: l.inputTokens + l.outputTokens,
      inputTokens: l.inputTokens,
      outputTokens: l.outputTokens,
      costCredits: l.costCredits,
      costEur: creditsToEur(l.costCredits),
      credits: l.costCredits,
      routingMode: audit?.strategy ?? meta.routingMode ?? "BALANCED",
    };
  });

  const paged = paginate(rows, page, pageSize);

  return {
    summary: {
      requests: routingFiltered.length,
      tokens: totalTokens,
      credits: totalCredits,
      grossCostEur: Math.round(grossCost * 10000) / 10000,
      billedAmountEur: creditsToEur(totalCredits),
      estimatedMarginEur: Math.max(0, Math.round((creditsToEur(totalCredits) - grossCost) * 10000) / 10000),
      successRate: routingFiltered.length ? Math.round((successCount / routingFiltered.length) * 1000) / 10 : 100,
      errorRate: routingFiltered.length ? Math.round((errorCount / routingFiltered.length) * 1000) / 10 : 0,
      averageLatency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      p95Latency: percentile(latencies, 95),
    },
    charts: {
      requestsTrend: [...byDay.entries()].map(([date, v]) => ({ date, requests: v.requests })),
      tokenTrend: [...byDay.entries()].map(([date, v]) => ({ date, tokens: v.tokens })),
      costTrend: [...byDay.entries()].map(([date, v]) => ({ date, costCredits: v.costCredits, costEur: creditsToEur(v.costCredits) })),
      providerDistribution: [...providerMap.entries()].map(([name, count]) => ({ name, count })),
      modelDistribution: [...modelMap.entries()].map(([name, count]) => ({ name, count })),
      errorDistribution: [...errorMap.entries()].map(([name, count]) => ({ name, count })),
      hasData: routingFiltered.length > 0,
    },
    ...paged,
    currency: "EUR" as const,
  };
}

function emptyUsageResponse(query: UsageQuery) {
  return {
    summary: {
      requests: 0,
      tokens: 0,
      credits: 0,
      grossCostEur: 0,
      billedAmountEur: 0,
      estimatedMarginEur: 0,
      successRate: 100,
      errorRate: 0,
      averageLatency: 0,
      p95Latency: 0,
    },
    charts: {
      requestsTrend: [],
      tokenTrend: [],
      costTrend: [],
      providerDistribution: [],
      modelDistribution: [],
      errorDistribution: [],
      hasData: false,
    },
    items: [],
    pagination: { page: query.page ?? 1, pageSize: query.pageSize ?? 25, total: 0, totalPages: 1 },
    currency: "EUR" as const,
  };
}

export async function exportWorkspaceUsageCsv(organizationId: string, query: UsageQuery): Promise<string> {
  const data = await getWorkspaceUsage(organizationId, { ...query, page: 1, pageSize: 10000 });
  const header = "Timestamp,Request ID,Project,API Key,Provider,Model,Status,Latency,Tokens,Cost EUR,Credits,Routing Mode\n";
  const lines = data.items.map((r) =>
    [
      r.timestamp,
      r.requestId ?? "",
      r.project,
      r.apiKey,
      r.provider,
      r.model,
      r.status,
      r.latencyMs ?? "",
      r.tokens,
      r.costEur,
      r.credits,
      r.routingMode,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(",")
  );
  return header + lines.join("\n");
}

export async function getOrgApiKeysForFilter(organizationId: string) {
  return getOrgApiKeyIds(organizationId);
}
