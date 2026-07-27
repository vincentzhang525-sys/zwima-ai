import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeAgentDb } from "./test-helpers/fake-agent-db";

const fakeDb = makeFakeAgentDb();

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return fakeDb;
  },
}));

import type { AgentContext } from "@/lib/agents/auth";
import { createAgent } from "@/lib/agents/registry-service";
import { upsertAgentMemoryPolicy } from "../memory-policy-service";
import {
  clearAgentMemory,
  createAgentMemoryEntry,
  deleteAgentMemoryEntry,
  listAgentMemoryEntries,
  looksLikeSecretPhase2,
} from "../memory-phase2-service";

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

async function makeEnabledAgent(ctx: AgentContext, patch: Record<string, unknown> = {}) {
  const { agent } = await createAgent(ctx, { name: "Agent", systemPrompt: "p" });
  await upsertAgentMemoryPolicy(ctx, agent.agentId, {
    memoryEnabled: true,
    allowUserMemory: true,
    allowAgentMemory: true,
    allowExecutionSummaryWrite: true,
    ...patch,
  });
  return agent;
}

beforeEach(() => {
  fakeDb.agentDefinition._rows.length = 0;
  fakeDb.agentVersion._rows.length = 0;
  fakeDb.agentMemoryPolicy._rows.length = 0;
  fakeDb.agentMemory._rows.length = 0;
});

describe("createAgentMemoryEntry — policy gating", () => {
  it("rejects writes when memory is disabled (default)", async () => {
    const ctx = makeCtx();
    const { agent } = await createAgent(ctx, { name: "Agent", systemPrompt: "p" });
    await expect(
      createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "USER", key: "k", value: "hello" }),
    ).rejects.toMatchObject({ code: "MEMORY_DISABLED", status: 409 });
  });

  it("rejects USER memory when allowUserMemory is false", async () => {
    const ctx = makeCtx();
    const agent = await makeEnabledAgent(ctx, { allowUserMemory: false });
    await expect(
      createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "USER", key: "k", value: "hello" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects WORKSPACE memory with WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE (Phase 2B fail-closed)", async () => {
    const ctx = makeCtx();
    const agent = await makeEnabledAgent(ctx);
    await expect(
      createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "WORKSPACE", key: "k", value: "hello" }),
    ).rejects.toMatchObject({ code: "WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE", status: 409 });
  });

  it("creates an entry with valueHash/valuePreview/bounded value populated", async () => {
    const ctx = makeCtx();
    const agent = await makeEnabledAgent(ctx);
    const entry = await createAgentMemoryEntry(ctx, {
      agentId: agent.agentId,
      memoryType: "USER",
      key: "favorite-language",
      value: "TypeScript",
    });
    expect(entry.valueHash).toBeTruthy();
    expect(entry.valuePreview).toBeTruthy();
    expect(entry.value).toBe("TypeScript");
    expect(entry.memoryType).toBe("USER");
  });
});

describe("looksLikeSecretPhase2 — expanded secret patterns", () => {
  it.each([
    ["sk_live_1234567890abcdef", "stripe live key"],
    ["sk_test_1234567890abcdef", "stripe test key"],
    ["whsec_abcdefghij1234567890", "stripe webhook secret"],
    ["Authorization: Bearer abc123def456ghi789", "authorization header"],
    ["4111 1111 1111 1111", "card-like number"],
  ])("flags %s (%s)", (value) => {
    expect(looksLikeSecretPhase2(value)).toBe(true);
  });

  it("does not flag ordinary short text", () => {
    expect(looksLikeSecretPhase2("The user prefers dark mode and TypeScript.")).toBe(false);
  });
});

describe("createAgentMemoryEntry — secret rejection", () => {
  it.each([
    "my key is sk_live_abcdefghijklmnop",
    "webhook secret whsec_abcdefghijklmnop",
    "Authorization: Bearer abcdefghijklmnop",
    "card number 4111111111111111",
  ])("rejects secret-shaped content: %s", async (value) => {
    const ctx = makeCtx();
    const agent = await makeEnabledAgent(ctx);
    await expect(
      createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "USER", key: "k", value }),
    ).rejects.toMatchObject({ code: "MEMORY_CONTAINS_SENSITIVE_DATA", status: 400 });
  });
});

describe("createAgentMemoryEntry — bounded limits", () => {
  it("rejects a value longer than the policy's maxEntryCharacters", async () => {
    const ctx = makeCtx();
    const agent = await makeEnabledAgent(ctx, { maxEntryCharacters: 10 });
    await expect(
      createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "USER", key: "k", value: "this value is way too long" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a new entry once maxEntries is reached", async () => {
    const ctx = makeCtx();
    const agent = await makeEnabledAgent(ctx, { maxEntries: 1 });
    await createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "USER", key: "k1", value: "first" });
    await expect(
      createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "USER", key: "k2", value: "second" }),
    ).rejects.toMatchObject({ code: "MEMORY_LIMIT_EXCEEDED", status: 409 });
  });
});

describe("delete / clear memory", () => {
  it("deletes a single entry", async () => {
    const ctx = makeCtx();
    const agent = await makeEnabledAgent(ctx);
    const entry = await createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "USER", key: "k", value: "v" });
    await deleteAgentMemoryEntry(ctx, agent.agentId, entry.memoryId);
    const remaining = await listAgentMemoryEntries(ctx, agent.agentId);
    expect(remaining).toHaveLength(0);
  });

  it("clears all entries for an agent (admin action)", async () => {
    const ctx = makeCtx();
    const agent = await makeEnabledAgent(ctx);
    await createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "USER", key: "k1", value: "v1" });
    await createAgentMemoryEntry(ctx, { agentId: agent.agentId, memoryType: "AGENT", key: "k2", value: "v2" });
    const result = await clearAgentMemory(ctx, agent.agentId);
    expect(result.count).toBe(2);
    const remaining = await listAgentMemoryEntries(ctx, agent.agentId);
    expect(remaining).toHaveLength(0);
  });

  it("clearAgentMemory requires admin permission", async () => {
    const ctx = makeCtx({ role: "DEVELOPER" });
    const agent = await makeEnabledAgent(makeCtx({ role: "OWNER" }));
    await expect(clearAgentMemory(ctx, agent.agentId)).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("cross-workspace/organization isolation", () => {
  it("an org cannot read another org's memory entries", async () => {
    const ctxA = makeCtx({ organizationId: "org_a" });
    const ctxB = makeCtx({ organizationId: "org_b", user: { id: "user_b", email: "b@example.com" } as AgentContext["user"] });
    const agentA = await makeEnabledAgent(ctxA);

    await expect(listAgentMemoryEntries(ctxB, agentA.agentId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("an org cannot delete another org's memory entry", async () => {
    const ctxA = makeCtx({ organizationId: "org_a" });
    const ctxB = makeCtx({ organizationId: "org_b", user: { id: "user_b", email: "b@example.com" } as AgentContext["user"] });
    const agentA = await makeEnabledAgent(ctxA);
    const entry = await createAgentMemoryEntry(ctxA, { agentId: agentA.agentId, memoryType: "USER", key: "k", value: "v" });

    await expect(deleteAgentMemoryEntry(ctxB, agentA.agentId, entry.memoryId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
