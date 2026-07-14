import type { ComplianceStatus } from "@prisma/client";
import { prisma } from "../prisma";
import {
  mergeCompliancePayload,
  parseComplianceNotes,
  type ComplianceConfigPayload,
  type GdprFlags,
} from "./compliance-config";

export type ComplianceProfileInput = {
  transparencyRequired?: boolean;
  aiGeneratedLabelRequired?: boolean;
  deepfakeDisclosureRequired?: boolean;
  complianceStatus?: ComplianceStatus;
  notes?: string | null;
  reviewedBy?: string | null;
  removalDate?: string | null;
  gdpr?: Partial<GdprFlags>;
  adminNotes?: string | null;
};

export type ComplianceProfileView = {
  gdpr: GdprFlags;
  removalDate: string | null;
  adminNotes: string | null;
};

function enrichProfile<T extends { notes: string | null }>(profile: T): T & ComplianceProfileView {
  const parsed = parseComplianceNotes(profile.notes);
  return {
    ...profile,
    gdpr: parsed.gdpr ?? {},
    removalDate: parsed.removalDate ?? null,
    adminNotes: parsed.adminNotes ?? null,
  };
}

export async function listComplianceProfiles() {
  const profiles = await prisma.modelComplianceProfile.findMany({
    include: {
      providerModel: { include: { provider: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return profiles.map(enrichProfile);
}

export async function getComplianceForModel(providerModelId: string) {
  const profile = await prisma.modelComplianceProfile.findUnique({
    where: { providerModelId },
    include: { providerModel: { include: { provider: true } } },
  });
  return profile ? enrichProfile(profile) : null;
}

export async function upsertComplianceProfile(
  providerModelId: string,
  input: ComplianceProfileInput,
) {
  const reviewed =
    input.complianceStatus && input.complianceStatus !== "PENDING_REVIEW"
      ? { reviewedAt: new Date(), reviewedBy: input.reviewedBy ?? null }
      : {};

  const existing = await prisma.modelComplianceProfile.findUnique({
    where: { providerModelId },
  });

  let notes: string | null | undefined = input.notes;
  if (
    input.removalDate !== undefined ||
    input.gdpr !== undefined ||
    input.adminNotes !== undefined
  ) {
    const patch: Partial<ComplianceConfigPayload> = {};
    if (input.removalDate !== undefined) patch.removalDate = input.removalDate;
    if (input.gdpr !== undefined) patch.gdpr = input.gdpr as GdprFlags;
    if (input.adminNotes !== undefined) patch.adminNotes = input.adminNotes ?? undefined;
    notes = mergeCompliancePayload(existing?.notes, patch);
  }

  const profile = await prisma.modelComplianceProfile.upsert({
    where: { providerModelId },
    create: {
      providerModelId,
      transparencyRequired: input.transparencyRequired ?? false,
      aiGeneratedLabelRequired: input.aiGeneratedLabelRequired ?? true,
      deepfakeDisclosureRequired: input.deepfakeDisclosureRequired ?? false,
      complianceStatus: input.complianceStatus ?? "PENDING_REVIEW",
      notes: notes ?? null,
      ...reviewed,
    },
    update: {
      ...(input.transparencyRequired !== undefined
        ? { transparencyRequired: input.transparencyRequired }
        : {}),
      ...(input.aiGeneratedLabelRequired !== undefined
        ? { aiGeneratedLabelRequired: input.aiGeneratedLabelRequired }
        : {}),
      ...(input.deepfakeDisclosureRequired !== undefined
        ? { deepfakeDisclosureRequired: input.deepfakeDisclosureRequired }
        : {}),
      ...(input.complianceStatus !== undefined ? { complianceStatus: input.complianceStatus } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...reviewed,
    },
    include: { providerModel: { include: { provider: true } } },
  });

  return enrichProfile(profile);
}

export type TransparencyProfile = {
  transparencyRequired: boolean;
  aiGeneratedLabelRequired: boolean;
  deepfakeDisclosureRequired: boolean;
  complianceStatus: ComplianceStatus;
  gdpr?: GdprFlags;
};

export function buildTransparencyHeaders(profile: TransparencyProfile) {
  if (profile.complianceStatus === "EXEMPT") {
    return {};
  }
  const headers: Record<string, string> = {};
  if (profile.transparencyRequired || profile.aiGeneratedLabelRequired) {
    headers["X-AI-Generated"] = "true";
    headers["X-AI-Transparency-Required"] = "true";
  }
  if (profile.deepfakeDisclosureRequired) {
    headers["X-AI-Synthetic-Media-Disclosure"] = "required";
  }
  const gdpr = profile.gdpr;
  if (gdpr?.euDataResidency) {
    headers["X-GDPR-EU-Data-Residency"] = "required";
  }
  if (gdpr?.requiresDpa) {
    headers["X-GDPR-DPA-Required"] = "true";
  }
  if (gdpr?.lawfulBasis) {
    headers["X-GDPR-Lawful-Basis"] = gdpr.lawfulBasis;
  }
  if (gdpr?.dataMinimization) {
    headers["X-GDPR-Data-Minimization"] = "true";
  }
  return headers;
}

export async function logComplianceAudit(params: {
  userId?: string;
  providerModelId: string;
  action: string;
  detail?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      category: "COMPLIANCE",
      detail: {
        providerModelId: params.providerModelId,
        ...params.detail,
      },
    },
  });
}
