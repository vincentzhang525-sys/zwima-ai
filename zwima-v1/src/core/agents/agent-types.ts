/**
 * M8 Agent Platform Phase 1 — facade types.
 *
 * These types/schemas describe the Phase 1 public surface
 * (`createAgent`/`runAgent`/...). They intentionally reuse the existing
 * `src/lib/agents/types.ts` record shapes (`AgentDefinitionRecord`,
 * `AgentRunRecord`, ...) rather than redefining the Prisma-backed domain —
 * Phase 1 is a thin, safety-hardened facade over the existing M8 service
 * layer, not a replacement for it.
 */

import { z } from "zod";
import type {
  AgentDefinitionRecord,
  AgentLifecycleStatus,
  AgentMemoryScope,
  AgentRunRecord,
  AgentRunStatus,
  AgentRunStepRecord,
  AgentVersionRecord,
} from "@/lib/agents/types";

export type {
  AgentDefinitionRecord,
  AgentLifecycleStatus,
  AgentMemoryScope,
  AgentRunRecord,
  AgentRunStatus,
  AgentRunStepRecord,
  AgentVersionRecord,
};

/** Phase 1 external name for `AgentDefinitionRecord` (deviation: no schema rename, see README/PR notes). */
export type Agent = AgentDefinitionRecord;
export type AgentVersion = AgentVersionRecord;
export type AgentRun = AgentRunRecord;
export type AgentRunStep = AgentRunStepRecord;

export const CreateAgentSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  workspaceId: z.string().trim().min(1).nullable().optional(),
  systemPrompt: z.string().trim().min(1, "systemPrompt is required").max(20_000),
  model: z.string().trim().max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(16).max(8192).optional(),
  toolIds: z.array(z.string().trim().min(1)).max(20).optional(),
  memoryScope: z.enum(["CONVERSATION", "RUN", "WORKSPACE"]).optional(),
  maxDelegationDepth: z.number().int().min(0).max(5).optional(),
  maxDelegationChildren: z.number().int().min(0).max(10).optional(),
  reviewRequired: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

export const UpdateAgentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

export const RunAgentSchema = z.object({
  input: z.record(z.string(), z.unknown()).default({}),
  workspaceId: z.string().trim().min(1).nullable().optional(),
  parentRunId: z.string().trim().min(1).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).nullable().optional(),
  /** If false, only creates a QUEUED run without executing it. Defaults to true — Phase 1 runs are always mock/synchronous. */
  execute: z.boolean().optional(),
});
export type RunAgentInput = z.infer<typeof RunAgentSchema>;

export const ListAgentsQuerySchema = z.object({
  workspaceId: z.string().trim().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "DEPRECATED", "ARCHIVED"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).optional(),
});
export type ListAgentsQuery = z.infer<typeof ListAgentsQuerySchema>;

export const ListAgentRunsQuerySchema = z.object({
  agentId: z.string().trim().min(1).optional(),
  status: z
    .enum(["QUEUED", "RUNNING", "WAITING_TOOL", "WAITING_REVIEW", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"])
    .optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type ListAgentRunsQuery = z.infer<typeof ListAgentRunsQuerySchema>;

export const CancelAgentRunSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelAgentRunInput = z.infer<typeof CancelAgentRunSchema>;

/** Result of a `runAgent` call — the persisted run plus its steps, for immediate display without a second round-trip. */
export type AgentRunResult = {
  run: AgentRun;
  steps: AgentRunStep[];
};

// ---------------------------------------------------------------------------
// M8 Agent Platform Phase 2A — templates & memory (additive to Phase 1 above)
// ---------------------------------------------------------------------------

export const AGENT_MEMORY_TYPES = ["USER", "WORKSPACE", "EXECUTION_SUMMARY"] as const;
export type AgentMemoryType = (typeof AGENT_MEMORY_TYPES)[number];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const CreateAgentTemplateSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  slug: z.string().trim().min(1, "slug is required").max(100).regex(SLUG_PATTERN, "slug must be lowercase kebab-case"),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().min(1, "category is required").max(100),
  systemPrompt: z.string().trim().min(1, "systemPrompt is required").max(20_000),
  defaultModel: z.string().trim().min(1).max(200).optional(),
  defaultTemperature: z.number().min(0).max(2).optional(),
  defaultMaxSteps: z.number().int().min(1).max(50).optional(),
  defaultTimeoutMs: z.number().int().min(1_000).max(600_000).optional(),
  defaultCostCeiling: z.number().min(0).max(1_000).optional(),
  allowedToolKeys: z.array(z.string().trim().min(1)).max(20).optional(),
  workspaceId: z.string().trim().min(1).nullable().optional(),
  isSystemTemplate: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type CreateAgentTemplateInput = z.infer<typeof CreateAgentTemplateSchema>;

export const UpdateAgentTemplateSchema = CreateAgentTemplateSchema.partial();
export type UpdateAgentTemplateInput = z.infer<typeof UpdateAgentTemplateSchema>;

export const ListAgentTemplatesQuerySchema = z.object({
  category: z.string().trim().min(1).max(100).optional(),
  includeInactive: z.boolean().optional(),
});
export type ListAgentTemplatesQuery = z.infer<typeof ListAgentTemplatesQuerySchema>;

export const CreateAgentFromTemplateSchema = z.object({
  templateId: z.string().trim().min(1, "templateId is required"),
  name: z.string().trim().min(1).max(200).optional(),
  workspaceId: z.string().trim().min(1).nullable().optional(),
});
export type CreateAgentFromTemplateInput = z.infer<typeof CreateAgentFromTemplateSchema>;

export const UpsertAgentMemoryPolicySchema = z.object({
  memoryEnabled: z.boolean().optional(),
  allowUserMemory: z.boolean().optional(),
  allowWorkspaceMemory: z.boolean().optional(),
  maxEntries: z.number().int().min(1).max(500).optional(),
  maxEntryCharacters: z.number().int().min(1).max(10_000).optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
});
export type UpsertAgentMemoryPolicyInput = z.infer<typeof UpsertAgentMemoryPolicySchema>;

export const CreateAgentMemoryEntrySchema = z.object({
  memoryType: z.enum(AGENT_MEMORY_TYPES),
  key: z.string().trim().min(1, "key is required").max(200),
  value: z.string().trim().min(1, "value is required"),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type CreateAgentMemoryEntryInput = z.infer<typeof CreateAgentMemoryEntrySchema>;

export const ListAgentMemoryQuerySchema = z.object({
  memoryType: z.enum(AGENT_MEMORY_TYPES).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type ListAgentMemoryQuery = z.infer<typeof ListAgentMemoryQuerySchema>;
