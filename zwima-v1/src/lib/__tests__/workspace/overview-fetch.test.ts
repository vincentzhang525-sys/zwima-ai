import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWorkspaceOverviewCache,
  fetchWorkspaceOverview,
} from "@/lib/workspace/overview-fetch";

describe("fetchWorkspaceOverview", () => {
  beforeEach(() => {
    clearWorkspaceOverviewCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearWorkspaceOverviewCache();
  });

  it("returns structured 401 error instead of null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }),
      }),
    );

    const result = await fetchWorkspaceOverview();
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.errorCode).toBe("UNAUTHORIZED");
    expect(result.message).toContain("Authentication required");
  });

  it("force retry bypasses cache and aborts prior inflight request", async () => {
    let resolveFirst: ((value: Response) => void) | undefined;
    const first = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() => first)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ organization: { name: "Acme" }, creditBalance: 1000 }),
        }),
    );

    const pending = fetchWorkspaceOverview();
    const forced = fetchWorkspaceOverview({ force: true });

    resolveFirst?.({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: "INTERNAL", message: "Server error" } }),
    } as Response);

    const [firstResult, forcedResult] = await Promise.all([pending, forced]);
    expect(firstResult.ok).toBe(false);
    expect(forcedResult.ok).toBe(true);
    expect(forcedResult.data?.organization).toEqual({ name: "Acme" });
  });

  it("returns timeout error when request aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const result = await fetchWorkspaceOverview({ timeoutMs: 20 });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("TIMEOUT");
    expect(result.message).toContain("timed out");
  });
});
