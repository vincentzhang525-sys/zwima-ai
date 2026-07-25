import { prisma } from "../prisma";
import type { ProcessingRegionRegistry, ProviderRegionCapability, RegionGroup } from "@prisma/client";
import type { RegionPickInput, RegionPickResult } from "./types";

export type RegionUpsertInput = {
  code: string;
  name: string;
  countryCode?: string | null;
  regionGroup: RegionGroup;
  isEuEea?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
  dataResidencySupported?: boolean;
  description?: string | null;
};

export async function listRegions(params?: { activeOnly?: boolean }): Promise<ProcessingRegionRegistry[]> {
  return prisma.processingRegionRegistry.findMany({
    where: params?.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ regionGroup: "asc" }, { code: "asc" }],
  });
}

export async function getRegionByCode(code: string): Promise<ProcessingRegionRegistry | null> {
  return prisma.processingRegionRegistry.findUnique({ where: { code } });
}

export async function getRegionById(id: string): Promise<ProcessingRegionRegistry | null> {
  return prisma.processingRegionRegistry.findUnique({ where: { id } });
}

export async function upsertRegion(input: RegionUpsertInput): Promise<ProcessingRegionRegistry> {
  return prisma.processingRegionRegistry.upsert({
    where: { code: input.code },
    create: {
      code: input.code,
      name: input.name,
      countryCode: input.countryCode ?? null,
      regionGroup: input.regionGroup,
      isEuEea: input.isEuEea ?? false,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      dataResidencySupported: input.dataResidencySupported ?? true,
      description: input.description ?? null,
    },
    update: {
      name: input.name,
      countryCode: input.countryCode ?? null,
      regionGroup: input.regionGroup,
      isEuEea: input.isEuEea ?? false,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      dataResidencySupported: input.dataResidencySupported ?? true,
      description: input.description ?? null,
    },
  });
}

export type ProviderRegionCapabilityUpsertInput = {
  provider: string;
  regionId: string;
  registryEntryId?: string | null;
  supportsInference?: boolean;
  supportsProcessing?: boolean;
  supportsDataResidency?: boolean;
  crossBorderTransfer?: boolean;
  transferMechanism?: string | null;
  isActive?: boolean;
};

export async function listProviderRegionCapabilities(params?: {
  provider?: string;
  regionId?: string;
  activeOnly?: boolean;
}): Promise<ProviderRegionCapability[]> {
  return prisma.providerRegionCapability.findMany({
    where: {
      provider: params?.provider,
      regionId: params?.regionId,
      isActive: params?.activeOnly ? true : undefined,
    },
    include: { region: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createProviderRegionCapability(
  input: ProviderRegionCapabilityUpsertInput,
): Promise<ProviderRegionCapability> {
  return prisma.providerRegionCapability.create({
    data: {
      provider: input.provider,
      regionId: input.regionId,
      registryEntryId: input.registryEntryId ?? null,
      supportsInference: input.supportsInference ?? true,
      supportsProcessing: input.supportsProcessing ?? true,
      supportsDataResidency: input.supportsDataResidency ?? false,
      crossBorderTransfer: input.crossBorderTransfer ?? false,
      transferMechanism: input.transferMechanism ?? null,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateProviderRegionCapability(
  id: string,
  input: Partial<ProviderRegionCapabilityUpsertInput>,
): Promise<ProviderRegionCapability> {
  return prisma.providerRegionCapability.update({
    where: { id },
    data: {
      supportsInference: input.supportsInference,
      supportsProcessing: input.supportsProcessing,
      supportsDataResidency: input.supportsDataResidency,
      crossBorderTransfer: input.crossBorderTransfer,
      transferMechanism: input.transferMechanism,
      isActive: input.isActive,
    },
  });
}

/**
 * Picks the best processing region for a given provider, honoring EU
 * processing requirements and allowed-region restrictions from the active
 * compliance policy. Pure decision function over already-loaded capability
 * rows so it stays independently unit-testable.
 */
export function pickProcessingRegion(
  input: RegionPickInput,
  capabilities: Array<ProviderRegionCapability & { region: ProcessingRegionRegistry }>,
): RegionPickResult {
  const active = capabilities.filter((c) => c.isActive && c.provider === input.provider && c.supportsProcessing);

  const allowedSet = input.allowedRegions?.length ? new Set(input.allowedRegions) : null;

  const candidates = active.filter((c) => {
    if (allowedSet && !allowedSet.has(c.region.code)) return false;
    if (input.requireEuProcessing && !c.region.isEuEea) return false;
    return true;
  });

  if (input.preferredRegionCode) {
    const preferred = candidates.find((c) => c.region.code === input.preferredRegionCode);
    if (preferred) {
      return {
        regionCode: preferred.region.code,
        isEuEea: preferred.region.isEuEea,
        crossBorderTransfer: preferred.crossBorderTransfer,
        reason: "Preferred region available and compliant",
      };
    }
  }

  const withResidency = candidates.find((c) => c.supportsDataResidency);
  const chosen = withResidency ?? candidates[0];

  if (!chosen) {
    if (input.requireEuProcessing) {
      return {
        regionCode: null,
        isEuEea: false,
        crossBorderTransfer: false,
        reason: `No EU/EEA processing region available for provider "${input.provider}"`,
      };
    }
    return {
      regionCode: null,
      isEuEea: false,
      crossBorderTransfer: false,
      reason: `No processing region capability registered for provider "${input.provider}"`,
    };
  }

  return {
    regionCode: chosen.region.code,
    isEuEea: chosen.region.isEuEea,
    crossBorderTransfer: chosen.crossBorderTransfer,
    reason: withResidency ? "Selected region with data residency support" : "Selected first compliant region",
  };
}

export async function pickProcessingRegionForProvider(input: RegionPickInput): Promise<RegionPickResult> {
  const capabilities = await prisma.providerRegionCapability.findMany({
    where: { provider: input.provider, isActive: true },
    include: { region: true },
  });
  return pickProcessingRegion(input, capabilities);
}
