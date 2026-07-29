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

  it("returns success with data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ organization: { name: "Acme" }, creditBalance: 42, monthCostEur: 1.5 }),
      }),
    );

    const result = await fetchWorkspaceOverview();
    expect(result.ok).toBe(true);
    expect(result.kind).toBe("success");
    expect(result.data?.organization).toEqual({ name: "Acme" });
    expect(result.requestId).toBeTruthy();
  });

  it("returns structured 401 unauthorized", async () => {
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
    expect(result.kind).toBe("unauthorized");
    expect(result.status).toBe(401);
    expect(result.errorCode).toBe("UNAUTHORIZED");
  });

  it("returns structured 500 server_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: "INTERNAL", message: "boom" } }),
      }),
    );

    const result = await fetchWorkspaceOverview();
    expect(result.ok).toBe(false);
    expect(result.kind).toBe("server_error");
    expect(result.status).toBe(500);
  });

  it("returns network_error on fetch reject", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const result = await fetchWorkspaceOverview();
    expect(result.ok).toBe(false);
    expect(result.kind).toBe("network_error");
  });

  it("hard-timeouts hanging fetch that ignores AbortSignal within budget", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );

    const started = Date.now();
    const result = await fetchWorkspaceOverview({ timeoutMs: 50 });
    const elapsed = Date.now() - started;

    expect(result.ok).toBe(false);
    expect(result.kind).toBe("timeout");
    expect(result.errorCode).toBe("TIMEOUT");
    expect(elapsed).toBeLessThan(500);
  });

  it("force retry creates new request after timeout and settles", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        calls += 1;
        if (calls === 1) return new Promise(() => {});
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ organization: { name: "RetryOrg" }, creditBalance: 9 }),
        });
      }),
    );

    const timedOut = await fetchWorkspaceOverview({ timeoutMs: 40 });
    expect(timedOut.kind).toBe("timeout");

    const retried = await fetchWorkspaceOverview({ force: true, timeoutMs: 200 });
    expect(retried.ok).toBe(true);
    expect(retried.data?.organization).toEqual({ name: "RetryOrg" });
    expect(retried.requestId).not.toBe(timedOut.requestId);
  });

  it("dedupes concurrent requests to a single fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ organization: { name: "Shared" }, creditBalance: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([fetchWorkspaceOverview(), fetchWorkspaceOverview()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.requestId).toBe(b.requestId);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
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
});
