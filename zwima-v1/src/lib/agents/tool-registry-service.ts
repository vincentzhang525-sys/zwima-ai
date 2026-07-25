import { assertAgentPermission, type AgentContext } from "./auth";
import { AgentServiceError } from "./errors";
import { getAgentDb, newToolId, newToolVersionId, type ToolDefinitionRecord, type ToolRuntimeStatus, type ToolVersionRecord } from "./types";
import { MOCK_TOOL_KEYS, isMockToolKey, type MockToolKey } from "./mock-tools";

export type CreateToolInput = {
  key: string;
  name: string;
  description?: string | null;
  handlerKey: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

const MOCK_TOOL_SEED_META: Record<MockToolKey, { name: string; description: string }> = {
  calculator: {
    name: "Calculator",
    description: "Evaluates basic arithmetic expressions (+ - * / and parentheses). Local, deterministic, no network.",
  },
  "web-search-mock": {
    name: "Web Search (Mock)",
    description: "Returns deterministic synthetic search results for a query. No live web request is made.",
  },
  "document-retrieval-mock": {
    name: "Document Retrieval (Mock)",
    description: "Returns deterministic synthetic document chunks for a query. No real document store is queried.",
  },
  "email-draft-mock": {
    name: "Email Draft (Mock)",
    description: "Drafts an email (to/subject/body) and returns it as text only. Never sends email.",
  },
};

function validateHandlerKey(handlerKey: string) {
  if (!isMockToolKey(handlerKey)) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      `Unknown mock tool handlerKey '${handlerKey}'. Must be one of: ${MOCK_TOOL_KEYS.join(", ")}`,
      400,
    );
  }
}

export async function listTools(
  ctx: AgentContext,
  params: { status?: ToolRuntimeStatus } = {},
): Promise<ToolDefinitionRecord[]> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  return db.toolDefinition.findMany({
    where: {
      OR: [{ organizationId: ctx.organizationId }, { organizationId: null }],
      status: params.status,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getTool(ctx: AgentContext, toolId: string): Promise<ToolDefinitionRecord> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  const tool = await db.toolDefinition.findUnique({ where: { toolId } });
  if (!tool || (tool.organizationId !== null && tool.organizationId !== ctx.organizationId)) {
    throw new AgentServiceError("NOT_FOUND", "Tool not found", 404);
  }
  return tool;
}

export async function createTool(
  ctx: AgentContext,
  input: CreateToolInput,
): Promise<{ tool: ToolDefinitionRecord; version: ToolVersionRecord }> {
  assertAgentPermission(ctx, "admin");
  const key = String(input.key || "").trim();
  const name = String(input.name || "").trim();
  if (!key || !name) throw new AgentServiceError("VALIDATION_ERROR", "key and name are required", 400);
  validateHandlerKey(input.handlerKey);

  const db = getAgentDb();
  const existing = await db.toolDefinition.findFirst({ where: { organizationId: ctx.organizationId, key } });
  if (existing) throw new AgentServiceError("CONFLICT", `Tool key '${key}' already exists`, 409);

  const toolId = newToolId();
  const versionId = newToolVersionId();

  const tool = await db.toolDefinition.create({
    data: {
      toolId,
      organizationId: ctx.organizationId,
      key,
      name,
      description: input.description ?? null,
      status: "ENABLED",
      currentVersionId: versionId,
      isMock: true,
      createdBy: ctx.user.id,
    },
  });

  const version = await db.toolVersion.create({
    data: {
      versionId,
      toolId,
      versionNumber: 1,
      inputSchema: input.inputSchema ?? {},
      outputSchema: input.outputSchema ?? {},
      handlerKey: input.handlerKey,
      status: "ENABLED",
    },
  });

  return { tool, version };
}

export async function createToolVersion(
  ctx: AgentContext,
  toolId: string,
  input: { inputSchema?: Record<string, unknown>; outputSchema?: Record<string, unknown>; handlerKey?: string },
): Promise<ToolVersionRecord> {
  assertAgentPermission(ctx, "admin");
  const tool = await getTool(ctx, toolId);
  if (input.handlerKey) validateHandlerKey(input.handlerKey);

  const db = getAgentDb();
  const latest = await db.toolVersion.findFirst({ where: { toolId }, orderBy: { versionNumber: "desc" } });
  const versionId = newToolVersionId();
  const version = await db.toolVersion.create({
    data: {
      versionId,
      toolId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      inputSchema: input.inputSchema ?? latest?.inputSchema ?? {},
      outputSchema: input.outputSchema ?? latest?.outputSchema ?? {},
      handlerKey: input.handlerKey ?? latest?.handlerKey ?? "calculator",
      status: "ENABLED",
    },
  });

  await db.toolDefinition.update({ where: { id: tool.id }, data: { currentVersionId: versionId } });
  return version;
}

export async function setToolStatus(
  ctx: AgentContext,
  toolId: string,
  status: ToolRuntimeStatus,
): Promise<ToolDefinitionRecord> {
  assertAgentPermission(ctx, "admin");
  const tool = await getTool(ctx, toolId);
  const db = getAgentDb();
  return db.toolDefinition.update({ where: { id: tool.id }, data: { status } });
}

/**
 * Idempotently seeds the four built-in mock tools (calculator, web-search-mock,
 * document-retrieval-mock, email-draft-mock) as org-scoped ENABLED tools.
 */
export async function seedMockTools(ctx: AgentContext): Promise<ToolDefinitionRecord[]> {
  assertAgentPermission(ctx, "admin");
  const db = getAgentDb();
  const seeded: ToolDefinitionRecord[] = [];

  for (const handlerKey of MOCK_TOOL_KEYS) {
    const existing = await db.toolDefinition.findFirst({
      where: { organizationId: ctx.organizationId, key: handlerKey },
    });
    if (existing) {
      seeded.push(existing);
      continue;
    }
    const meta = MOCK_TOOL_SEED_META[handlerKey];
    const { tool } = await createTool(ctx, {
      key: handlerKey,
      name: meta.name,
      description: meta.description,
      handlerKey,
    });
    seeded.push(tool);
  }

  return seeded;
}
