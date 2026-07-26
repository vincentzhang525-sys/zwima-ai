import { AgentServiceError } from "@/lib/agents/errors";
import { isAllowedToolKey } from "../agent-safety";
import { calculatorToolDescriptor } from "./calculator";
import { currentDatetimeToolDescriptor } from "./current-datetime";
import { workspaceUsageSummaryToolDescriptor } from "./workspace-usage-summary";
import type { ToolDescriptor, ToolExecutionContext, ToolInput, ToolOutput } from "./tool-types";

export * from "./tool-types";
export { calculatorToolDescriptor, currentDatetimeToolDescriptor, workspaceUsageSummaryToolDescriptor };

/** The three net-new Phase 1 core tools (calculator is a wrapper reusing the existing implementation). */
export const CORE_TOOL_DESCRIPTORS: readonly ToolDescriptor[] = [
  calculatorToolDescriptor,
  currentDatetimeToolDescriptor,
  workspaceUsageSummaryToolDescriptor,
];

export const CORE_TOOL_REGISTRY: Record<string, ToolDescriptor> = Object.fromEntries(
  CORE_TOOL_DESCRIPTORS.map((d) => [d.key, d]),
);

/**
 * Dispatches a tool call by key, enforcing the Phase 1 allowlist first. Only
 * dispatches the three net-new core tools directly — the pre-existing safe
 * mock tools (`web-search-mock`, `document-retrieval-mock`,
 * `email-draft-mock`) continue to run through
 * `src/lib/agents/mock-tools.ts#runMockTool`, which `agent-runner.ts` calls
 * separately when the requested key isn't one of the three core tools.
 */
export async function runCoreTool(key: string, input: ToolInput, context: ToolExecutionContext): Promise<ToolOutput> {
  if (!isAllowedToolKey(key)) {
    throw new AgentServiceError("TOOL_NOT_ALLOWED", `Tool '${key}' is not on the Phase 1 allowlist`, 403);
  }
  const descriptor = CORE_TOOL_REGISTRY[key];
  if (!descriptor) {
    throw new AgentServiceError("TOOL_NOT_FOUND", `Unknown core tool: ${key}`, 404);
  }
  return descriptor.handler(input, context);
}

export function isCoreToolKey(key: string): boolean {
  return key in CORE_TOOL_REGISTRY;
}
