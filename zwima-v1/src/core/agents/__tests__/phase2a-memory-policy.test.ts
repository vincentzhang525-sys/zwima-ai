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
import { getAgentMemoryPolicy, upsertAgentMemoryPolicy } from "../memory-policy-service";
import {
  MAX_MEMORY_POLICY_ENTRIES_CLAMP,
  MAX_MEMORY_POLICY_ENTRY_CHARS_CLAMP,
  MAX_MEMORY_POLICY_RETENTION_DAYS_CLAMP,
} from "../agent-safety";

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
  fakeDb.agentMemoryPolicy._rows.length = 0;
});

describe("getAgentMemoryPolicy — default disabled", () => {
  it("defaults to memoryEnabled=false when no policy row exists", async () => {
    const ctx = makeCtx();
    const { agent } = await createAgent(ctx, { name: "Agent", systemPrompt: "p" });
    const policy = await getAgentMemoryPolicy(ctx, agent.agentId);
    expect(policy.memoryEnabled).toBe(false);
    expect(policy.allowUserMemory).toBe(false);
    expect(policy.allowWorkspaceMemory).toBe(false);
  });

  it("throws NOT_FOUND for an agent in a different organization", async () => {
    const ctxA = makeCtx({ organizationId: "org_a" });
    const ctxB = makeCtx({ organizationId: "org_b", user: { id: "user_b", email: "b@example.com" } as AgentContext["user"] });
    const { agent } = await createAgent(ctxA, { name: "Agent", systemPrompt: "p" });
    await expect(getAgentMemoryPolicy(ctxB, agent.agentId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("upsertAgentMemoryPolicy — admin-only, clamped limits", () => {
  it("rejects a DEVELOPER (non-admin org role) from changing the policy", async () => {
    const ctx = makeCtx({ role: "DEVELOPER" });
    const { agent } = await createAgent(ctx, { name: "Agent", systemPrompt: "p" });
    await expect(upsertAgentMemoryPolicy(ctx, agent.agentId, { memoryEnabled: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("allows OWNER/ADMIN to enable memory", async () => {
    const ctx = makeCtx({ role: "OWNER" });
    const { agent } = await createAgent(ctx, { name: "Agent", systemPrompt: "p" });
    const policy = await upsertAgentMemoryPolicy(ctx, agent.agentId, { memoryEnabled: true, allowUserMemory: true });
    expect(policy.memoryEnabled).toBe(true);
    expect(policy.allowUserMemory).toBe(true);

    const refetched = await getAgentMemoryPolicy(ctx, agent.agentId);
    expect(refetched.memoryEnabled).toBe(true);
  });

  it("clamps maxEntries/maxEntryCharacters/retentionDays to the hard ceilings", async () => {
    const ctx = makeCtx({ role: "OWNER" });
    const { agent } = await createAgent(ctx, { name: "Agent", systemPrompt: "p" });
    const policy = await upsertAgentMemoryPolicy(ctx, agent.agentId, {
      maxEntries: 999_999,
      maxEntryCharacters: 999_999,
      retentionDays: 999_999,
    });
    expect(policy.maxEntries).toBeLessThanOrEqual(MAX_MEMORY_POLICY_ENTRIES_CLAMP);
    expect(policy.maxEntryCharacters).toBeLessThanOrEqual(MAX_MEMORY_POLICY_ENTRY_CHARS_CLAMP);
    expect(policy.retentionDays).toBeLessThanOrEqual(MAX_MEMORY_POLICY_RETENTION_DAYS_CLAMP);
  });
});
