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
import { createAgent, runAgent } from "../agent-service";
import { RunAgentSchema } from "../agent-types";
import { upsertAgentMemoryPolicy } from "../memory-policy-service";
import { listAgentMemoryEntries } from "../memory-phase2-service";
import { buildMemoryContextBlock, injectMemoryContext } from "../agent-runner";
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
  fakeDb.agentMemoryPolicy._rows.length = 0;
  fakeDb.agentMemory._rows.length = 0;
});

describe("buildMemoryContextBlock / injectMemoryContext — pure helpers", () => {
  it("returns null for an empty entry list", () => {
    expect(buildMemoryContextBlock([])).toBeNull();
  });

  it("formats entries as a read-only, clearly separated block", () => {
    const block = buildMemoryContextBlock([
      { memoryType: "USER", scope: "CONVERSATION", key: "favorite-language", value: "TypeScript", valuePreview: "Ty***pt (10 chars)" },
    ]);
    expect(block).toContain("MEMORY CONTEXT");
    expect(block).toContain("favorite-language");
    expect(block).toContain("TypeScript");
  });

  it("injectMemoryContext prepends a distinct system message without touching message/prompt shape otherwise", () => {
    const raw = { message: "hello" };
    const injected = injectMemoryContext(raw, "MEMORY CONTEXT: foo");
    expect(injected.messages).toEqual([
      { role: "system", content: "MEMORY CONTEXT: foo" },
      { role: "user", content: "hello" },
    ]);
  });

  it("injectMemoryContext returns the input unchanged when there is no block", () => {
    const raw = { message: "hello" };
    expect(injectMemoryContext(raw, null)).toBe(raw);
  });
});

describe("runAgent — memory injection never overrides systemPrompt or the tool allowlist", () => {
  it("a run still rejects a forbidden tool even when memory is enabled", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);
    await upsertAgentMemoryPolicy(ctx, agent.agentId, { memoryEnabled: true });

    await expect(
      runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { useTool: { toolKey: "shell" } } })),
    ).rejects.toMatchObject({ code: "TOOL_NOT_ALLOWED" });
  });
});

describe("runAgent — execution summary memory (write-on-success only)", () => {
  it("writes an EXECUTION_SUMMARY memory entry after a COMPLETED run when memory is enabled", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);
    await upsertAgentMemoryPolicy(ctx, agent.agentId, { memoryEnabled: true });

    const result = await runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { message: "hello mock" } }));
    expect(result.run.status).toBe("COMPLETED");

    const entries = await listAgentMemoryEntries(ctx, agent.agentId, { memoryType: "EXECUTION_SUMMARY" });
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe(`run:${result.run.runId}`);
  });

  it("writes nothing when memory is disabled (default)", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);
    // Memory policy left at its default (disabled).
    const result = await runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { message: "hello mock" } }));
    expect(result.run.status).toBe("COMPLETED");

    const entries = await listAgentMemoryEntries(ctx, agent.agentId);
    expect(entries).toHaveLength(0);
  });

  it("writes nothing for a run that does not reach COMPLETED (e.g. left QUEUED via execute: false)", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);
    await upsertAgentMemoryPolicy(ctx, agent.agentId, { memoryEnabled: true });

    const result = await runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { message: "hi" }, execute: false }));
    expect(result.run.status).toBe("QUEUED");

    const entries = await listAgentMemoryEntries(ctx, agent.agentId);
    expect(entries).toHaveLength(0);
  });

  it("writes nothing for a run that requests a forbidden tool and never completes", async () => {
    const ctx = makeCtx();
    const { agent } = await registerAndPublish(ctx, createAgent);
    await upsertAgentMemoryPolicy(ctx, agent.agentId, { memoryEnabled: true });

    await expect(
      runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { useTool: { toolKey: "shell" } } })),
    ).rejects.toMatchObject({ code: "TOOL_NOT_ALLOWED" });

    const entries = await listAgentMemoryEntries(ctx, agent.agentId);
    expect(entries).toHaveLength(0);
  });
});

describe("Live provider fail-closed still applies with memory enabled", () => {
  it("a non-mock provider version is still blocked, memory or not", async () => {
    const ctx = makeCtx();
    const { agent, version } = await registerAndPublish(ctx, createAgent);
    await upsertAgentMemoryPolicy(ctx, agent.agentId, { memoryEnabled: true });
    // Simulate a drifted version.provider (never possible via the public API, but defends the runner itself).
    const dbVersion = await fakeDb.agentVersion.findUnique({ where: { versionId: version.versionId } });
    if (dbVersion) (dbVersion as { provider: string }).provider = "openai";

    await expect(
      runAgent(ctx, agent.agentId, RunAgentSchema.parse({ input: { message: "hi" } })),
    ).rejects.toMatchObject({ code: "LIVE_PROVIDER_BLOCKED", status: 403 });
  });
});
