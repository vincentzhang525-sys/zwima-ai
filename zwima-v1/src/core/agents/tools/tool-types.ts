/**
 * M8 Agent Platform Phase 1 — core tool interface.
 *
 * All Phase 1 tools are pure/local: no network requests, no filesystem
 * writes, no raw SQL execution from tool input, no real email/payment side
 * effects. See `agent-safety.ts` for the enforced allowlist.
 */

export type ToolExecutionContext = {
  organizationId: string;
  workspaceId?: string | null;
  runId?: string;
};

export type ToolInput = Record<string, unknown>;
export type ToolOutput = Record<string, unknown>;

export type ToolHandler = (input: ToolInput, context: ToolExecutionContext) => Promise<ToolOutput>;

export type ToolDescriptor = {
  key: string;
  name: string;
  description: string;
  handler: ToolHandler;
};
