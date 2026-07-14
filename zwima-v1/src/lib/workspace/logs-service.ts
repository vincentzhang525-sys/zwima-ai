import { prisma } from "../prisma";
import { buildOrgUsageWhere } from "./isolation";
import { parseApiKeyMetadata, projectRepository } from "./project-repository";
import { creditsToEur, paginate } from "./http";
import type { logsQuerySchema } from "./schemas";
import type { z } from "zod";

type LogsQuery = z.infer<typeof logsQuerySchema>;

function sanitizeError(message: string | null | undefined): string | null {
  if (!message) return null;
  return message
    .replace(/sk_live_[A-Za-z0-9_-]+/gi, "[REDACTED_KEY]")
    .replace(/Bearer\s+\S+/gi, "[REDACTED_TOKEN]")
    .slice(0, 240);
}

export async function getWorkspaceLogs(organizationId: string, query: LogsQuery) {
  const usageWhere = await buildOrgUsageWhere(organizationId);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;

  const logs = await prisma.usageLog.findMany({
    where: usageWhere,
    include: {
      provider: true,
      apiKey: { select: { id: true, name: true, metadata: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const auditLogs = await prisma.aiAuditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const auditByRequest = Object.fromEntries(auditLogs.map((a) => [a.requestId, a]));
  const projects = await projectRepository.list(organizationId);
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const rows = logs.map((l) => {
    const audit = l.requestId ? auditByRequest[l.requestId] : undefined;
    const meta = parseApiKeyMetadata(l.apiKey?.metadata);
    return {
      id: l.id,
      auditId: audit?.id ?? null,
      timestamp: l.createdAt.toISOString(),
      requestId: l.requestId ?? l.id,
      project: meta.projectId ? projectMap[meta.projectId] ?? "—" : "—",
      apiKey: l.apiKey?.name ?? "—",
      provider: l.provider.name,
      model: l.model,
      httpStatus: l.success ? 200 : 502,
      latencyMs: l.latencyMs,
      inputTokens: l.inputTokens,
      outputTokens: l.outputTokens,
      credits: l.costCredits,
      costEur: creditsToEur(l.costCredits),
      routingMode: audit?.strategy ?? meta.routingMode ?? "BALANCED",
      failover: (audit?.fallbackCount ?? 0) > 0,
      complianceStatus: audit?.dataResidency ?? null,
    };
  });

  const paged = paginate(rows, page, pageSize);
  return { ...paged, currency: "EUR" as const };
}

export async function getWorkspaceLogDetail(organizationId: string, id: string) {
  const usageWhere = await buildOrgUsageWhere(organizationId);
  const log = await prisma.usageLog.findFirst({
    where: { id, ...usageWhere },
    include: { provider: true, apiKey: { select: { name: true, metadata: true } } },
  });
  if (!log) return null;

  const audit = log.requestId
    ? await prisma.aiAuditLog.findFirst({ where: { requestId: log.requestId, organizationId } })
    : null;

  const routingAudit = log.requestId
    ? await prisma.auditLog.findFirst({
        where: { action: "smart_routing_decision" },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const detail = routingAudit?.detail as Record<string, unknown> | null;
  const candidates = (detail?.candidates as unknown[]) ?? [];
  const rejected = (detail?.rejected as unknown[]) ?? [];
  const scoreBreakdown = detail?.scoreBreakdown ?? null;

  const meta = parseApiKeyMetadata(log.apiKey?.metadata);

  return {
    id: log.id,
    requestId: log.requestId,
    timestamp: log.createdAt.toISOString(),
    provider: log.provider.name,
    model: log.model,
    httpStatus: log.success ? 200 : 502,
    latencyMs: log.latencyMs,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
    credits: log.costCredits,
    costEur: creditsToEur(log.costCredits),
    routingMode: audit?.strategy ?? meta.routingMode ?? "BALANCED",
    routingReason: audit?.routingReason ?? null,
    selectedProvider: audit?.selectedProvider ?? log.provider.name,
    selectedModel: audit?.selectedModel ?? log.model,
    routingCandidates: candidates,
    rejectedCandidates: rejected,
    scoreBreakdown,
    failover: {
      occurred: (audit?.fallbackCount ?? 0) > 0,
      count: audit?.fallbackCount ?? 0,
      attemptedProviders: audit?.attemptedProviders ?? [],
    },
    compliance: {
      dataResidency: audit?.dataResidency ?? null,
      region: audit?.region ?? null,
    },
    auditReference: audit?.id ?? null,
    errorCode: audit?.errorCode ?? (log.success ? null : "PROVIDER_ERROR"),
    errorMessage: sanitizeError(log.errorMessage),
    promptSummary: audit?.promptHash ? `hash:${audit.promptHash.slice(0, 12)}…` : null,
    responseSummary: audit?.completionHash ? `hash:${audit.completionHash.slice(0, 12)}…` : null,
  };
}
