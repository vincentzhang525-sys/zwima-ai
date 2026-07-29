import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMember: { findFirst: vi.fn() },
    organization: { findUniqueOrThrow: vi.fn() },
  },
}));

vi.mock("@/lib/agents/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/auth")>("@/lib/agents/auth");
  return { ...actual, requireAgentContext: vi.fn() };
});

const findUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agents/types", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/types")>("@/lib/agents/types");
  return {
    ...actual,
    getAgentDb: () => ({
      agentDefinition: { findUnique },
    }),
  };
});

import { ApiError } from "@/lib/api-errors";
import { requireAgentContext, type AgentContext } from "@/lib/agents/auth";
import { clearRuntimeIdempotencyStoreForTests } from "@/core/agents/runtime";
import { POST as postGap020Run } from "@/app/api/agents/[agentId]/runs/route";

const fakeCtx: AgentContext = {
  user: { id: "user_1", email: "u@example.com" } as AgentContext["user"],
  organizationId: "org_1",
  organization: { id: "org_1" } as AgentContext["organization"],
  role: "OWNER",
  platformAdmin: false,
};

const viewerCtx: AgentContext = {
  ...fakeCtx,
  role: "VIEWER",
};

function jsonRequest(url: string, body: unknown, headers?: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

describe("GAP-020 POST /api/agents/[agentId]/runs", () => {
  beforeEach(() => {
    clearRuntimeIdempotencyStoreForTests();
    vi.mocked(requireAgentContext).mockReset();
    findUnique.mockReset();
  });

  it("rejects unauthenticated access", async () => {
    vi.mocked(requireAgentContext).mockRejectedValue(
      new ApiError("UNAUTHORIZED", "Authentication required.", 401),
    );
    const res = await postGap020Run(
      jsonRequest("http://localhost/api/agents/agent_1/runs", { executionMode: "MOCK" }),
      { params: Promise.resolve({ agentId: "agent_1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects VIEWER without edit permission", async () => {
    vi.mocked(requireAgentContext).mockResolvedValue(viewerCtx);
    const res = await postGap020Run(
      jsonRequest("http://localhost/api/agents/agent_1/runs", { executionMode: "MOCK" }),
      { params: Promise.resolve({ agentId: "agent_1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when agent does not exist", async () => {
    vi.mocked(requireAgentContext).mockResolvedValue(fakeCtx);
    findUnique.mockResolvedValue(null);
    const res = await postGap020Run(
      jsonRequest("http://localhost/api/agents/missing/runs", {
        executionMode: "MOCK",
        input: { message: "x" },
      }),
      { params: Promise.resolve({ agentId: "missing" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when agent belongs to another org", async () => {
    vi.mocked(requireAgentContext).mockResolvedValue(fakeCtx);
    findUnique.mockResolvedValue({
      agentId: "agent_x",
      organizationId: "org_other",
      workspaceId: null,
      status: "ACTIVE",
    });
    const res = await postGap020Run(
      jsonRequest("http://localhost/api/agents/agent_x/runs", { executionMode: "MOCK" }),
      { params: Promise.resolve({ agentId: "agent_x" }) },
    );
    expect(res.status).toBe(403);
  });

  it("rejects LIVE_PROVIDER at validation (400)", async () => {
    vi.mocked(requireAgentContext).mockResolvedValue(fakeCtx);
    findUnique.mockResolvedValue({
      agentId: "agent_1",
      organizationId: "org_1",
      workspaceId: null,
      status: "ACTIVE",
    });
    const res = await postGap020Run(
      jsonRequest("http://localhost/api/agents/agent_1/runs", {
        executionMode: "LIVE_PROVIDER",
        input: { message: "nope" },
      }),
      { params: Promise.resolve({ agentId: "agent_1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("MOCK success returns 201 with side-effect flags false", async () => {
    vi.mocked(requireAgentContext).mockResolvedValue(fakeCtx);
    findUnique.mockResolvedValue({
      agentId: "agent_1",
      organizationId: "org_1",
      workspaceId: "ws_1",
      status: "ACTIVE",
    });
    const res = await postGap020Run(
      jsonRequest(
        "http://localhost/api/agents/agent_1/runs",
        {
          executionMode: "MOCK",
          input: { message: "hello" },
          scenario: "success",
          workspaceId: "ws_1",
        },
        { "Idempotency-Key": "api-idem-1" },
      ),
      { params: Promise.resolve({ agentId: "agent_1" }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("COMPLETED");
    expect(body.data.providerCallExecuted).toBe(false);
    expect(body.data.paymentCreated).toBe(false);
    expect(body.data.emailSent).toBe(false);
    expect(body.data.externalSideEffectExecuted).toBe(false);
  });

  it("idempotent replay does not change result", async () => {
    vi.mocked(requireAgentContext).mockResolvedValue(fakeCtx);
    findUnique.mockResolvedValue({
      agentId: "agent_1",
      organizationId: "org_1",
      workspaceId: null,
      status: "ACTIVE",
    });
    const reqBody = {
      executionMode: "PREVIEW_SAFE",
      input: { message: "once" },
      scenario: "success",
      idempotencyKey: "api-idem-2",
    };
    const res1 = await postGap020Run(
      jsonRequest("http://localhost/api/agents/agent_1/runs", reqBody),
      { params: Promise.resolve({ agentId: "agent_1" }) },
    );
    const res2 = await postGap020Run(
      jsonRequest("http://localhost/api/agents/agent_1/runs", {
        ...reqBody,
        scenario: "fail",
      }),
      { params: Promise.resolve({ agentId: "agent_1" }) },
    );
    const b1 = await res1.json();
    const b2 = await res2.json();
    expect(b1.data.runId).toBe(b2.data.runId);
    expect(b2.data.status).toBe("COMPLETED");
  });

  it("MOCK fail returns non-2xx with explicit error", async () => {
    vi.mocked(requireAgentContext).mockResolvedValue(fakeCtx);
    findUnique.mockResolvedValue({
      agentId: "agent_1",
      organizationId: "org_1",
      workspaceId: null,
      status: "ACTIVE",
    });
    const res = await postGap020Run(
      jsonRequest("http://localhost/api/agents/agent_1/runs", {
        executionMode: "MOCK",
        scenario: "fail",
        idempotencyKey: "fail-1",
      }),
      { params: Promise.resolve({ agentId: "agent_1" }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.data.status).toBe("FAILED");
  });

  it("workspace mismatch is forbidden", async () => {
    vi.mocked(requireAgentContext).mockResolvedValue(fakeCtx);
    findUnique.mockResolvedValue({
      agentId: "agent_1",
      organizationId: "org_1",
      workspaceId: "ws_A",
      status: "ACTIVE",
    });
    const res = await postGap020Run(
      jsonRequest("http://localhost/api/agents/agent_1/runs", {
        executionMode: "MOCK",
        workspaceId: "ws_B",
      }),
      { params: Promise.resolve({ agentId: "agent_1" }) },
    );
    expect(res.status).toBe(403);
  });
});
