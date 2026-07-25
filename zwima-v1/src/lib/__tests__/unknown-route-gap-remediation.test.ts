import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(async () => [{ ok: 1 }]),
  },
}));

vi.mock("@/lib/admin", () => ({
  requireAdmin: vi.fn(async () => {
    throw new Error("Forbidden");
  }),
}));

import { GET as getHealth } from "@/app/api/health/route";
import { GET as getLive } from "@/app/api/health/live/route";
import { GET as getReady } from "@/app/api/health/ready/route";
import { GET as getInternalLatency } from "@/app/api/internal/model-availability/latency/route";
import { isPublicRouteMatchers } from "@/lib/__tests__/middleware-public-helpers";

describe("ops health routes — read-only / fail-closed", () => {
  beforeEach(() => {
    delete process.env.LIVE_PROVIDER_CALLS_ENABLED;
    process.env.VERCEL_ENV = "preview";
  });

  it("GET /api/health/live returns healthy without provider calls", async () => {
    const res = await getLive();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.check).toBe("live");
  });

  it("GET /api/health/ready is read-only and does not claim live providers online", async () => {
    const res = await getReady();
    expect([200, 503]).toContain(res.status);
    const body = await res.json();
    expect(body.check).toBe("ready");
    expect(body.liveProviderCallsEnabled).toBe(false);
    expect(String(body.liveProviderFlagDisplay)).toContain("LIVE_PROVIDER_CALLS_ENABLED");
  });

  it("GET /api/health returns Production-shaped composite", async () => {
    const res = await getHealth();
    expect([200, 503]).toContain(res.status);
    const body = await res.json();
    expect(body.live?.status).toBeTruthy();
    expect(body.ready?.status).toBeTruthy();
    expect(body.ready?.liveProviderFlagDisplay).toBeTruthy();
  });
});

describe("internal model routes — auth required", () => {
  it("rejects unauthenticated internal model route", async () => {
    const res = await getInternalLatency(new Request("http://localhost/api/internal/model-availability/latency"));
    expect([401, 403]).toContain(res.status);
  });

  it("allows SERVICE_ROLE header", async () => {
    process.env.SERVICE_ROLE_API_KEY = "test-service-role";
    const res = await getInternalLatency(
      new Request("http://localhost/api/internal/model-availability/latency", {
        headers: { "x-service-role-key": "test-service-role" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    delete process.env.SERVICE_ROLE_API_KEY;
  });
});

describe("middleware public legal/health matchers", () => {
  it("treats legal and health paths as public", () => {
    for (const path of [
      "/privacy",
      "/terms",
      "/cookies",
      "/imprint",
      "/impressum",
      "/legal/dpa",
      "/legal/sub-processors",
      "/api/health",
      "/api/health/live",
      "/api/health/ready",
      "/forgot-password",
      "/login",
    ]) {
      expect(isPublicRouteMatchers(path)).toBe(true);
    }
  });

  it("keeps dashboard/admin protected", () => {
    expect(isPublicRouteMatchers("/dashboard")).toBe(false);
    expect(isPublicRouteMatchers("/dashboard/admin")).toBe(false);
  });
});
