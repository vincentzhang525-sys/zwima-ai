import type { AgentLifecycleStatus, AgentRunStatus } from "@/lib/agents/types";

export type AgentApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown; retryable?: boolean } | null;
  meta?: { requestId?: string; timestamp?: string };
};

async function request<T>(url: string, init?: RequestInit): Promise<AgentApiResponse<T>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json().catch(() => null)) as AgentApiResponse<T> | null;
  if (!json) {
    return {
      success: false,
      data: null,
      error: { code: "HTTP_ERROR", message: `HTTP ${res.status}` },
    };
  }
  return json;
}

export const agentsClient = {
  listAgents: (signal?: AbortSignal) => request<unknown[]>("/api/v1/agents", { signal }),
  createAgent: (body: Record<string, unknown>) =>
    request("/api/v1/agents", { method: "POST", body: JSON.stringify(body) }),
  getAgent: (id: string, signal?: AbortSignal) => request(`/api/v1/agents/${id}`, { signal }),
  updateAgent: (id: string, body: Record<string, unknown>) =>
    request(`/api/v1/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveAgent: (id: string) => request(`/api/v1/agents/${id}`, { method: "DELETE" }),
  publishAgent: (id: string, versionId: string) =>
    request(`/api/v1/agents/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ versionId }),
    }),
  createRun: (id: string, body: Record<string, unknown>, idempotencyKey?: string) =>
    request(`/api/v1/agents/${id}/runs`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
  listRuns: (qs = "", signal?: AbortSignal) => request(`/api/v1/agent-runs${qs}`, { signal }),
  getRun: (id: string, signal?: AbortSignal) => request(`/api/v1/agent-runs/${id}`, { signal }),
  cancelRun: (id: string) => request(`/api/v1/agent-runs/${id}/cancel`, { method: "POST", body: "{}" }),
  retryRun: (id: string) => request(`/api/v1/agent-runs/${id}/retry`, { method: "POST", body: "{}" }),
  executeRun: (id: string) => request(`/api/v1/agent-runs/${id}/execute`, { method: "POST", body: "{}" }),
  listTools: (signal?: AbortSignal) => request("/api/v1/tools", { signal }),
  listPrompts: (signal?: AbortSignal) => request("/api/v1/prompts", { signal }),
  createPrompt: (body: Record<string, unknown>) =>
    request("/api/v1/prompts", { method: "POST", body: JSON.stringify(body) }),
  listMemory: (qs = "", signal?: AbortSignal) => request(`/api/v1/agent-memory${qs}`, { signal }),
  deleteMemory: (id: string) => request(`/api/v1/agent-memory/${id}`, { method: "DELETE" }),
  listReviews: (qs = "", signal?: AbortSignal) => request(`/api/v1/agent-reviews${qs}`, { signal }),
  decideReview: (body: Record<string, unknown>) =>
    request("/api/v1/agent-reviews", { method: "POST", body: JSON.stringify(body) }),
  seed: () => request("/api/v1/agents/seed", { method: "POST", body: "{}" }),
  adminMetrics: (signal?: AbortSignal) => request("/api/admin/agent-metrics", { signal }),
  adminPolicies: (signal?: AbortSignal) => request("/api/admin/agent-policies", { signal }),
  upsertPolicy: (body: Record<string, unknown>) =>
    request("/api/admin/agent-policies", { method: "PUT", body: JSON.stringify(body) }),
};

export type { AgentLifecycleStatus, AgentRunStatus };
