import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import type { HumanReviewCase, HumanReviewPriority, HumanReviewStatus } from "@prisma/client";
import type { HumanReviewDecisionInput } from "./types";

const TERMINAL_STATUSES: HumanReviewStatus[] = ["APPROVED", "REJECTED", "WAIVED"];

/** Legal state machine for human review cases — no skipping straight to a decision from an already-terminal state. */
const ALLOWED_TRANSITIONS: Record<HumanReviewStatus, HumanReviewStatus[]> = {
  PENDING: ["IN_REVIEW", "APPROVED", "REJECTED", "WAIVED"],
  IN_REVIEW: ["APPROVED", "REJECTED", "WAIVED", "PENDING"],
  APPROVED: [],
  REJECTED: [],
  WAIVED: [],
};

export class InvalidReviewTransitionError extends Error {
  constructor(from: HumanReviewStatus, to: HumanReviewStatus) {
    super(`Illegal human review transition: ${from} -> ${to}`);
    this.name = "InvalidReviewTransitionError";
  }
}

export function isLegalReviewTransition(from: HumanReviewStatus, to: HumanReviewStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalReviewStatus(status: HumanReviewStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export type CreateHumanReviewCaseInput = {
  eventId: string;
  auditId: string;
  organizationId: string;
  workspaceId?: string | null;
  reviewMode: "OPTIONAL" | "REQUIRED" | "MANDATORY";
  reason: string;
  priority?: HumanReviewPriority;
  assignedReviewerId?: string | null;
};

export async function createHumanReviewCase(input: CreateHumanReviewCaseInput): Promise<HumanReviewCase> {
  const caseId = `rev_${randomUUID()}`;
  return prisma.$transaction(async (tx) => {
    const created = await tx.humanReviewCase.create({
      data: {
        caseId,
        eventId: input.eventId,
        auditId: input.auditId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId ?? null,
        reviewMode: input.reviewMode,
        status: "PENDING",
        priority: input.priority ?? "NORMAL",
        reason: input.reason,
        assignedReviewerId: input.assignedReviewerId ?? null,
      },
    });
    await tx.humanReviewHistory.create({
      data: {
        reviewCaseId: created.id,
        fromStatus: "PENDING",
        toStatus: "PENDING",
        note: "Case created",
      },
    });
    return created;
  });
}

/**
 * Transitions a review case to a new status inside a single transaction:
 * updates the case, appends a HumanReviewHistory entry, and mirrors the
 * decision onto the linked ComplianceAuditRecord.reviewStatus. Only the
 * mutable review fields on the audit record are touched — sealed factual
 * fields (integrityHash, promptHash, cost, tokens, etc.) are never
 * overwritten here.
 */
export async function updateHumanReviewStatus(input: HumanReviewDecisionInput): Promise<HumanReviewCase> {
  const existing = await prisma.humanReviewCase.findUnique({ where: { caseId: input.caseId } });
  if (!existing) throw new Error(`Human review case not found: ${input.caseId}`);

  if (!isLegalReviewTransition(existing.status, input.toStatus)) {
    throw new InvalidReviewTransitionError(existing.status, input.toStatus);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.humanReviewCase.update({
      where: { caseId: input.caseId },
      data: {
        status: input.toStatus,
        reviewedBy: isTerminalReviewStatus(input.toStatus) ? input.actorId ?? existing.reviewedBy : existing.reviewedBy,
        reviewedAt: isTerminalReviewStatus(input.toStatus) ? new Date() : existing.reviewedAt,
        decisionNotes: input.note ?? existing.decisionNotes,
      },
    });

    await tx.humanReviewHistory.create({
      data: {
        reviewCaseId: existing.id,
        fromStatus: existing.status,
        toStatus: input.toStatus,
        actorId: input.actorId ?? null,
        note: input.note ?? null,
      },
    });

    await tx.complianceAuditRecord.update({
      where: { auditId: existing.auditId },
      data: {
        reviewStatus: input.toStatus,
        humanReviewerId: input.actorId ?? undefined,
        reviewedAt: isTerminalReviewStatus(input.toStatus) ? new Date() : undefined,
        reviewNotes: input.note ?? undefined,
      },
    });

    await tx.aIEvent.update({
      where: { eventId: existing.eventId },
      data: { reviewStatus: input.toStatus },
    });

    return updated;
  });
}

export async function getHumanReviewCaseByCaseId(caseId: string): Promise<HumanReviewCase | null> {
  return prisma.humanReviewCase.findUnique({ where: { caseId } });
}

export async function listHumanReviewCases(params: {
  organizationId: string;
  workspaceId?: string | null;
  status?: HumanReviewStatus;
  limit?: number;
  cursor?: string;
}): Promise<HumanReviewCase[]> {
  return prisma.humanReviewCase.findMany({
    where: {
      organizationId: params.organizationId,
      workspaceId: params.workspaceId ?? undefined,
      status: params.status,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 50, 100),
    ...(params.cursor ? { cursor: { caseId: params.cursor }, skip: 1 } : {}),
  });
}

export async function getHumanReviewCaseHistory(caseId: string) {
  const reviewCase = await prisma.humanReviewCase.findUnique({ where: { caseId } });
  if (!reviewCase) return [];
  return prisma.humanReviewHistory.findMany({
    where: { reviewCaseId: reviewCase.id },
    orderBy: { createdAt: "asc" },
  });
}
