import type { OrgRole, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";

/**
 * M8 Agent Platform — shared domain types.
 *
 * The Prisma schema for `AgentDefinition` / `AgentVersion` / `AgentRun` / ...
 * is not generated yet in this environment. This module defines the
 * *expected* record shapes and a thin typed accessor (`getAgentDb`) so the
 * rest of `src/lib/agents/**` can be written against a stable contract now
 * and will keep working once the real Prisma models exist (the shapes here
 * were chosen to match the model/enum names and fields called out in the
 * M8 spec). This file intentionally contains no business logic.
 */

export const AGENT_PLATFORM_DISCLAIMER =
  "M8 Agent Platform runs against a Mock model/tool provider only. No live OpenAI/Anthropic/etc. calls are made, no real emails are sent, and outputs are synthetic. This is not a production AI system and does not replace M1-M7 compliance, billing, or model-lifecycle controls.";

export type AgentPermission = "read" | "edit" | "admin";

// ---------------------------------------------------------------------------
// Enums (mirroring the Prisma enums expected by the M8 schema additions)
// ---------------------------------------------------------------------------

export const AGENT_LIFECYCLE_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "DEPRECATED",
  "ARCHIVED",
] as const;
export type AgentLifecycleStatus = (typeof AGENT_LIFECYCLE_STATUSES)[number];

export const AGENT_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "WAITING_TOOL",
  "WAITING_REVIEW",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const TOOL_RUNTIME_STATUSES = ["ENABLED", "DISABLED"] as const;
export type ToolRuntimeStatus = (typeof TOOL_RUNTIME_STATUSES)[number];

export const PROMPT_LIFECYCLE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type PromptLifecycleStatus = (typeof PROMPT_LIFECYCLE_STATUSES)[number];

export const AGENT_MEMORY_SCOPES = ["CONVERSATION", "RUN", "WORKSPACE"] as const;
export type AgentMemoryScope = (typeof AGENT_MEMORY_SCOPES)[number];

export const AGENT_STEP_TYPES = ["PLAN", "MODEL", "TOOL", "REVIEW", "DELEGATE", "SYSTEM"] as const;
export type AgentStepType = (typeof AGENT_STEP_TYPES)[number];

export type ToolExecutionStatus = "SUCCESS" | "FAILED";
export type AgentRunStepStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
export type AgentReviewLinkStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "WAIVED";

// ---------------------------------------------------------------------------
// Record shapes
// ---------------------------------------------------------------------------

export type AgentDefinitionRecord = {
  id: string;
  agentId: string;
  organizationId: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  status: AgentLifecycleStatus;
  currentVersionId: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentVersionRecord = {
  id: string;
  versionId: string;
  agentId: string;
  versionNumber: number;
  status: AgentLifecycleStatus;
  systemPrompt: string;
  promptTemplateId: string | null;
  promptVersionId: string | null;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  toolIds: string[];
  memoryScope: AgentMemoryScope;
  maxDelegationDepth: number;
  maxDelegationChildren: number;
  reviewRequired: boolean;
  config: Prisma.JsonValue;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

export type AgentRunTokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AgentRunRecord = {
  id: string;
  runId: string;
  agentId: string;
  agentVersionId: string;
  organizationId: string;
  workspaceId: string | null;
  userId: string | null;
  status: AgentRunStatus;
  input: Prisma.JsonValue;
  output: Prisma.JsonValue | null;
  idempotencyKey: string | null;
  parentRunId: string | null;
  rootRunId: string | null;
  depth: number;
  costEstimate: number | null;
  costActual: number | null;
  grossMargin: number | null;
  priceVersionId: string | null;
  costCalculationId: string | null;
  requestedModel: string | null;
  resolvedModel: string | null;
  modelVersion: string | null;
  migrationReason: string | null;
  tokenUsage: Prisma.JsonValue;
  latencyMs: number | null;
  errorMessage: string | null;
  errorClass: string | null;
  eventId: string | null;
  reviewCaseId: string | null;
  retryOfRunId: string | null;
  processingRegion: string | null;
  compliancePolicyVersion: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentOrgPolicyRecord = {
  id: string;
  policyId: string;
  organizationId: string;
  key: string;
  value: Prisma.JsonValue;
  version: number;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentRunStepRecord = {
  id: string;
  stepId: string;
  runId: string;
  stepType: AgentStepType;
  sequence: number;
  status: AgentRunStepStatus;
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  toolExecutionId: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export type ToolDefinitionRecord = {
  id: string;
  toolId: string;
  organizationId: string | null;
  key: string;
  name: string;
  description: string | null;
  status: ToolRuntimeStatus;
  currentVersionId: string | null;
  isMock: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ToolVersionRecord = {
  id: string;
  versionId: string;
  toolId: string;
  versionNumber: number;
  inputSchema: Prisma.JsonValue;
  outputSchema: Prisma.JsonValue;
  handlerKey: string;
  status: ToolRuntimeStatus;
  createdAt: Date;
};

export type ToolExecutionRecord = {
  id: string;
  executionId: string;
  runId: string;
  stepId: string | null;
  toolId: string;
  toolVersionId: string;
  organizationId: string;
  input: Prisma.JsonValue;
  output: Prisma.JsonValue | null;
  status: ToolExecutionStatus;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: Date;
};

export type PromptTemplateRecord = {
  id: string;
  templateId: string;
  organizationId: string;
  key: string;
  name: string;
  description: string | null;
  status: PromptLifecycleStatus;
  currentVersionId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PromptVersionRecord = {
  id: string;
  versionId: string;
  templateId: string;
  versionNumber: number;
  content: string;
  variables: string[];
  status: PromptLifecycleStatus;
  createdBy: string;
  createdAt: Date;
  publishedAt: Date | null;
};

export type AgentMemoryRecord = {
  id: string;
  memoryId: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  runId: string | null;
  scope: AgentMemoryScope;
  key: string;
  valueHash: string;
  valuePreview: string;
  metadata: Prisma.JsonValue | null;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

export type AgentReviewLinkRecord = {
  id: string;
  linkId: string;
  runId: string;
  stepId: string | null;
  eventId: string;
  reviewCaseId: string;
  organizationId: string;
  status: AgentReviewLinkStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentDelegationRecord = {
  id: string;
  delegationId: string;
  parentRunId: string;
  childRunId: string;
  parentAgentId: string;
  childAgentId: string;
  organizationId: string;
  depth: number;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Typed Prisma accessor
// ---------------------------------------------------------------------------

/**
 * Minimal generic delegate shape covering the subset of Prisma model-client
 * methods used by the agent service layer. Kept intentionally loose (`any`
 * args/return) because it stands in for delegates that do not exist on the
 * generated `PrismaClient` type yet.
 */
export type AgentModelDelegate<T> = {
  create(args: unknown): Promise<T>;
  createMany(args: unknown): Promise<{ count: number }>;
  findUnique(args: unknown): Promise<T | null>;
  findFirst(args: unknown): Promise<T | null>;
  findMany(args: unknown): Promise<T[]>;
  update(args: unknown): Promise<T>;
  updateMany(args: unknown): Promise<{ count: number }>;
  upsert(args: unknown): Promise<T>;
  delete(args: unknown): Promise<T>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
  groupBy(args: unknown): Promise<unknown[]>;
};

export type AgentPrismaClient = PrismaClient & {
  agentDefinition: AgentModelDelegate<AgentDefinitionRecord>;
  agentVersion: AgentModelDelegate<AgentVersionRecord>;
  agentRun: AgentModelDelegate<AgentRunRecord>;
  agentRunStep: AgentModelDelegate<AgentRunStepRecord>;
  toolDefinition: AgentModelDelegate<ToolDefinitionRecord>;
  toolVersion: AgentModelDelegate<ToolVersionRecord>;
  toolExecution: AgentModelDelegate<ToolExecutionRecord>;
  promptTemplate: AgentModelDelegate<PromptTemplateRecord>;
  promptVersion: AgentModelDelegate<PromptVersionRecord>;
  agentMemory: AgentModelDelegate<AgentMemoryRecord>;
  agentReviewLink: AgentModelDelegate<AgentReviewLinkRecord>;
  agentDelegation: AgentModelDelegate<AgentDelegationRecord>;
  agentOrgPolicy: AgentModelDelegate<AgentOrgPolicyRecord>;
};

/**
 * Returns the shared Prisma singleton typed with the M8 agent-platform
 * model delegates. Always import `prisma` from `@/lib/prisma` (never a
 * second client) — this is purely a type-level view over the same instance.
 */
export function getAgentDb(): AgentPrismaClient {
  return prisma as unknown as AgentPrismaClient;
}

export type { OrgRole };

// ---------------------------------------------------------------------------
// Public ID generators (all rows also have an internal cuid `id`)
// ---------------------------------------------------------------------------

export const newAgentId = () => `agt_${randomUUID()}`;
export const newAgentVersionId = () => `agv_${randomUUID()}`;
export const newAgentRunId = () => `run_${randomUUID()}`;
export const newAgentRunStepId = () => `stp_${randomUUID()}`;
export const newToolId = () => `tool_${randomUUID()}`;
export const newToolVersionId = () => `tlv_${randomUUID()}`;
export const newToolExecutionId = () => `exe_${randomUUID()}`;
export const newPromptTemplateId = () => `pt_${randomUUID()}`;
export const newPromptVersionId = () => `ptv_${randomUUID()}`;
export const newAgentMemoryId = () => `mem_${randomUUID()}`;
export const newAgentReviewLinkId = () => `arl_${randomUUID()}`;
export const newAgentDelegationId = () => `dlg_${randomUUID()}`;
