import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeAgentDb } from "./test-helpers/fake-agent-db";

const fakeDb = makeFakeAgentDb();

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return fakeDb;
  },
}));

vi.mock("@/lib/compliance/event-recorder", () => ({
  recordAIEvent: vi.fn(async () => ({ eventId: "evt_test_1" })),
}));

import type { AgentContext } from "@/lib/agents/auth";
import { AgentServiceError } from "@/lib/agents/errors";
import {
  archiveAgent,
  cancelAgentRun,
  createAgent,
  getAgent,
  getAgentRun,
  listAgents,
  runAgent,
} from "../agent-service";
import { CreateAgentSchema, RunAgentSchema } from "../agent-types";
import { containsSecretLikeString } from "../agent-validator";
import { registerAndPublish } from "./test-helpers/register-and-publish";

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
  fakeDb.agentDefinition._rows.length = 0;
  fakeDb.agentVersion._rows.length = 0;
  fakeDb.agentRun._rows.length = 0;
  fakeDb.agentRunStep._rows.length = 0;
  fakeDb.toolDefinition._rows.length = 0;
  fakeDb.toolExecution._rows.length = 0;
});

describe("createAgent / getAgent / listAgents", () => {
  it("creates an agent and returns it from getAgent for the owning org", async () => {
    const ctx = makeCtx();
    const parsed = CreateAgentSchema.parse({ name: "Support Bot", systemPrompt: "You are a helpful assistant." });
    const { agent } = await createAgent(ctx, parsed);
    expect(agent.status).toBe("DRAFT");

    const fetched = await getAgent(ctx, agent.agentId);
    expect(fetched.agent.agentId).toBe(agent.agentId);
    expect(fetched.versions.length).toBe(1);
  });

  it("invalid payload (missing required fields) is rejected by Zod before hitting the service", () => {
    expect(() => CreateAgentSchema.parse({ name: "" })).toThrow();
    expect(() => CreateAgentSchema.parse({})).toThrow();
  });

  it("only lists agents belonging to the caller's organization", async () => {
    const ctxA = makeCtx({ organizationId: "org_a" });
    const ctxB = makeCtx({ organizationId: "org_b", user: { id: "user_b", email: "b@example.com" } as AgentContext["user"] });

    await createAgent(ctxA, CreateAgentSchema.parse({ name: "Org A Agent", systemPrompt: "prompt a" }));
    await createAgent(ctxB, CreateAgentSchema.parse({ name: "Org B Agent", systemPrompt: "prompt b" }));

    const rowsA = await listAgents(ctxA);
    const rowsB = await listAgents(ctxB);
    expect(rowsA.length).toBe(1);
    expect(rowsB.length).toBe(1);
    expect(rowsA[0].name).toBe("Org A Agent");
    expect(rowsB[0].name).toBe("Org B Agent");
  });
});

describe("workspace/organization isolation", () => {
  it("getAgent returns NOT_FOUND when the agent belongs to a different organization", async () => {
    const ctxA = makeCtx({ organizationId: "org_a" });
    const ctxB = makeCtx({ organizationId: "org_b", user: { id: "user_b", email: "b@example.com" } as AgentContext["user"] });

    const { agent } = await createAgent(ctxA, CreateAgentSchema.parse({ name: "Private", systemPrompt: "secret prompt" }));

    await expect(getAgent(ctxB, agent.agentId)).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("getAgentRun returns NOT_FOUND for a run belonging to a different organization", async () => {
    const ctxA = makeCtx({ organizationId: "org_a" });
    const ctxB = makeCtx({ organizationId: "org_b", user: { id: "user_b", email: "b@example.com" } as AgentContext["user"] });

    const { agent } = await registerAndPublish(ctxA, createAgent);
    const result = await runAgent(ctxA, agent.agentId, RunAgentSchema.parse({ input: { message: "hi" } }));

    await expect(getAgentRun(ctxB, result.run.runId)).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("runAgent — Preview mock provider + persistence", () => {
  it("executes against the deterministic mock provider and persists a COMPLETED run", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);

    const result = await runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { message: "Hello mock agent" } }));

    expect(result.run.status).toBe("COMPLETED");
    expect(result.run.resolvedModel).toContain("mock");
    expect((result.run.output as { text?: string } | null)?.text).toContain("[MOCK]");
    expect(result.steps.length).toBeGreaterThan(0);

    const persisted = await fakeDb.agentRun.findUnique({ where: { runId: result.run.runId } });
    expect(persisted).not.toBeNull();
    expect(persisted?.status).toBe("COMPLETED");
  });

  it("rejects a run that requests a forbidden tool", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);

    await expect(
      runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { useTool: { toolKey: "shell" } } })),
    ).rejects.toMatchObject({ code: "TOOL_NOT_ALLOWED" });
  });

  it("never leaks secret-shaped strings in the run result", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);
    const result = await runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { message: "hello" } }));
    const serialized = JSON.stringify(result);
    expect(containsSecretLikeString(serialized)).toBe(false);
  });
});

describe("cancelAgentRun", () => {
  it("cancels a QUEUED run", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);
    const result = await runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { message: "hi" }, execute: false }));
    expect(result.run.status).toBe("QUEUED");

    const cancelled = await cancelAgentRun(ctx, result.run.runId, "no longer needed");
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("cannot cancel an already-terminal run", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);
    const result = await runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { message: "hi" } }));
    expect(result.run.status).toBe("COMPLETED");

    await expect(cancelAgentRun(ctx, result.run.runId)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("archiveAgent", () => {
  it("archives a DRAFT agent", async () => {
    const ctx = makeCtx();
    const { agent } = await createAgent(ctx, CreateAgentSchema.parse({ name: "To Archive", systemPrompt: "p" }));
    const archived = await archiveAgent(ctx, agent.agentId);
    expect(archived.status).toBe("ARCHIVED");
  });
});

describe("AgentServiceError shape", () => {
  it("is thrown (not a generic Error) for domain failures", async () => {
    const ctx = makeCtx();
    await expect(getAgent(ctx, "agt_does_not_exist")).rejects.toBeInstanceOf(AgentServiceError);
  });
});
