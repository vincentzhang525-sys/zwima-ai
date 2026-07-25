import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/live-provider-gate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/providers/live-provider-gate")>(
    "@/lib/providers/live-provider-gate",
  );
  return {
    ...actual,
    isLiveProviderHttpAllowed: vi.fn(),
  };
});

import { isLiveProviderHttpAllowed, PROVIDER_LIVE_CALLS_DISABLED } from "@/lib/providers/live-provider-gate";
import { GET } from "@/app/api/v1/providers/route";
import { clearProviderRegistry } from "@/core/providers/registry";
import { resetCoreGateway } from "@/core/api/gateway";

describe("GET /api/v1/providers — Production contract + fail-closed", () => {
  beforeEach(() => {
    resetCoreGateway();
    clearProviderRegistry();
    vi.mocked(isLiveProviderHttpAllowed).mockReset();
  });

  it("returns HTTP 200 contract with blocked health when Live Provider is fail-closed", async () => {
    vi.mocked(isLiveProviderHttpAllowed).mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.providers)).toBe(true);
    expect(body.providers.length).toBeGreaterThanOrEqual(5);
    for (const p of body.providers) {
      expect(p).toMatchObject({
        id: expect.any(String),
        displayName: expect.any(String),
        status: "OFFLINE",
        priority: expect.any(Number),
        region: expect.any(String),
        euAvailable: expect.any(Boolean),
        supportedFeatures: expect.any(Array),
        defaultModels: expect.any(Array),
        adapterRegistered: true,
      });
      expect(p.health).toMatchObject({
        online: false,
        status: "OFFLINE",
        message: PROVIDER_LIVE_CALLS_DISABLED,
      });
      expect(p.health.online).not.toBe(true);
    }
  });

  it("returns Production-shaped providers list when Live Provider is allowed", async () => {
    vi.mocked(isLiveProviderHttpAllowed).mockReturnValue(true);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.providers)).toBe(true);
    expect(body.providers.length).toBeGreaterThanOrEqual(5);
    for (const p of body.providers) {
      expect(p.id).toBeTruthy();
      expect(p.displayName).toBeTruthy();
      expect(typeof p.adapterRegistered).toBe("boolean");
      expect(p.health ?? p).toBeTruthy();
    }
  });
});
