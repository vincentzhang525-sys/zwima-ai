import type { Prisma } from "@prisma/client";

export type ProviderApiKeyEntry = {
  id: string;
  label: string;
  /** Full secret — only returned on write; masked on read */
  secret?: string;
  masked: string;
  lastRotatedAt?: string;
  enabled: boolean;
};

export type ProviderAdminConfig = {
  apiKeys?: ProviderApiKeyEntry[];
  regions?: string[];
  capabilities?: {
    embedding?: boolean;
  };
};

export function parseProviderConfig(raw: Prisma.JsonValue | null): ProviderAdminConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const apiKeys = Array.isArray(o.apiKeys)
    ? (o.apiKeys as ProviderApiKeyEntry[]).map((k) => ({
        ...k,
        masked: k.masked || maskSecret(k.secret || ""),
      }))
    : undefined;
  const regions = Array.isArray(o.regions) ? (o.regions as string[]) : undefined;
  const capabilities =
    o.capabilities && typeof o.capabilities === "object"
      ? (o.capabilities as ProviderAdminConfig["capabilities"])
      : undefined;
  return { apiKeys, regions, capabilities };
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

export function mergeProviderConfig(
  current: Prisma.JsonValue | null,
  patch: Partial<ProviderAdminConfig>,
): Prisma.InputJsonValue {
  const base = parseProviderConfig(current);
  const next: ProviderAdminConfig = {
    ...base,
    ...patch,
    capabilities: { ...base.capabilities, ...patch.capabilities },
    regions: patch.regions ?? base.regions,
    apiKeys: patch.apiKeys ?? base.apiKeys,
  };
  if (next.apiKeys) {
    next.apiKeys = next.apiKeys.map((k) => ({
      ...k,
      masked: k.secret ? maskSecret(k.secret) : k.masked,
    }));
  }
  return next as Prisma.InputJsonValue;
}

export function redactApiKeysForResponse(config: ProviderAdminConfig): ProviderAdminConfig {
  return {
    ...config,
    apiKeys: config.apiKeys?.map((entry) => {
      const copy = { ...entry };
      delete copy.secret;
      return copy;
    }),
  };
}
