import type { AgentContext } from "@/lib/agents/auth";
import { publishAgentVersion } from "@/lib/agents/registry-service";
import type { Agent, AgentVersion, CreateAgentInput } from "../../agent-types";

type CreateAgentFn = (
  ctx: AgentContext,
  input: CreateAgentInput,
) => Promise<{ agent: Agent; version: AgentVersion }>;

/**
 * Test helper: creates a DRAFT agent via the real `createAgent` facade, then
 * publishes its first version via the (already-tested elsewhere)
 * `registry-service.publishAgentVersion`, so `runAgent` has an ACTIVE
 * agent+version to execute against — mirroring the real create -> publish ->
 * run lifecycle without duplicating that logic in every test.
 */
export async function registerAndPublish(
  ctx: AgentContext,
  createAgentFn: CreateAgentFn,
  input: CreateAgentInput = { name: "Test Agent", systemPrompt: "You are a helpful mock assistant." },
): Promise<{ agent: Agent; version: AgentVersion }> {
  const created = await createAgentFn(ctx, input);
  const published = await publishAgentVersion(ctx, created.version.versionId);
  return { agent: { ...created.agent, status: "ACTIVE", currentVersionId: published.versionId }, version: published };
}
