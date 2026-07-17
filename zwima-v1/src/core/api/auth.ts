import { hashApiKey } from "@/lib/credits";
import { resolveApiKey, validateApiKeyState } from "@/lib/api-keys/governance";
import { ApiError } from "@/lib/api-errors";
import type { UserTier } from "@prisma/client";

export type V1KeyContext = {
  userId: string;
  apiKeyId: string;
  organizationId: string;
  monthlyBudgetUsd: number | null;
  userTier: UserTier;
};

export async function validateV1ApiKey(
  apiKey: string,
  requestId?: string,
): Promise<V1KeyContext> {
  if (!apiKey) {
    throw new ApiError("UNAUTHORIZED", "API key required.", 401, requestId);
  }

  if (!apiKey.startsWith("sk_live_")) {
    throw new ApiError("INVALID_API_KEY", "Invalid API key format.", 401, requestId);
  }

  const key = await resolveApiKey(hashApiKey(apiKey));
  if (!key) {
    throw new ApiError("INVALID_API_KEY", "Invalid API key.", 401, requestId);
  }

  validateApiKeyState(key, requestId);

  return {
    userId: key.userId,
    apiKeyId: key.id,
    organizationId: key.organizationId ?? key.user.id,
    monthlyBudgetUsd: null,
    userTier: key.user.tier as UserTier,
  };
}
