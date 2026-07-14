import { z } from "zod";

export const routingModes = [
  "BALANCED",
  "LOWEST_COST",
  "LOWEST_LATENCY",
  "HIGHEST_QUALITY",
  "EU_COMPLIANCE",
] as const;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  monthlyBudget: z.number().int().min(0).nullable().optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(120),
  projectId: z.string().optional(),
  permission: z.enum(["FULL", "READ", "CHAT"]).optional(),
  ipWhitelist: z.string().nullable().optional(),
  usageLimit: z.number().int().min(0).nullable().optional(),
  rpmLimit: z.number().int().min(0).nullable().optional(),
  tpmLimit: z.number().int().min(0).nullable().optional(),
  dailyBudget: z.number().int().min(0).nullable().optional(),
  monthlyBudget: z.number().int().min(0).nullable().optional(),
  allowedProviders: z.array(z.string()).optional(),
  allowedModels: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  routingMode: z.enum(routingModes).optional(),
});

export const updateApiKeySchema = createApiKeySchema.partial().extend({
  enabled: z.boolean().optional(),
});

export const revokeApiKeySchema = z.object({
  reason: z.string().min(1).max(200).optional(),
  confirm: z.literal(true),
});

export const usageQuerySchema = z.object({
  range: z.enum(["today", "7d", "30d", "custom"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  projectId: z.string().optional(),
  apiKeyId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  status: z.enum(["success", "error", "all"]).optional(),
  routingMode: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export const logsQuerySchema = usageQuerySchema;

export const settingsPatchSchema = z.object({
  defaultRoutingMode: z.enum(routingModes).optional(),
  defaultRegion: z.string().optional(),
  euDataResidency: z.boolean().optional(),
  aiTransparency: z.boolean().optional(),
  monthlyBudget: z.number().int().min(0).nullable().optional(),
  budgetAlerts: z.boolean().optional(),
  usageAlerts: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  apiSecurityDefaults: z
    .object({
      routingMode: z.enum(routingModes).optional(),
      ipAllowlist: z.string().optional(),
    })
    .optional(),
  billingProfile: z
    .object({
      companyName: z.string().optional(),
      vatId: z.string().optional(),
      billingAddress: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  organizationProfile: z.object({ name: z.string().optional() }).optional(),
});

export const playgroundSchema = z.object({
  apiKeyId: z.string().min(1),
  projectId: z.string().optional(),
  model: z.string().min(1),
  routingMode: z.enum(routingModes).optional(),
  systemPrompt: z.string().max(8000).optional(),
  userPrompt: z.string().min(1).max(32000),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
  stream: z.boolean().optional(),
});

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join("; ") || "Validation failed";
    throw new Error(message);
  }
  return result.data;
}

export function parseQuery<T>(schema: z.ZodType<T>, params: Record<string, string | undefined>): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join("; ") || "Validation failed";
    throw new Error(message);
  }
  return result.data;
}
