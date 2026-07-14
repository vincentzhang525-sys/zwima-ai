import { prisma } from "../prisma";
import { ApiError } from "../api-errors";
import type { ApiKey } from "@prisma/client";

const RPM_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const tpmBuckets = new Map<string, { tokens: number; windowStart: number }>();

export type ResolvedApiKey = ApiKey & {
  user: { id: string; tier: string; creditBalance: { credits: number; frozenCredits: number } | null };
  organization: { id: string; name: string } | null;
};

export async function resolveApiKey(keyHash: string): Promise<ResolvedApiKey | null> {
  const key = await prisma.apiKey.findFirst({
    where: { keyHash },
    include: {
      user: { include: { creditBalance: true } },
      organization: true,
    },
  });
  return key as ResolvedApiKey | null;
}

export function validateApiKeyState(key: ResolvedApiKey, requestId?: string): void {
  const status = key.status ?? (key.enabled ? "ACTIVE" : "DISABLED");

  if (status === "REVOKED" || status === "COMPROMISED") {
    throw new ApiError("API_KEY_REVOKED", "This API key has been revoked.", 401, requestId);
  }
  if (status === "DISABLED") {
    throw new ApiError("API_KEY_DISABLED", "This API key is disabled.", 401, requestId);
  }
  if (status === "EXPIRED" || (key.expiresAt && key.expiresAt < new Date())) {
    throw new ApiError("API_KEY_EXPIRED", "This API key has expired.", 401, requestId);
  }
  if (status !== "ACTIVE" && !key.enabled) {
    throw new ApiError("INVALID_API_KEY", "Invalid API key.", 401, requestId);
  }
}

export function checkProviderAllowed(key: ResolvedApiKey, providerSlug: string, requestId?: string): void {
  if (key.allowedProviders.length > 0 && !key.allowedProviders.includes(providerSlug)) {
    throw new ApiError("API_KEY_PROVIDER_NOT_ALLOWED", `Provider "${providerSlug}" is not allowed for this key.`, 403, requestId);
  }
}

export function checkModelAllowed(key: ResolvedApiKey, model: string, requestId?: string): void {
  if (key.allowedModels.length > 0 && !key.allowedModels.includes(model)) {
    throw new ApiError("API_KEY_MODEL_NOT_ALLOWED", `Model "${model}" is not allowed for this key.`, 403, requestId);
  }
}

export function checkPermission(key: ResolvedApiKey, required: string, requestId?: string): void {
  const perms = key.permissions?.length ? key.permissions : [key.permission];
  if (!perms.includes("FULL") && !perms.includes(required) && !perms.includes("CHAT")) {
    if (required === "CHAT" && perms.includes("FULL")) return;
    throw new ApiError("API_KEY_PERMISSION_DENIED", `Permission "${required}" required.`, 403, requestId);
  }
}

export function checkIpWhitelist(key: ResolvedApiKey, ip: string | null, requestId?: string): void {
  if (!key.ipWhitelist || !ip) return;
  const allowed = key.ipWhitelist.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(ip)) {
    throw new ApiError("API_KEY_PERMISSION_DENIED", "IP address not allowed for this API key.", 403, requestId);
  }
}

export function checkTpmLimit(key: ResolvedApiKey, estimatedTokens: number, requestId?: string): void {
  if (!key.tpmLimit) return;
  const now = Date.now();
  const bucket = tpmBuckets.get(key.id) ?? { tokens: 0, windowStart: now };
  if (now - bucket.windowStart > RPM_WINDOW_MS) {
    bucket.tokens = 0;
    bucket.windowStart = now;
  }
  bucket.tokens += estimatedTokens;
  tpmBuckets.set(key.id, bucket);
  if (bucket.tokens > key.tpmLimit) {
    throw new ApiError("API_KEY_RATE_LIMITED", "Token per minute limit exceeded.", 429, requestId);
  }
}

export function checkRateLimit(key: ResolvedApiKey, requestId?: string): void {
  if (!key.rpmLimit) return;
  const now = Date.now();
  const bucket = rateBuckets.get(key.id) ?? { count: 0, windowStart: now };
  if (now - bucket.windowStart > RPM_WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count++;
  rateBuckets.set(key.id, bucket);
  if (bucket.count > key.rpmLimit) {
    throw new ApiError("API_KEY_RATE_LIMITED", "Rate limit exceeded for this API key.", 429, requestId);
  }
}

export async function checkBudget(key: ResolvedApiKey, estimatedCredits: number, requestId?: string): Promise<void> {
  if (key.dailyBudget != null) {
  }
  if (key.monthlyBudget != null) {
    const monthStart = key.currentMonthStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    if (!key.currentMonthStart || key.currentMonthStart < monthStart) {
      await prisma.apiKey.update({ where: { id: key.id }, data: { currentMonthUsage: 0, currentMonthStart: monthStart } });
      key.currentMonthUsage = 0;
    }
    if (key.currentMonthUsage + estimatedCredits > key.monthlyBudget) {
      throw new ApiError("API_KEY_BUDGET_EXCEEDED", "Monthly API key budget exceeded.", 402, requestId);
    }
  }
  if (key.usageLimit != null && key.usageCount >= key.usageLimit) {
    throw new ApiError("API_KEY_BUDGET_EXCEEDED", "API key usage limit exceeded.", 429, requestId);
  }
}

export async function touchApiKey(keyId: string, creditsUsed: number): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      lastUsed: new Date(),
      usageCount: { increment: 1 },
      currentMonthUsage: { increment: creditsUsed },
    },
  });
}

export async function ensureDefaultOrganization(userId: string, email: string): Promise<string> {
  const existing = await prisma.organization.findFirst({ where: { ownerId: userId } });
  if (existing) return existing.id;

  const org = await prisma.organization.create({
    data: {
      name: `${email.split("@")[0]}'s Organization`,
      ownerId: userId,
      members: { create: { userId, role: "OWNER", accepted: true } },
    },
  });
  return org.id;
}

export async function revokeApiKey(
  keyId: string,
  organizationId: string,
  revokedById: string,
  reason: string
): Promise<void> {
  const key = await prisma.apiKey.findFirst({ where: { id: keyId, organizationId } });
  if (!key) throw new ApiError("INVALID_API_KEY", "API key not found.", 404);

  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      status: "REVOKED",
      enabled: false,
      revokedAt: new Date(),
      revokedById,
      revokeReason: reason,
    },
  });
}

export function maskKeyPrefix(prefix: string): string {
  return prefix.length > 12 ? `${prefix.slice(0, 12)}…` : prefix;
}
