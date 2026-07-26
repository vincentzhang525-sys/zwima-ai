import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeAgentDb } from "./test-helpers/fake-agent-db";

const fakeDb = makeFakeAgentDb();

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return fakeDb;
  },
}));

import type { AgentContext } from "@/lib/agents/auth";
import { AgentServiceError } from "@/lib/agents/errors";
import {
  createAgentTemplate,
  deleteAgentTemplate,
  getAgentTemplate,
  listAgentTemplates,
  updateAgentTemplate,
} from "../template-service";
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
});

describe("system template catalog", () => {
  it("has exactly the three Phase 2A system templates", () => {
    expect(SYSTEM_AGENT_TEMPLATES).toHaveLength(3);
    const slugs = SYSTEM_AGENT_TEMPLATES.map((t) => t.slug).sort();
    expect(slugs).toEqual(["api-integration-assistant", "cost-optimization-assistant", "eu-compliance-assistant"].sort());
  });

  it("every system template's allowedToolKeys is a subset of the Phase 1 allowlist", () => {
    const allowed = new Set(["calculator", "current_datetime", "workspace_usage_summary"]);
    for (const t of SYSTEM_AGENT_TEMPLATES) {
      for (const key of t.allowedToolKeys) {
        expect(allowed.has(key)).toBe(true);
      }
    }
  });

  it("the EU Compliance Assistant explicitly disclaims legal advice and omits the calculator tool", () => {
    const compliance = SYSTEM_AGENT_TEMPLATES.find((t) => t.slug === "eu-compliance-assistant");
    expect(compliance).toBeDefined();
    expect(compliance!.systemPrompt.toLowerCase()).toContain("not legal advice");
    expect(compliance!.allowedToolKeys).not.toContain("calculator");
  });
});

describe("listAgentTemplates — template isolation", () => {
  it("includes all system templates for any organization", async () => {
    const ctx = makeCtx({ organizationId: "org_a" });
    const rows = await listAgentTemplates(ctx);
    const systemRows = rows.filter((r) => r.isSystemTemplate);
    expect(systemRows.length).toBeGreaterThanOrEqual(3);
  });

  it("never returns another organization's custom template", async () => {
    const ctxA = makeCtx({ organizationId: "org_a" });
    const ctxB = makeCtx({ organizationId: "org_b", user: { id: "user_b", email: "b@example.com" } as AgentContext["user"] });

    await createAgentTemplate(
      ctxA,
      CreateAgentTemplateSchema.parse({
        name: "Org A Custom",
        slug: "org-a-custom",
        category: "custom",
        systemPrompt: "Custom prompt A",
        allowedToolKeys: ["calculator"],
      }),
    );

    const rowsA = await listAgentTemplates(ctxA);
    const rowsB = await listAgentTemplates(ctxB);
    expect(rowsA.some((r) => r.slug === "org-a-custom")).toBe(true);
    expect(rowsB.some((r) => r.slug === "org-a-custom")).toBe(false);
  });

  it("getAgentTemplate returns NOT_FOUND for another org's custom template", async () => {
    const ctxA = makeCtx({ organizationId: "org_a" });
    const ctxB = makeCtx({ organizationId: "org_b", user: { id: "user_b", email: "b@example.com" } as AgentContext["user"] });
    const created = await createAgentTemplate(
      ctxA,
      CreateAgentTemplateSchema.parse({
        name: "Private",
        slug: "private-tpl",
        category: "custom",
        systemPrompt: "secret",
        allowedToolKeys: [],
      }),
    );

    await expect(getAgentTemplate(ctxB, created.templateId)).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("createAgentTemplate — tool allowlist validation", () => {
  it("rejects a tool key outside the Phase 1 allowlist", async () => {
    const ctx = makeCtx();
    await expect(
      createAgentTemplate(
        ctx,
        CreateAgentTemplateSchema.parse({
          name: "Bad",
          slug: "bad-tpl",
          category: "custom",
          systemPrompt: "p",
          allowedToolKeys: ["shell"],
        }),
      ),
    ).rejects.toMatchObject({ code: "TOOL_NOT_ALLOWED", status: 403 });
  });

  it("rejects defaultMaxSteps/defaultTimeoutMs/defaultCostCeiling above the Phase 1 ceilings", async () => {
    const ctx = makeCtx();
    await expect(
      createAgentTemplate(
        ctx,
        CreateAgentTemplateSchema.parse({
          name: "Over budget",
          slug: "over-budget",
          category: "custom",
          systemPrompt: "p",
          defaultMaxSteps: 50,
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a duplicate slug within the same organization", async () => {
    const ctx = makeCtx();
    const input = CreateAgentTemplateSchema.parse({
      name: "Dup",
      slug: "dup-tpl",
      category: "custom",
      systemPrompt: "p",
    });
    await createAgentTemplate(ctx, input);
    await expect(createAgentTemplate(ctx, input)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("admin vs customer — system template mutation", () => {
  it("a non-platform-admin cannot create a system template", async () => {
    const ctx = makeCtx({ platformAdmin: false });
    await expect(
      createAgentTemplate(
        ctx,
        CreateAgentTemplateSchema.parse({
          name: "Fake System",
          slug: "fake-system",
          category: "custom",
          systemPrompt: "p",
          isSystemTemplate: true,
        }),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("a platform admin can create a system template", async () => {
    const ctx = makeCtx({ platformAdmin: true });
    const tpl = await createAgentTemplate(
      ctx,
      CreateAgentTemplateSchema.parse({
        name: "Extra System",
        slug: "extra-system",
        category: "custom",
        systemPrompt: "p",
        isSystemTemplate: true,
      }),
    );
    expect(tpl.isSystemTemplate).toBe(true);
    expect(tpl.organizationId).toBeNull();
  });

  it("a non-platform-admin cannot update a catalog system template", async () => {
    const ctx = makeCtx({ platformAdmin: false });
    const target = SYSTEM_AGENT_TEMPLATES[0];
    await expect(
      updateAgentTemplate(ctx, target.templateId, UpdateAgentTemplateSchema.parse({ description: "hacked" })),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("a platform admin CAN update a catalog system template (materializes an override row)", async () => {
    const ctx = makeCtx({ platformAdmin: true });
    const target = SYSTEM_AGENT_TEMPLATES[0];
    const updated = await updateAgentTemplate(
      ctx,
      target.templateId,
      UpdateAgentTemplateSchema.parse({ description: "Updated by admin" }),
    );
    expect(updated.description).toBe("Updated by admin");

    const fetched = await getAgentTemplate(makeCtx({ platformAdmin: false }), target.templateId);
    expect(fetched.description).toBe("Updated by admin");
  });

  it("a non-platform-admin cannot delete a system template", async () => {
    const ctx = makeCtx({ platformAdmin: false });
    const target = SYSTEM_AGENT_TEMPLATES[0];
    await expect(deleteAgentTemplate(ctx, target.templateId)).rejects.toMatchObject({ status: 403 });
  });

  it("cannot delete a catalog-only system template even as platform admin (no override row exists)", async () => {
    const ctx = makeCtx({ platformAdmin: true });
    const target = SYSTEM_AGENT_TEMPLATES[1];
    await expect(deleteAgentTemplate(ctx, target.templateId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("a customer (non-admin org role) can still create/update/delete their own org's custom template", async () => {
    const ctx = makeCtx({ role: "DEVELOPER", platformAdmin: false });
    const created = await createAgentTemplate(
      ctx,
      CreateAgentTemplateSchema.parse({ name: "Dev Custom", slug: "dev-custom", category: "custom", systemPrompt: "p" }),
    );
    const updated = await updateAgentTemplate(ctx, created.templateId, UpdateAgentTemplateSchema.parse({ name: "Dev Custom 2" }));
    expect(updated.name).toBe("Dev Custom 2");
  });
});

describe("AgentServiceError shape", () => {
  it("getAgentTemplate throws AgentServiceError for an unknown templateId", async () => {
    const ctx = makeCtx();
    await expect(getAgentTemplate(ctx, "tpl_does_not_exist")).rejects.toBeInstanceOf(AgentServiceError);
  });
});
