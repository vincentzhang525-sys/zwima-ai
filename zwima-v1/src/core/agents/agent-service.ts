/**
 * M8 Agent Platform Phase 1 — public service facade.
 *
 * Every export here corresponds to a Phase 1 required API name
 * (`createAgent`, `runAgent`, ...). Each function takes an already-resolved
 * `AgentContext` (see `src/lib/agents/auth.ts#requireAgentContext`) so route
 * handlers, tests, and other callers share one auth/permission path, and
 * each delegates the actual persistence to the existing
 * `src/lib/agents/registry-service.ts` / `execution-engine.ts`, which
 * already enforce workspace/org ownership (`organizationId` match) and
 * `assertAgentPermission`. This facade re-asserts permission defensively
 * and adds the append-only `AgentExecutionLog` audit trail plus Phase 1
 * input validation/safety rails (`agent-runner.ts`).
 */

import { assertAgentPermission, type AgentContext } from "@/lib/agents/auth";
import {
  archiveAgent as libArchiveAgent,
  createAgent as libCreateAgent,
  getAgent as libGetAgent,
  listAgents as libListAgents,
  listAgentVersions,
  updateAgentMeta,
} from "@/lib/agents/registry-service";
import { cancelRun, listRuns } from "@/lib/agents/execution-engine";
import { getAgentDb } from "@/lib/agents/types";
import { runAgentSafely, getAgentRunWithSteps } from "./agent-runner";
import { redactSystemPrompt } from "./agent-validator";
import { createAgentFromTemplate as coreCreateAgentFromTemplate } from "./from-template-service";
import {
  createAgentTemplate as coreCreateAgentTemplate,
  deleteAgentTemplate as coreDeleteAgentTemplate,
  getAgentTemplate as coreGetAgentTemplate,
  listAgentTemplates as coreListAgentTemplates,
  updateAgentTemplate as coreUpdateAgentTemplate,
  type AgentTemplateRecord,
} from "./template-service";
import {
  getAgentMemoryPolicy as coreGetAgentMemoryPolicy,
  upsertAgentMemoryPolicy as coreUpsertAgentMemoryPolicy,
  type AgentMemoryPolicyRecord,
} from "./memory-policy-service";
import {
  clearAgentMemory as coreClearAgentMemory,
  createAgentMemoryEntry as coreCreateAgentMemoryEntry,
  deleteAgentMemoryEntry as coreDeleteAgentMemoryEntry,
  listAgentMemoryEntries as coreListAgentMemoryEntries,
  type AgentMemoryPhase2Record,
} from "./memory-phase2-service";
import type {
  Agent,
  AgentRun,
  AgentRunResult,
  AgentVersion,
  CreateAgentFromTemplateInput,
  CreateAgentInput,
  CreateAgentMemoryEntryInput,
  CreateAgentTemplateInput,
  ListAgentMemoryQuery,
  ListAgentRunsQuery,
  ListAgentsQuery,
  ListAgentTemplatesQuery,
  RunAgentInput,
  UpdateAgentInput,
  UpdateAgentTemplateInput,
  UpsertAgentMemoryPolicyInput,
} from "./agent-types";

// ---------------------------------------------------------------------------
// Append-only audit log (best-effort — never blocks the primary operation)
// ---------------------------------------------------------------------------

export type AuditLogInput = {
  agentId?: string | null;
  runId?: string | null;
  level?: "info" | "warn" | "error";
  event: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Writes an `AgentExecutionLog` row. Swallows failures (e.g. the migration
 * for this Phase 1 table has not been executed yet in this environment) so
 * audit logging can never break agent create/run/cancel. Never pass a raw
 * system prompt or secret into `message`/`metadata` — use
 * `redactSystemPrompt` first.
 */
export async function writeAgentExecutionLog(ctx: AgentContext, input: AuditLogInput): Promise<void> {
  try {
    const db = getAgentDb() as unknown as {
      agentExecutionLog: { create(args: unknown): Promise<unknown> };
    };
    await db.agentExecutionLog.create({
      data: {
        organizationId: ctx.organizationId,
        workspaceId: null,
        agentId: input.agentId ?? null,
        runId: input.runId ?? null,
        level: input.level ?? "info",
        event: input.event,
        message: input.message,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch {
    // Best-effort audit trail only; the AgentExecutionLog migration is
    // additive and may not be applied in every environment yet.
  }
}

// ---------------------------------------------------------------------------
// Agent CRUD
// ---------------------------------------------------------------------------

export async function createAgent(
  ctx: AgentContext,
  input: CreateAgentInput,
): Promise<{ agent: Agent; version: AgentVersion }> {
  assertAgentPermission(ctx, "edit");
  const result = await libCreateAgent(ctx, input);
  const { preview } = redactSystemPrompt(input.systemPrompt);
  await writeAgentExecutionLog(ctx, {
    agentId: result.agent.agentId,
    event: "agent.created",
    message: `Agent '${result.agent.name}' created (systemPrompt preview: "${preview}")`,
    metadata: { versionId: result.version.versionId },
  });
  return result;
}

export async function updateAgent(ctx: AgentContext, agentId: string, patch: UpdateAgentInput): Promise<Agent> {
  assertAgentPermission(ctx, "edit");
  const agent = await updateAgentMeta(ctx, agentId, patch);
  await writeAgentExecutionLog(ctx, {
    agentId,
    event: "agent.updated",
    message: `Agent '${agentId}' metadata updated`,
  });
  return agent;
}

export async function archiveAgent(ctx: AgentContext, agentId: string): Promise<Agent> {
  assertAgentPermission(ctx, "admin");
  const agent = await libArchiveAgent(ctx, agentId);
  await writeAgentExecutionLog(ctx, {
    agentId,
    event: "agent.archived",
    message: `Agent '${agentId}' archived`,
  });
  return agent;
}

export async function getAgent(
  ctx: AgentContext,
  agentId: string,
): Promise<{ agent: Agent; versions: AgentVersion[] }> {
  assertAgentPermission(ctx, "read");
  const agent = await libGetAgent(ctx, agentId);
  const versions = await listAgentVersions(ctx, agentId);
  return { agent, versions };
}

export async function listAgents(ctx: AgentContext, query: ListAgentsQuery = {}): Promise<Agent[]> {
  assertAgentPermission(ctx, "read");
  return libListAgents(ctx, query);
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export async function runAgent(ctx: AgentContext, agentId: string, input: RunAgentInput): Promise<AgentRunResult> {
  assertAgentPermission(ctx, "edit");
  try {
    const result = await runAgentSafely(ctx, agentId, input);
    await writeAgentExecutionLog(ctx, {
      agentId,
      runId: result.run.runId,
      event: "agent.run.executed",
      message: `Run ${result.run.runId} finished with status ${result.run.status}`,
      metadata: { status: result.run.status, tokenUsage: result.run.tokenUsage },
    });
    return result;
  } catch (err) {
    await writeAgentExecutionLog(ctx, {
      agentId,
      level: "error",
      event: "agent.run.failed",
      message: err instanceof Error ? err.message : "Agent run failed",
    });
    throw err;
  }
}

export async function getAgentRun(ctx: AgentContext, runId: string): Promise<AgentRunResult> {
  assertAgentPermission(ctx, "read");
  return getAgentRunWithSteps(ctx, runId);
}

export async function listAgentRuns(ctx: AgentContext, query: ListAgentRunsQuery = {}): Promise<AgentRun[]> {
  assertAgentPermission(ctx, "read");
  return listRuns(ctx, query);
}

export async function cancelAgentRun(ctx: AgentContext, runId: string, reason?: string): Promise<AgentRun> {
  assertAgentPermission(ctx, "edit");
  const run = await cancelRun(ctx, runId, reason);
  await writeAgentExecutionLog(ctx, {
    agentId: run.agentId,
    runId: run.runId,
    event: "agent.run.cancelled",
    message: `Run ${run.runId} cancelled${reason ? `: ${reason}` : ""}`,
  });
  return run;
}

// ---------------------------------------------------------------------------
// M8 Agent Platform Phase 2A — templates
// ---------------------------------------------------------------------------

export async function listAgentTemplates(
  ctx: AgentContext,
  query: ListAgentTemplatesQuery = {},
): Promise<AgentTemplateRecord[]> {
  return coreListAgentTemplates(ctx, query);
}

export async function getAgentTemplate(ctx: AgentContext, templateId: string): Promise<AgentTemplateRecord> {
  return coreGetAgentTemplate(ctx, templateId);
}

export async function createAgentTemplate(
  ctx: AgentContext,
  input: CreateAgentTemplateInput,
): Promise<AgentTemplateRecord> {
  const template = await coreCreateAgentTemplate(ctx, input);
  await writeAgentExecutionLog(ctx, {
    event: "agent_template.created",
    message: `Agent template '${template.name}' (${template.templateId}) created`,
    metadata: { templateId: template.templateId, isSystemTemplate: template.isSystemTemplate },
  });
  return template;
}

export async function updateAgentTemplate(
  ctx: AgentContext,
  templateId: string,
  patch: UpdateAgentTemplateInput,
): Promise<AgentTemplateRecord> {
  const template = await coreUpdateAgentTemplate(ctx, templateId, patch);
  await writeAgentExecutionLog(ctx, {
    event: "agent_template.updated",
    message: `Agent template '${templateId}' updated`,
    metadata: { templateId },
  });
  return template;
}

export async function deleteAgentTemplate(ctx: AgentContext, templateId: string): Promise<void> {
  await coreDeleteAgentTemplate(ctx, templateId);
  await writeAgentExecutionLog(ctx, {
    event: "agent_template.deleted",
    message: `Agent template '${templateId}' deleted`,
    metadata: { templateId },
  });
}

export async function createAgentFromTemplate(
  ctx: AgentContext,
  input: CreateAgentFromTemplateInput,
): Promise<{ agent: Agent; version: AgentVersion; templateId: string; templateSlug: string }> {
  const result = await coreCreateAgentFromTemplate(ctx, input);
  const { preview } = redactSystemPrompt(result.version.systemPrompt);
  await writeAgentExecutionLog(ctx, {
    agentId: result.agent.agentId,
    event: "agent.created_from_template",
    message: `Agent '${result.agent.name}' created from template '${result.templateSlug}' (systemPrompt preview: "${preview}")`,
    metadata: { versionId: result.version.versionId, templateId: result.templateId },
  });
  return result;
}

// ---------------------------------------------------------------------------
// M8 Agent Platform Phase 2A — memory policy & memory entries
// ---------------------------------------------------------------------------

export async function getAgentMemoryPolicy(ctx: AgentContext, agentId: string): Promise<AgentMemoryPolicyRecord> {
  return coreGetAgentMemoryPolicy(ctx, agentId);
}

export async function upsertAgentMemoryPolicy(
  ctx: AgentContext,
  agentId: string,
  patch: UpsertAgentMemoryPolicyInput,
): Promise<AgentMemoryPolicyRecord> {
  try {
    const before = await coreGetAgentMemoryPolicy(ctx, agentId).catch(() => null);
    const policy = await coreUpsertAgentMemoryPolicy(ctx, agentId, patch);
    await writeAgentExecutionLog(ctx, {
      agentId,
      event: "agent_memory_policy.updated",
      message: `Memory policy for agent '${agentId}' updated (memoryEnabled=${policy.memoryEnabled})`,
      metadata: {
        policyId: policy.policyId,
        memoryEnabledChanged: before ? before.memoryEnabled !== policy.memoryEnabled : true,
        allowUserMemory: policy.allowUserMemory,
        allowAgentMemory: policy.allowAgentMemory,
        allowExecutionSummaryWrite: policy.allowExecutionSummaryWrite,
        allowRead: policy.allowRead,
        result: "ok",
      },
    });
    return policy;
  } catch (err) {
    const code = err instanceof Error && "code" in err ? String((err as { code: string }).code) : "ERROR";
    await writeAgentExecutionLog(ctx, {
      agentId,
      level: "warn",
      event: "agent_memory_policy.rejected",
      message: `Memory policy update rejected for agent '${agentId}'`,
      metadata: { result: "rejected", reasonCode: code },
    });
    throw err;
  }
}

export async function listAgentMemoryEntries(
  ctx: AgentContext,
  agentId: string,
  query: ListAgentMemoryQuery = {},
): Promise<AgentMemoryPhase2Record[]> {
  return coreListAgentMemoryEntries(ctx, agentId, query);
}

export async function createAgentMemoryEntry(
  ctx: AgentContext,
  agentId: string,
  input: CreateAgentMemoryEntryInput,
): Promise<AgentMemoryPhase2Record> {
  try {
    const entry = await coreCreateAgentMemoryEntry(ctx, { ...input, agentId });
    await writeAgentExecutionLog(ctx, {
      agentId,
      event: "agent_memory.created",
      message: `Memory entry '${entry.key}' created for agent '${agentId}' (type=${entry.memoryType ?? entry.scope})`,
      metadata: { memoryId: entry.memoryId, memoryType: entry.memoryType, result: "ok" },
    });
    return entry;
  } catch (err) {
    const code = err instanceof Error && "code" in err ? String((err as { code: string }).code) : "ERROR";
    await writeAgentExecutionLog(ctx, {
      agentId,
      level: "warn",
      event: "agent_memory.rejected",
      message: `Memory create rejected for agent '${agentId}'`,
      metadata: {
        result: "rejected",
        reasonCode: code,
        memoryType: input.memoryType,
      },
    });
    throw err;
  }
}

export async function deleteAgentMemoryEntry(ctx: AgentContext, agentId: string, memoryId: string): Promise<void> {
  await coreDeleteAgentMemoryEntry(ctx, agentId, memoryId);
  await writeAgentExecutionLog(ctx, {
    agentId,
    event: "agent_memory.deleted",
    message: `Memory entry '${memoryId}' deleted for agent '${agentId}'`,
    metadata: { memoryId },
  });
}

export async function clearAgentMemory(ctx: AgentContext, agentId: string): Promise<{ count: number }> {
  const result = await coreClearAgentMemory(ctx, agentId);
  await writeAgentExecutionLog(ctx, {
    agentId,
    event: "agent_memory.cleared",
    message: `All memory cleared for agent '${agentId}' (${result.count} entries removed)`,
    metadata: { count: result.count },
  });
  return result;
}
