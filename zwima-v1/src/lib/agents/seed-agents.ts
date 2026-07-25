import { assertAgentPermission, type AgentContext } from "./auth";
import { createPromptTemplate, createPromptVersion, publishPromptVersion, listPromptTemplates } from "./prompt-service";
import { seedMockTools } from "./tool-registry-service";
import type { PromptTemplateRecord, ToolDefinitionRecord } from "./types";

export type SeedAgentPlatformResult = {
  tools: ToolDefinitionRecord[];
  samplePromptTemplate: PromptTemplateRecord;
};

const SAMPLE_PROMPT_KEY = "sample-assistant-prompt";
const SAMPLE_PROMPT_CONTENT =
  "You are a helpful mock assistant for {{organization}}. Answer concisely, use the {{tone}} tone, and never claim to have taken any real-world action (no real emails, no live web browsing, no live model calls) — this is a Mock-provider demo agent.";

/** Idempotently seeds the four built-in mock tools plus one sample published prompt template, for demo/dev bootstrap. */
export async function seedAgentPlatformDefaults(ctx: AgentContext): Promise<SeedAgentPlatformResult> {
  assertAgentPermission(ctx, "admin");

  const tools = await seedMockTools(ctx);

  const existingTemplates = await listPromptTemplates(ctx);
  let template = existingTemplates.find((t) => t.key === SAMPLE_PROMPT_KEY);

  if (!template) {
    template = await createPromptTemplate(ctx, {
      key: SAMPLE_PROMPT_KEY,
      name: "Sample Assistant Prompt",
      description: "Seed prompt template demonstrating variables + publish workflow for the mock agent platform.",
    });
    const version = await createPromptVersion(ctx, template.templateId, {
      content: SAMPLE_PROMPT_CONTENT,
      variables: ["organization", "tone"],
    });
    await publishPromptVersion(ctx, version.versionId);
    template = { ...template, status: "PUBLISHED", currentVersionId: version.versionId };
  }

  return { tools, samplePromptTemplate: template };
}
