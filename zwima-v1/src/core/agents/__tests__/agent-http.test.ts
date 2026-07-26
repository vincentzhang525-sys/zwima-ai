import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agents/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/auth")>("@/lib/agents/auth");
  return { ...actual, requireAgentContext: vi.fn() };
});

import { ApiError } from "@/lib/api-errors";
import { requireAgentContext, type AgentContext } from "@/lib/agents/auth";
import { GET as getAgents, POST as postAgents } from "@/app/api/v1/agents/route";
import { GET as getAgentRun } from "@/app/api/v1/agent-runs/[runId]/route";
import { POST as cancelAgentRun } from "@/app/api/v1/agent-runs/[runId]/cancel/route";

const fakeCtx: AgentContext = {
  user: { id: "user_1", email: "u@example.com" } as AgentContext["user"],
  organizationId: "org_1",
  organization: { id: "org_1" } as AgentContext["organization"],
  role: "OWNER",
  platformAdmin: false,
};

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("agent routes — auth guard", () => {
  beforeEach(() => {
    vi.mocked(requireAgentContext).mockReset();
  });

  it("GET /api/v1/agents is blocked when unauthenticated", async () => {
    vi.mocked(requireAgentContext).mockRejectedValue(new ApiError("UNAUTHORIZED", "Authentication required.", 401));
    const res = await getAgents(new Request("http://localhost/api/v1/agents"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("GET /api/v1/agent-runs/[runId] is blocked when unauthenticated", async () => {
    vi.mocked(requireAgentContext).mockRejectedValue(new ApiError("UNAUTHORIZED", "Authentication required.", 401));
    const res = await getAgentRun(new Request("http://localhost/api/v1/agent-runs/run_x"), {
      params: Promise.resolve({ runId: "run_x" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/agent-runs/[runId]/cancel is blocked when unauthenticated", async () => {
    vi.mocked(requireAgentContext).mockRejectedValue(new ApiError("UNAUTHORIZED", "Authentication required.", 401));
    const res = await cancelAgentRun(jsonRequest("http://localhost/api/v1/agent-runs/run_x/cancel", {}), {
      params: Promise.resolve({ runId: "run_x" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/agents — invalid payload rejected (zod)", () => {
  beforeEach(() => {
    vi.mocked(requireAgentContext).mockReset();
    vi.mocked(requireAgentContext).mockResolvedValue(fakeCtx);
  });

  it("rejects an empty body", async () => {
    const res = await postAgents(jsonRequest("http://localhost/api/v1/agents", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("rejects a body missing systemPrompt", async () => {
    const res = await postAgents(jsonRequest("http://localhost/api/v1/agents", { name: "No Prompt" }));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized temperature", async () => {
    const res = await postAgents(
      jsonRequest("http://localhost/api/v1/agents", { name: "x", systemPrompt: "p", temperature: 99 }),
    );
    expect(res.status).toBe(400);
  });
});
