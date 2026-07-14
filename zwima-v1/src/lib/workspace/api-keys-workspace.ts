import { prisma } from "../prisma";
import { generateApiKey } from "../credits";
import { writeAudit } from "../audit";
import { ensureDefaultOrganization, maskKeyPrefix, revokeApiKey, type ResolvedApiKey } from "../api-keys/governance";
import { KEY_SELECT, serializeKey } from "../api-keys/service";
import { parseApiKeyMetadata, projectRepository } from "./project-repository";
import type { KeyPermission } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const KEY_SELECT_WITH_META = { ...KEY_SELECT, metadata: true } as const;

function maskKeyDisplay(prefix: string): string {
  if (prefix.length <= 8) return `${prefix}…`;
  return `${prefix.slice(0, 8)}…${prefix.slice(-4)}`;
}

export function serializeWorkspaceKey(k: {
  id: string;
  name: string;
  prefix: string;
  enabled: boolean;
  status: string;
  permission: string;
  permissions?: string[];
  ipWhitelist?: string | null;
  usageLimit?: number | null;
  usageCount: number;
  rpmLimit?: number | null;
  tpmLimit?: number | null;
  dailyBudget?: number | null;
  monthlyBudget?: number | null;
  currentMonthUsage?: number;
  allowedProviders?: string[];
  allowedModels?: string[];
  environment?: string;
  expiresAt: Date | null;
  revokedAt?: Date | null;
  revokeReason?: string | null;
  createdAt: Date;
  lastUsed: Date | null;
  organizationId?: string | null;
  metadata?: unknown;
}) {
  const meta = parseApiKeyMetadata(k.metadata);
  const base = serializeKey(k);
  return {
    ...base,
    prefix: maskKeyDisplay(k.prefix),
    projectId: meta.projectId ?? null,
    routingMode: meta.routingMode ?? "BALANCED",
    requests: k.usageCount,
    spendCredits: k.currentMonthUsage ?? 0,
  };
}

export async function listWorkspaceApiKeys(userId: string, email: string) {
  const orgId = await ensureDefaultOrganization(userId, email);
  await projectRepository.ensureDefault(orgId);

  const keys = await prisma.apiKey.findMany({
    where: { userId, organizationId: orgId, name: { not: "__playground__" } },
    orderBy: { createdAt: "desc" },
    select: KEY_SELECT_WITH_META,
  });

  const projects = await projectRepository.list(orgId);
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return {
    organizationId: orgId,
    keys: keys.map((k) => ({
      ...serializeWorkspaceKey(k),
      projectName: parseApiKeyMetadata(k.metadata).projectId
        ? projectMap[parseApiKeyMetadata(k.metadata).projectId!] ?? null
        : null,
    })),
  };
}

export async function createWorkspaceApiKey(
  userId: string,
  email: string,
  body: Record<string, unknown>
) {
  const orgId = await ensureDefaultOrganization(userId, email);
  await projectRepository.ensureDefault(orgId);

  let projectId = body.projectId ? String(body.projectId) : undefined;
  if (!projectId) {
    const general = await projectRepository.ensureDefault(orgId);
    projectId = general.id;
  } else {
    const project = await projectRepository.get(orgId, projectId);
    if (!project) throw new Error("Project not found");
  }

  const routingMode = (body.routingMode as string) ?? "BALANCED";
  const metadata: Prisma.InputJsonValue = { projectId, routingMode };

  const { fullKey, prefix, keyHash } = generateApiKey();
  const key = await prisma.apiKey.create({
    data: {
      userId,
      organizationId: orgId,
      name: String(body.name),
      prefix,
      keyHash,
      permission: (body.permission as KeyPermission) ?? "FULL",
      permissions: (body.permissions as string[]) ?? [],
      ipWhitelist: body.ipWhitelist ? String(body.ipWhitelist) : null,
      usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
      rpmLimit: body.rpmLimit ? Number(body.rpmLimit) : null,
      tpmLimit: body.tpmLimit ? Number(body.tpmLimit) : null,
      dailyBudget: body.dailyBudget ? Number(body.dailyBudget) : null,
      monthlyBudget: body.monthlyBudget ? Number(body.monthlyBudget) : null,
      allowedProviders: (body.allowedProviders as string[]) ?? [],
      allowedModels: (body.allowedModels as string[]) ?? [],
      expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null,
      environment: body.environment ? String(body.environment) : "production",
      metadata,
    },
  });

  await writeAudit({
    userId,
    action: "Created API key",
    category: "API_KEY",
    detail: { keyId: key.id, name: key.name, organizationId: orgId, projectId },
  });

  return { fullKey, key: serializeWorkspaceKey(key) };
}

export async function updateWorkspaceApiKey(
  userId: string,
  email: string,
  keyId: string,
  body: Record<string, unknown>
) {
  const orgId = await ensureDefaultOrganization(userId, email);
  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, userId, organizationId: orgId },
  });
  if (!existing) throw new Error("Not found");

  const data: Record<string, unknown> = {};
  if (body.enabled !== undefined) {
    data.enabled = Boolean(body.enabled);
    data.status = body.enabled ? "ACTIVE" : "DISABLED";
  }
  if (body.name !== undefined) data.name = String(body.name);
  if (body.permission !== undefined) data.permission = body.permission;
  if (body.permissions !== undefined) data.permissions = body.permissions;
  if (body.ipWhitelist !== undefined) data.ipWhitelist = body.ipWhitelist || null;
  if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit ? Number(body.usageLimit) : null;
  if (body.rpmLimit !== undefined) data.rpmLimit = body.rpmLimit ? Number(body.rpmLimit) : null;
  if (body.tpmLimit !== undefined) data.tpmLimit = body.tpmLimit ? Number(body.tpmLimit) : null;
  if (body.dailyBudget !== undefined) data.dailyBudget = body.dailyBudget ? Number(body.dailyBudget) : null;
  if (body.monthlyBudget !== undefined) data.monthlyBudget = body.monthlyBudget ? Number(body.monthlyBudget) : null;
  if (body.allowedProviders !== undefined) data.allowedProviders = body.allowedProviders;
  if (body.allowedModels !== undefined) data.allowedModels = body.allowedModels;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;

  const meta = parseApiKeyMetadata(existing.metadata);
  if (body.projectId !== undefined) meta.projectId = String(body.projectId);
  if (body.routingMode !== undefined) meta.routingMode = String(body.routingMode);
  data.metadata = meta;

  const updated = await prisma.apiKey.update({ where: { id: keyId }, data });
  await writeAudit({ userId, action: "Updated API key", category: "API_KEY", detail: { keyId, organizationId: orgId } });
  return serializeWorkspaceKey(updated);
}

export async function rotateWorkspaceApiKey(userId: string, email: string, keyId: string) {
  const orgId = await ensureDefaultOrganization(userId, email);
  const key = await prisma.apiKey.findFirst({ where: { id: keyId, userId, organizationId: orgId } });
  if (!key) throw new Error("Not found");

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { status: "REVOKED", enabled: false, revokedAt: new Date(), revokedById: userId, revokeReason: "Rotated" },
  });

  const { fullKey, prefix, keyHash } = generateApiKey();
  const newKey = await prisma.apiKey.create({
    data: {
      userId,
      organizationId: orgId,
      name: key.name,
      prefix,
      keyHash,
      permission: key.permission,
      permissions: key.permissions,
      allowedProviders: key.allowedProviders,
      allowedModels: key.allowedModels,
      rpmLimit: key.rpmLimit,
      tpmLimit: key.tpmLimit,
      dailyBudget: key.dailyBudget,
      monthlyBudget: key.monthlyBudget,
      ipWhitelist: key.ipWhitelist,
      metadata: key.metadata ?? undefined,
    },
  });

  await writeAudit({
    userId,
    action: "Rotated API key",
    category: "API_KEY",
    detail: { oldKeyId: keyId, newKeyId: newKey.id, organizationId: orgId },
  });

  return { fullKey, key: serializeWorkspaceKey(newKey) };
}

export async function revokeWorkspaceApiKey(
  userId: string,
  email: string,
  keyId: string,
  reason: string
) {
  const orgId = await ensureDefaultOrganization(userId, email);
  await revokeApiKey(keyId, orgId, userId, reason);
  await writeAudit({
    userId,
    action: "Revoked API key",
    category: "API_KEY",
    detail: { keyId, organizationId: orgId, reason },
  });
}

export async function resolveWorkspaceApiKeyRecord(
  apiKeyId: string,
  organizationId: string,
  userId: string
): Promise<ResolvedApiKey> {
  const key = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, organizationId, userId },
    include: {
      user: { include: { creditBalance: true } },
      organization: true,
    },
  });
  if (!key) throw new Error("FORBIDDEN");
  return key as ResolvedApiKey;
}

export { maskKeyPrefix };
