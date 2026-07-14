import { prisma } from "../prisma";
import { generateApiKey } from "../credits";
import { writeAudit } from "../audit";
import { ensureDefaultOrganization, maskKeyPrefix, revokeApiKey } from "./governance";
import type { KeyPermission } from "@prisma/client";

export const KEY_SELECT = {
  id: true,
  name: true,
  prefix: true,
  enabled: true,
  status: true,
  permission: true,
  permissions: true,
  ipWhitelist: true,
  usageLimit: true,
  usageCount: true,
  rpmLimit: true,
  tpmLimit: true,
  dailyBudget: true,
  monthlyBudget: true,
  currentMonthUsage: true,
  allowedProviders: true,
  allowedModels: true,
  environment: true,
  expiresAt: true,
  revokedAt: true,
  revokeReason: true,
  createdAt: true,
  lastUsed: true,
  organizationId: true,
} as const;

export function serializeKey(k: {
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
}) {
  return {
    ...k,
    prefix: maskKeyPrefix(k.prefix),
    createdAt: k.createdAt.toISOString(),
    lastUsed: k.lastUsed?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
  };
}

export async function listOrgApiKeys(userId: string, email: string) {
  const orgId = await ensureDefaultOrganization(userId, email);
  const keys = await prisma.apiKey.findMany({
    where: { userId, organizationId: orgId, name: { not: "__playground__" } },
    orderBy: { createdAt: "desc" },
    select: KEY_SELECT,
  });
  return { orgId, keys: keys.map(serializeKey) };
}

export async function createOrgApiKey(userId: string, email: string, body: Record<string, unknown>) {
  const orgId = await ensureDefaultOrganization(userId, email);
  const name = body.name;
  if (!name) throw new Error("Name required");

  const { fullKey, prefix, keyHash } = generateApiKey();
  const key = await prisma.apiKey.create({
    data: {
      userId,
      organizationId: orgId,
      name: String(name),
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
    },
  });

  await writeAudit({
    userId,
    action: "Created API key",
    category: "API_KEY",
    detail: { keyId: key.id, name, organizationId: orgId },
  });

  return { fullKey, key: serializeKey(key) };
}

export async function updateOrgApiKey(
  userId: string,
  email: string,
  keyId: string,
  body: Record<string, unknown>
) {
  const orgId = await ensureDefaultOrganization(userId, email);
  const existing = await prisma.apiKey.findFirst({ where: { id: keyId, userId, organizationId: orgId } });
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

  const updated = await prisma.apiKey.update({ where: { id: keyId }, data });
  await writeAudit({ userId, action: "Updated API key", category: "API_KEY", detail: { keyId } });
  return serializeKey(updated);
}

export async function rotateOrgApiKey(userId: string, email: string, keyId: string) {
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
      name: `${key.name} (rotated)`,
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
    },
  });

  await writeAudit({
    userId,
    action: "Rotated API key",
    category: "API_KEY",
    detail: { oldKeyId: keyId, newKeyId: newKey.id, organizationId: orgId },
  });

  return { fullKey, key: serializeKey(newKey) };
}

export async function revokeOrgApiKey(userId: string, email: string, keyId: string, reason: string) {
  const orgId = await ensureDefaultOrganization(userId, email);
  await revokeApiKey(keyId, orgId, userId, reason);
  await writeAudit({ userId, action: "Revoked API key", category: "API_KEY", detail: { keyId, organizationId: orgId } });
}
