import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeAgentDb } from "./test-helpers/fake-agent-db";

const fakeDb = makeFakeAgentDb();

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return fakeDb;
  },
}));

import type { AgentContext } from "@/lib/agents/auth";
import { createAgentFromTemplate } from "../from-template-service";
import { createAgentTemplate, updateAgentTemplate } from "../template-service";
import { SYSTEM_AGENT_TEMPLATES } from "../template-catalog";
import { CreateAgentTemplateSchema, UpdateAgentTemplateSchema } from "../agent-types";

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    user: { id: "user_a", email: "a@example.com" } as AgentContext["user"],
    organizationId: "org_a",
    organization: { id: "org_a" } as AgentContext["organization"],
    role: "OWNER",
    platformAdmin: false,
    ...overrides,
  };
}

beforeEach(() => {
  fakeDb.agentTemplate._rows.length = 0;
  fakeDb.agentDefinition._rows.length = 0;
  fakeDb.agentVersion._rows.length = 0;
});

describe("createAgentFromTemplate — immutable snapshot", () => {
  it("creates an agent+version copying the system template's fields", async () => {
    const ctx = makeCtx();
    const template = SYSTEM_AGENT_TEMPLATES[0];
    const result = await createAgentFromTemplate(ctx, { templateId: template.templateId });

    expect(result.agent.name).toBe(template.name);
    expect(result.version.systemPrompt).toBe(template.systemPrompt);
    expect(result.version.toolIds.sort()).toEqual([...template.allowedToolKeys].sort());
    expect(result.templateId).toBe(template.templateId);
  });

  it("honors a custom agent name override", async () => {
    const ctx = makeCtx();
    const template = SYSTEM_AGENT_TEMPLATES[0];
    const result = await createAgentFromTemplate(ctx, { templateId: template.templateId, name: "My Custom Name" });
    expect(result.agent.name).toBe("My Custom Name");
  });

  it("is an immutable snapshot: editing the template later does not change the already-created agent version", async () => {
    const ctx = makeCtx({ platformAdmin: true });
    const template = SYSTEM_AGENT_TEMPLATES[0];
    const result = await createAgentFromTemplate(ctx, { templateId: template.templateId });
    const originalPrompt = result.version.systemPrompt;

    await updateAgentTemplate(ctx, template.templateId, UpdateAgentTemplateSchema.parse({ systemPrompt: "Totally different prompt now" }));

    // Re-fetch the agent's version from the fake DB — it must be unchanged.
    const persistedVersion = await fakeDb.agentVersion.findUnique({ where: { versionId: result.version.versionId } });
    expect(persistedVersion?.systemPrompt).toBe(originalPrompt);
    expect(persistedVersion?.systemPrompt).not.toContain("Totally different");
  });

  it("rejects creating an agent from an inactive template", async () => {
    const ctx = makeCtx();
    const custom = await createAgentTemplate(
      ctx,
      CreateAgentTemplateSchema.parse({
        name: "Inactive",
        slug: "inactive-tpl",
        category: "custom",
        systemPrompt: "p",
        isActive: false,
      }),
    );
    await expect(createAgentFromTemplate(ctx, { templateId: custom.templateId })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects creating an agent from another organization's custom template (isolation)", async () => {
    const ctxA = makeCtx({ organizationId: "org_a" });
    const ctxB = makeCtx({ organizationId: "org_b", user: { id: "user_b", email: "b@example.com" } as AgentContext["user"] });
    const custom = await createAgentTemplate(
      ctxA,
      CreateAgentTemplateSchema.parse({ name: "Private", slug: "private-tpl", category: "custom", systemPrompt: "p" }),
    );
    await expect(createAgentFromTemplate(ctxB, { templateId: custom.templateId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("createAgentFromTemplate — tool revalidation (defense in depth)", () => {
  it("rejects creation when a stored template row references a tool outside the current Phase 1 allowlist", async () => {
    const ctx = makeCtx();
    // Simulate a template that somehow drifted to reference a disallowed tool
    // (e.g. a future allowlist tightening) by writing directly to the fake
    // DB, bypassing the service-level validation that normally prevents this
    // at create time — this isolates the from-template-time revalidation.
    await fakeDb.agentTemplate.create({
      data: {
        templateId: "tpl_drifted",
        organizationId: ctx.organizationId,
        workspaceId: null,
        name: "Drifted",
        slug: "drifted",
        description: null,
        category: "custom",
        systemPrompt: "p",
        defaultModel: "mock-standard-v1",
        defaultTemperature: 0.5,
        defaultMaxSteps: 8,
        defaultTimeoutMs: 60_000,
        defaultCostCeiling: 5,
        allowedToolKeys: ["shell"],
        isSystemTemplate: false,
        isActive: true,
        createdBy: ctx.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await expect(createAgentFromTemplate(ctx, { templateId: "tpl_drifted" })).rejects.toMatchObject({
      code: "TOOL_NOT_ALLOWED",
      status: 403,
    });
  });
});
