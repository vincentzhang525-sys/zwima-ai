import type { Prisma, ProviderStatus } from "@prisma/client";
import { prisma } from "../prisma";
import {
  mergeProviderConfig,
  parseProviderConfig,
  redactApiKeysForResponse,
  type ProviderAdminConfig,
  type ProviderApiKeyEntry,
} from "./provider-admin-config";

export type ProviderAdminInput = {
  slug: string;
  name: string;
  enabled?: boolean;
  status?: ProviderStatus;
  baseUrl?: string | null;
  region?: string | null;
  dataResidency?: string | null;
  weight?: number;
  priority?: number;
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  supportsVision?: boolean;
  config?: Partial<ProviderAdminConfig>;
};

export async function listProvidersAdmin() {
  return prisma.provider.findMany({
    orderBy: [{ priority: "desc" }, { slug: "asc" }],
    include: { health: true, _count: { select: { models: true } } },
  });
}

export async function createProvider(input: ProviderAdminInput) {
  const config = input.config ? mergeProviderConfig(null, input.config) : undefined;
  return prisma.provider.create({
    data: {
      slug: input.slug,
      name: input.name,
      enabled: input.enabled ?? true,
      status: input.status ?? "ACTIVE",
      baseUrl: input.baseUrl ?? null,
      region: input.region ?? null,
      dataResidency: input.dataResidency ?? null,
      weight: input.weight ?? 100,
      priority: input.priority ?? 0,
      supportsStreaming: input.supportsStreaming ?? false,
      supportsTools: input.supportsTools ?? false,
      supportsVision: input.supportsVision ?? false,
      config,
    },
    include: { health: true },
  });
}

export async function updateProviderBySlug(slug: string, input: Partial<ProviderAdminInput>) {
  const existing = await prisma.provider.findUnique({ where: { slug } });
  if (!existing) throw new Error("Provider not found");

  const config =
    input.config !== undefined
      ? mergeProviderConfig(existing.config, input.config)
      : undefined;

  return prisma.provider.update({
    where: { slug },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.dataResidency !== undefined ? { dataResidency: input.dataResidency } : {}),
      ...(input.weight !== undefined ? { weight: input.weight } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.supportsStreaming !== undefined ? { supportsStreaming: input.supportsStreaming } : {}),
      ...(input.supportsTools !== undefined ? { supportsTools: input.supportsTools } : {}),
      ...(input.supportsVision !== undefined ? { supportsVision: input.supportsVision } : {}),
      ...(config !== undefined ? { config } : {}),
    },
    include: { health: true },
  });
}

export async function deleteProviderBySlug(slug: string) {
  return prisma.provider.update({
    where: { slug },
    data: { enabled: false, status: "DEPRECATED" },
  });
}

export function formatProviderForAdmin(
  p: {
    id: string;
    slug: string;
    name: string;
    enabled: boolean;
    status: string;
    baseUrl: string | null;
    region: string | null;
    dataResidency: string | null;
    weight: number;
    priority: number;
    supportsStreaming: boolean;
    supportsTools: boolean;
    supportsVision: boolean;
    config: unknown;
    lastError: string | null;
    lastLatency: number | null;
    lastHealthAt: Date | null;
    health?: { status: string } | null;
    _count?: { models: number };
  },
) {
  const config = redactApiKeysForResponse(parseProviderConfig(p.config as Prisma.JsonValue));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    enabled: p.enabled,
    status: p.status,
    baseUrl: p.baseUrl,
    region: p.region,
    dataResidency: p.dataResidency,
    weight: p.weight,
    priority: p.priority,
    supportsStreaming: p.supportsStreaming,
    supportsTools: p.supportsTools,
    supportsVision: p.supportsVision,
    supportsEmbedding: config.capabilities?.embedding ?? false,
    regions: config.regions ?? (p.region ? [p.region] : []),
    apiKeys: config.apiKeys ?? [],
    modelCount: p._count?.models ?? 0,
    healthStatus: p.health?.status ?? "UNKNOWN",
    lastError: p.lastError,
    lastLatency: p.lastLatency,
    lastHealthAt: p.lastHealthAt?.toISOString() ?? null,
  };
}

export async function setProviderApiKeys(
  slug: string,
  keys: { id?: string; label: string; secret?: string; enabled?: boolean }[],
) {
  const existing = await prisma.provider.findUnique({ where: { slug } });
  if (!existing) throw new Error("Provider not found");

  const current = parseProviderConfig(existing.config);
  const now = new Date().toISOString();
  const apiKeys: ProviderApiKeyEntry[] = keys.map((k) => {
    const prev = k.id ? current.apiKeys?.find((x) => x.id === k.id) : undefined;
    const secret = k.secret || prev?.secret || "";
    if (!secret) throw new Error(`Missing secret for key ${k.label}`);
    return {
      id: k.id || `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: k.label,
      secret,
      masked: "",
      enabled: k.enabled ?? prev?.enabled ?? true,
      lastRotatedAt: k.secret ? now : prev?.lastRotatedAt,
    };
  });

  return updateProviderBySlug(slug, {
    config: { ...current, apiKeys },
  });
}
