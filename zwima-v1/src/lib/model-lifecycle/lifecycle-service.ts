import type { ProviderModelStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { parseComplianceNotes } from "../compliance/compliance-config";
import { toAdminStatus, toDbStatus, type AdminModelStatus } from "./lifecycle-status";

export const LIFECYCLE_STATUSES: ProviderModelStatus[] = [
  "DRAFT",
  "PREVIEW",
  "ACTIVE",
  "INACTIVE",
  "DEPRECATED",
  "SUNSET",
];

export type ModelLifecycleInput = {
  status?: AdminModelStatus | ProviderModelStatus;
  displayName?: string;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  region?: string | null;
  euAvailable?: boolean;
  replacementModelId?: string | null;
  endOfLifeDate?: string | null;
  deprecationDate?: string | null;
  releaseDate?: string | null;
  removalDate?: string | null;
};

export type ModelLifecycleView = {
  adminStatus: AdminModelStatus;
  endOfLifeDate: string | null;
  removalDate: string | null;
};

export function enrichModelLifecycle<T extends {
  status: ProviderModelStatus;
  deprecationDate: Date | null;
  compliance?: { notes: string | null } | null;
}>(model: T): T & ModelLifecycleView {
  const meta = parseComplianceNotes(model.compliance?.notes ?? null);
  return {
    ...model,
    adminStatus: toAdminStatus(model.status),
    endOfLifeDate: model.deprecationDate?.toISOString() ?? null,
    removalDate: meta.removalDate ?? null,
  };
}

export async function listModelsWithLifecycle() {
  const models = await prisma.providerModel.findMany({
    include: {
      provider: true,
      replacementModel: { select: { id: true, modelCode: true, displayName: true } },
      pricing: { orderBy: { effectiveFrom: "desc" }, take: 1 },
      compliance: true,
    },
    orderBy: [{ provider: { slug: "asc" } }, { modelCode: "asc" }],
  });
  return models.map(enrichModelLifecycle);
}

export async function updateModelLifecycle(id: string, input: ModelLifecycleInput) {
  const eol = input.endOfLifeDate ?? input.deprecationDate;

  if (input.removalDate !== undefined) {
    const model = await prisma.providerModel.findUnique({
      where: { id },
      include: { compliance: true },
    });
    if (model) {
      const { mergeCompliancePayload } = await import("../compliance/compliance-config");
      const notes = mergeCompliancePayload(model.compliance?.notes, {
        removalDate: input.removalDate,
      });
      await prisma.modelComplianceProfile.upsert({
        where: { providerModelId: id },
        create: {
          providerModelId: id,
          notes,
          transparencyRequired: false,
          aiGeneratedLabelRequired: true,
          deepfakeDisclosureRequired: false,
        },
        update: { notes },
      });
    }
  }

  const dbStatus = input.status !== undefined ? toDbStatus(input.status) : undefined;

  const updated = await prisma.providerModel.update({
    where: { id },
    data: {
      ...(dbStatus !== undefined ? { status: dbStatus } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.contextWindow !== undefined ? { contextWindow: input.contextWindow } : {}),
      ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.euAvailable !== undefined ? { euAvailable: input.euAvailable } : {}),
      ...(input.replacementModelId !== undefined ? { replacementModelId: input.replacementModelId } : {}),
      ...(eol !== undefined ? { deprecationDate: eol ? new Date(eol) : null } : {}),
      ...(input.releaseDate !== undefined
        ? { releaseDate: input.releaseDate ? new Date(input.releaseDate) : null }
        : {}),
    },
    include: {
      provider: true,
      replacementModel: { select: { id: true, modelCode: true, displayName: true } },
      compliance: true,
    },
  });

  return enrichModelLifecycle(updated);
}

export async function createProviderModel(data: {
  providerId: string;
  modelCode: string;
  displayName: string;
  contextWindow?: number;
  region?: string;
  euAvailable?: boolean;
  status?: AdminModelStatus | ProviderModelStatus;
}) {
  const created = await prisma.providerModel.create({
    data: {
      providerId: data.providerId,
      modelCode: data.modelCode,
      displayName: data.displayName,
      contextWindow: data.contextWindow,
      region: data.region,
      euAvailable: data.euAvailable ?? true,
      status: data.status ? toDbStatus(data.status) : "DRAFT",
      compliance: {
        create: {
          transparencyRequired: false,
          aiGeneratedLabelRequired: true,
          deepfakeDisclosureRequired: false,
          complianceStatus: "PENDING_REVIEW",
        },
      },
    },
    include: { provider: true, compliance: true },
  });
  return enrichModelLifecycle(created);
}

export function isRoutableStatus(status: ProviderModelStatus, vercelEnv?: string) {
  if (status === "ACTIVE") return true;
  if (status === "PREVIEW" && vercelEnv === "preview") return true;
  return false;
}
