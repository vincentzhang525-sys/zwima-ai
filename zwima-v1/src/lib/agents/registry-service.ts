import { assertAgentPermission, type AgentContext } from "./auth";
import { AgentServiceError } from "./errors";
import {
  getAgentDb,
  newAgentId,
  newAgentVersionId,
  type AgentDefinitionRecord,
  type AgentLifecycleStatus,
  type AgentMemoryScope,
  type AgentVersionRecord,
} from "./types";
import { DEFAULT_MOCK_MODEL } from "./mock-provider";

export type CreateAgentInput = {
  name: string;
  description?: string | null;
  workspaceId?: string | null;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  toolIds?: string[];
  memoryScope?: AgentMemoryScope;
  maxDelegationDepth?: number;
  maxDelegationChildren?: number;
  reviewRequired?: boolean;
  config?: Record<string, unknown>;
};

export type CreateAgentVersionInput = Partial<
  Pick<
    AgentVersionRecord,
    | "systemPrompt"
    | "model"
    | "temperature"
    | "maxTokens"
    | "toolIds"
    | "memoryScope"
    | "maxDelegationDepth"
    | "maxDelegationChildren"
    | "reviewRequired"
    | "config"
    | "promptTemplateId"
    | "promptVersionId"
  >
>;

/** Legal AgentDefinition lifecycle transitions. Publishing a version (DRAFT -> ACTIVE) is handled separately in `publishAgentVersion`. */
const ALLOWED_AGENT_TRANSITIONS: Record<AgentLifecycleStatus, AgentLifecycleStatus[]> = {
  DRAFT: ["ARCHIVED"],
  ACTIVE: ["PAUSED", "DEPRECATED"],
  PAUSED: ["ACTIVE", "DEPRECATED"],
  DEPRECATED: ["ARCHIVED"],
  ARCHIVED: [],
};

/** DRAFT -> ACTIVE is only reachable via `publishAgentVersion` (it always pairs the agent with a published version). */
const PUBLISH_TRANSITION: [AgentLifecycleStatus, AgentLifecycleStatus][] = [
  ["DRAFT", "ACTIVE"],
  ["PAUSED", "ACTIVE"],
];

function isLegalPublishTransition(from: AgentLifecycleStatus): boolean {
  return PUBLISH_TRANSITION.some(([f]) => f === from) || from === "ACTIVE";
}

export function isLegalAgentTransition(from: AgentLifecycleStatus, to: AgentLifecycleStatus): boolean {
  if (from === to) return true;
  return ALLOWED_AGENT_TRANSITIONS[from]?.includes(to) ?? false;
}

function clampTemperature(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 0.7;
  return Math.min(2, Math.max(0, value));
}

function clampMaxTokens(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 1024;
  return Math.min(8192, Math.max(16, Math.floor(value)));
}

function clampDepth(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 2;
  return Math.min(5, Math.max(0, Math.floor(value)));
}

function clampChildren(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 3;
  return Math.min(10, Math.max(0, Math.floor(value)));
}

async function loadOwnedAgent(ctx: AgentContext, agentId: string): Promise<AgentDefinitionRecord> {
  const db = getAgentDb();
  const agent = await db.agentDefinition.findUnique({ where: { agentId } });
  if (!agent || agent.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent not found", 404);
  }
  return agent;
}

export async function createAgent(
  ctx: AgentContext,
  input: CreateAgentInput,
): Promise<{ agent: AgentDefinitionRecord; version: AgentVersionRecord }> {
  assertAgentPermission(ctx, "edit");
  const name = String(input.name || "").trim();
  const systemPrompt = String(input.systemPrompt || "").trim();
  if (!name) throw new AgentServiceError("VALIDATION_ERROR", "name is required", 400);
  if (!systemPrompt) throw new AgentServiceError("VALIDATION_ERROR", "systemPrompt is required", 400);

  const db = getAgentDb();
  const agentId = newAgentId();
  const versionId = newAgentVersionId();

  const agent = await db.agentDefinition.create({
    data: {
      agentId,
      organizationId: ctx.organizationId,
      workspaceId: input.workspaceId ?? null,
      name,
      description: input.description ?? null,
      status: "DRAFT",
      currentVersionId: versionId,
      createdBy: ctx.user.id,
      updatedBy: ctx.user.id,
    },
  });

  const version = await db.agentVersion.create({
    data: {
      versionId,
      agentId,
      versionNumber: 1,
      status: "DRAFT",
      systemPrompt,
      promptTemplateId: null,
      promptVersionId: null,
      provider: "mock",
      model: input.model?.trim() || DEFAULT_MOCK_MODEL,
      temperature: clampTemperature(input.temperature),
      maxTokens: clampMaxTokens(input.maxTokens),
      toolIds: Array.isArray(input.toolIds) ? input.toolIds : [],
      memoryScope: input.memoryScope ?? "CONVERSATION",
      maxDelegationDepth: clampDepth(input.maxDelegationDepth),
      maxDelegationChildren: clampChildren(input.maxDelegationChildren),
      reviewRequired: Boolean(input.reviewRequired),
      config: input.config ?? {},
      createdBy: ctx.user.id,
    },
  });

  return { agent, version };
}

export async function getAgent(ctx: AgentContext, agentId: string): Promise<AgentDefinitionRecord> {
  assertAgentPermission(ctx, "read");
  return loadOwnedAgent(ctx, agentId);
}

export async function listAgents(
  ctx: AgentContext,
  params: { workspaceId?: string | null; status?: AgentLifecycleStatus; limit?: number; cursor?: string } = {},
): Promise<AgentDefinitionRecord[]> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  return db.agentDefinition.findMany({
    where: {
      organizationId: ctx.organizationId,
      workspaceId: params.workspaceId ?? undefined,
      status: params.status,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 50, 100),
    ...(params.cursor ? { cursor: { agentId: params.cursor }, skip: 1 } : {}),
  });
}

export async function updateAgentMeta(
  ctx: AgentContext,
  agentId: string,
  patch: { name?: string; description?: string | null },
): Promise<AgentDefinitionRecord> {
  assertAgentPermission(ctx, "edit");
  const agent = await loadOwnedAgent(ctx, agentId);
  const db = getAgentDb();
  return db.agentDefinition.update({
    where: { id: agent.id },
    data: {
      name: patch.name !== undefined ? String(patch.name).trim() || agent.name : undefined,
      description: patch.description !== undefined ? patch.description : undefined,
      updatedBy: ctx.user.id,
    },
  });
}

export async function listAgentVersions(ctx: AgentContext, agentId: string): Promise<AgentVersionRecord[]> {
  assertAgentPermission(ctx, "read");
  await loadOwnedAgent(ctx, agentId);
  const db = getAgentDb();
  return db.agentVersion.findMany({ where: { agentId }, orderBy: { versionNumber: "desc" } });
}

export async function getAgentVersion(ctx: AgentContext, versionId: string): Promise<AgentVersionRecord> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  const version = await db.agentVersion.findUnique({ where: { versionId } });
  if (!version) throw new AgentServiceError("NOT_FOUND", "Agent version not found", 404);
  await loadOwnedAgent(ctx, version.agentId);
  return version;
}

/** Creates a new DRAFT version, cloning current-version fields and applying overrides. */
export async function createAgentVersion(
  ctx: AgentContext,
  agentId: string,
  patch: CreateAgentVersionInput,
): Promise<AgentVersionRecord> {
  assertAgentPermission(ctx, "edit");
  const agent = await loadOwnedAgent(ctx, agentId);
  const db = getAgentDb();

  const latest = await db.agentVersion.findFirst({
    where: { agentId },
    orderBy: { versionNumber: "desc" },
  });
  if (!latest) throw new AgentServiceError("CONFLICT", "Agent has no existing version to clone from", 409);

  const versionId = newAgentVersionId();
  const version = await db.agentVersion.create({
    data: {
      versionId,
      agentId: agent.agentId,
      versionNumber: latest.versionNumber + 1,
      status: "DRAFT",
      systemPrompt: patch.systemPrompt !== undefined ? String(patch.systemPrompt) : latest.systemPrompt,
      promptTemplateId: patch.promptTemplateId !== undefined ? patch.promptTemplateId : latest.promptTemplateId,
      promptVersionId: patch.promptVersionId !== undefined ? patch.promptVersionId : latest.promptVersionId,
      provider: "mock",
      model: patch.model !== undefined ? patch.model : latest.model,
      temperature: patch.temperature !== undefined ? clampTemperature(patch.temperature) : latest.temperature,
      maxTokens: patch.maxTokens !== undefined ? clampMaxTokens(patch.maxTokens) : latest.maxTokens,
      toolIds: patch.toolIds !== undefined ? patch.toolIds : latest.toolIds,
      memoryScope: patch.memoryScope !== undefined ? patch.memoryScope : latest.memoryScope,
      maxDelegationDepth:
        patch.maxDelegationDepth !== undefined ? clampDepth(patch.maxDelegationDepth) : latest.maxDelegationDepth,
      maxDelegationChildren:
        patch.maxDelegationChildren !== undefined
          ? clampChildren(patch.maxDelegationChildren)
          : latest.maxDelegationChildren,
      reviewRequired: patch.reviewRequired !== undefined ? Boolean(patch.reviewRequired) : latest.reviewRequired,
      config: patch.config !== undefined ? patch.config : latest.config,
      createdBy: ctx.user.id,
    },
  });
  return version;
}

/** Publishes a DRAFT version: activates it, deprecates the previously-active version, and activates the parent agent. */
export async function publishAgentVersion(ctx: AgentContext, versionId: string): Promise<AgentVersionRecord> {
  assertAgentPermission(ctx, "admin");
  const db = getAgentDb();
  const version = await db.agentVersion.findUnique({ where: { versionId } });
  if (!version) throw new AgentServiceError("NOT_FOUND", "Agent version not found", 404);
  const agent = await loadOwnedAgent(ctx, version.agentId);

  if (version.status !== "DRAFT") {
    throw new AgentServiceError("CONFLICT", `Only a DRAFT version can be published (current: ${version.status})`, 409);
  }
  if (!isLegalPublishTransition(agent.status)) {
    throw new AgentServiceError("CONFLICT", `Cannot activate agent from status ${agent.status}`, 409);
  }

  const previousActive = await db.agentVersion.findFirst({
    where: { agentId: agent.agentId, status: "ACTIVE" },
  });

  const published = await db.agentVersion.update({
    where: { id: version.id },
    data: { status: "ACTIVE", publishedAt: new Date() },
  });

  if (previousActive) {
    await db.agentVersion.update({ where: { id: previousActive.id }, data: { status: "DEPRECATED" } });
  }

  await db.agentDefinition.update({
    where: { id: agent.id },
    data: { status: "ACTIVE", currentVersionId: version.versionId, updatedBy: ctx.user.id },
  });

  return published;
}

export async function transitionAgentStatus(
  ctx: AgentContext,
  agentId: string,
  toStatus: AgentLifecycleStatus,
): Promise<AgentDefinitionRecord> {
  assertAgentPermission(ctx, "admin");
  const agent = await loadOwnedAgent(ctx, agentId);
  if (!isLegalAgentTransition(agent.status, toStatus)) {
    throw new AgentServiceError(
      "CONFLICT",
      `Illegal agent lifecycle transition: ${agent.status} -> ${toStatus}`,
      409,
    );
  }
  const db = getAgentDb();
  return db.agentDefinition.update({
    where: { id: agent.id },
    data: { status: toStatus, updatedBy: ctx.user.id },
  });
}

export const pauseAgent = (ctx: AgentContext, agentId: string) => transitionAgentStatus(ctx, agentId, "PAUSED");
export const resumeAgent = (ctx: AgentContext, agentId: string) => transitionAgentStatus(ctx, agentId, "ACTIVE");
export const deprecateAgent = (ctx: AgentContext, agentId: string) =>
  transitionAgentStatus(ctx, agentId, "DEPRECATED");
export const archiveAgent = (ctx: AgentContext, agentId: string) => transitionAgentStatus(ctx, agentId, "ARCHIVED");
