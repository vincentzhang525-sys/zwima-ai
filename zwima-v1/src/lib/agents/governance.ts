/**
 * V1.1 Agent Governance — additive agent tool/resource/approval/rollback/cost services.
 * No semantic break to existing agent execution-engine.
 */

import { prisma } from "../prisma";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { recordAIEvent } from "../compliance/event-recorder";

const HIGH_RISK_CATEGORIES = new Set([
  "email_send",
  "customer_data_modify",
  "data_delete",
  "payment",
  "api_key_manage",
  "permission_modify",
  "external_publish",
  "third_party_write",
]);

export async function authorizeToolExecution(input: {
  organizationId: string;
  agentRunId: string;
  toolName: string;
  toolCategory: string;
  permissionScope?: string;
}): Promise<{ authorized: boolean; requiresApproval: boolean; reason?: string }> {
  const isHighRisk = HIGH_RISK_CATEGORIES.has(input.toolCategory);
  if (isHighRisk) {
    return { authorized: false, requiresApproval: true, reason: "High-risk tool category requires human approval" };
  }
  return { authorized: true, requiresApproval: false };
}

export async function recordToolExecution(input: {
  organizationId: string;
  agentRunId: string;
  toolName: string;
  toolVersion?: string;
  toolCategory: string;
  inputHash?: string;
  outputHash?: string;
  externalSystem?: string;
  processingRegion?: string;
  permissionScope?: string;
  permissionGranted: boolean;
  humanApprovalRequired: boolean;
  humanApprovalStatus?: string;
  reversible?: boolean;
  rollbackReference?: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED" | "ROLLED_BACK";
  errorCode?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.agentToolExecution.create({
    data: {
      organizationId: input.organizationId,
      agentRunId: input.agentRunId,
      toolName: input.toolName,
      toolVersion: input.toolVersion,
      toolCategory: input.toolCategory,
      inputHash: input.inputHash,
      outputHash: input.outputHash,
      externalSystem: input.externalSystem,
      processingRegion: input.processingRegion,
      permissionScope: input.permissionScope,
      permissionGranted: input.permissionGranted,
      humanApprovalRequired: input.humanApprovalRequired,
      humanApprovalStatus: input.humanApprovalStatus,
      reversible: input.reversible ?? false,
      rollbackReference: input.rollbackReference,
      status: input.status,
      errorCode: input.errorCode,
      metadata: (input.metadata ?? undefined) as never,
    },
  });
}

export async function recordResourceAccess(input: {
  organizationId: string;
  agentRunId: string;
  resourceType: string;
  resourceIdentifier: string;
  accessType: string;
  sourceSystem?: string;
  processingRegion?: string;
  authorized: boolean;
  metadata?: Record<string, unknown>;
}) {
  return prisma.agentResourceAccess.create({
    data: {
      organizationId: input.organizationId,
      agentRunId: input.agentRunId,
      resourceType: input.resourceType,
      resourceIdentifierHash: createHash("sha256").update(input.resourceIdentifier).digest("hex"),
      accessType: input.accessType,
      sourceSystem: input.sourceSystem,
      processingRegion: input.processingRegion,
      authorized: input.authorized,
      metadata: (input.metadata ?? undefined) as never,
    },
  });
}

export async function requestHumanApproval(organizationId: string, agentRunId: string, reason: string) {
  await prisma.agentRun.update({
    where: { runId: agentRunId },
    data: { approvalStatus: "PENDING", status: "WAITING_REVIEW" },
  });
  return { agentRunId, approvalStatus: "PENDING", reason };
}

export async function approveAgentAction(organizationId: string, agentRunId: string, actorId: string) {
  const run = await prisma.agentRun.findUnique({ where: { runId: agentRunId } });
  if (!run || run.organizationId !== organizationId) throw new Error("AgentRun not found or unauthorized");
  await prisma.agentRun.update({
    where: { runId: agentRunId },
    data: { approvalStatus: "APPROVED" },
  });
  return { agentRunId, approvalStatus: "APPROVED", approvedBy: actorId };
}

export async function rejectAgentAction(organizationId: string, agentRunId: string, actorId: string) {
  const run = await prisma.agentRun.findUnique({ where: { runId: agentRunId } });
  if (!run || run.organizationId !== organizationId) throw new Error("AgentRun not found or unauthorized");
  await prisma.agentRun.update({
    where: { runId: agentRunId },
    data: { approvalStatus: "REJECTED", status: "FAILED" },
  });
  return { agentRunId, approvalStatus: "REJECTED", rejectedBy: actorId };
}

export async function rollbackAgentAction(organizationId: string, agentRunId: string) {
  const run = await prisma.agentRun.findUnique({ where: { runId: agentRunId } });
  if (!run || run.organizationId !== organizationId) throw new Error("AgentRun not found or unauthorized");
  await prisma.agentRun.update({
    where: { runId: agentRunId },
    data: { rollbackStatus: "ROLLED_BACK" },
  });
  return { agentRunId, rollbackStatus: "ROLLED_BACK" };
}

export function calculateAgentRunCost(run: {
  costEstimate?: number | null;
  costActual?: number | null;
  tokenUsage?: unknown;
}): { estimatedCost: number; actualCost: number } {
  return {
    estimatedCost: run.costEstimate ?? 0,
    actualCost: run.costActual ?? 0,
  };
}

export async function emitAgentComplianceEvent(input: {
  organizationId: string;
  agentRunId: string;
  provider: string;
  model: string;
  action: string;
}) {
  return recordAIEvent({
    requestId: `agent_gov_${randomUUID()}`,
    organizationId: input.organizationId,
    provider: input.provider,
    model: input.model,
    agentRunId: input.agentRunId,
    requestType: input.action,
    eventSource: "AGENT" as never,
  });
}
