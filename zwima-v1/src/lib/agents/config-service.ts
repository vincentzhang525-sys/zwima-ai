import { assertAgentPermission, type AgentContext } from "./auth";
import { AgentServiceError } from "./errors";
import { getAgentDb, type AgentMemoryScope, type AgentVersionRecord } from "./types";

export type AgentVersionConfigPatch = {
  systemPrompt?: string;
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

function assertMutableVersion(version: AgentVersionRecord) {
  if (version.status !== "DRAFT") {
    throw new AgentServiceError(
      "CONFLICT",
      `Agent version ${version.versionId} is ${version.status} and immutable — create a new DRAFT version to change its configuration`,
      409,
    );
  }
}

function validatePatch(patch: AgentVersionConfigPatch) {
  if (patch.temperature !== undefined && (patch.temperature < 0 || patch.temperature > 2)) {
    throw new AgentServiceError("VALIDATION_ERROR", "temperature must be between 0 and 2", 400);
  }
  if (patch.maxTokens !== undefined && (patch.maxTokens < 16 || patch.maxTokens > 8192)) {
    throw new AgentServiceError("VALIDATION_ERROR", "maxTokens must be between 16 and 8192", 400);
  }
  if (
    patch.maxDelegationDepth !== undefined &&
    (patch.maxDelegationDepth < 0 || patch.maxDelegationDepth > 5)
  ) {
    throw new AgentServiceError("VALIDATION_ERROR", "maxDelegationDepth must be between 0 and 5", 400);
  }
  if (
    patch.maxDelegationChildren !== undefined &&
    (patch.maxDelegationChildren < 0 || patch.maxDelegationChildren > 10)
  ) {
    throw new AgentServiceError("VALIDATION_ERROR", "maxDelegationChildren must be between 0 and 10", 400);
  }
  if (patch.systemPrompt !== undefined && !String(patch.systemPrompt).trim()) {
    throw new AgentServiceError("VALIDATION_ERROR", "systemPrompt cannot be blank", 400);
  }
  if (patch.toolIds !== undefined && !Array.isArray(patch.toolIds)) {
    throw new AgentServiceError("VALIDATION_ERROR", "toolIds must be an array of tool ids", 400);
  }
}

/** Updates config fields on a DRAFT AgentVersion. Published/deprecated/archived versions are immutable by design. */
export async function updateAgentVersionConfig(
  ctx: AgentContext,
  versionId: string,
  patch: AgentVersionConfigPatch,
): Promise<AgentVersionRecord> {
  assertAgentPermission(ctx, "edit");
  validatePatch(patch);

  const db = getAgentDb();
  const version = await db.agentVersion.findUnique({ where: { versionId } });
  if (!version) throw new AgentServiceError("NOT_FOUND", "Agent version not found", 404);

  const agent = await db.agentDefinition.findUnique({ where: { agentId: version.agentId } });
  if (!agent || agent.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent version not found", 404);
  }

  assertMutableVersion(version);

  return db.agentVersion.update({
    where: { id: version.id },
    data: {
      systemPrompt: patch.systemPrompt !== undefined ? patch.systemPrompt : undefined,
      model: patch.model !== undefined ? patch.model : undefined,
      temperature: patch.temperature !== undefined ? patch.temperature : undefined,
      maxTokens: patch.maxTokens !== undefined ? patch.maxTokens : undefined,
      toolIds: patch.toolIds !== undefined ? patch.toolIds : undefined,
      memoryScope: patch.memoryScope !== undefined ? patch.memoryScope : undefined,
      maxDelegationDepth: patch.maxDelegationDepth !== undefined ? patch.maxDelegationDepth : undefined,
      maxDelegationChildren:
        patch.maxDelegationChildren !== undefined ? patch.maxDelegationChildren : undefined,
      reviewRequired: patch.reviewRequired !== undefined ? patch.reviewRequired : undefined,
      config: patch.config !== undefined ? patch.config : undefined,
    },
  });
}
