import { describe, expect, it } from "vitest";
import {
  assertLiveProviderHttpAllowed,
  isLiveProviderHttpAllowed,
  LiveProviderCallsDisabledError,
  PROVIDER_LIVE_CALLS_DISABLED,
} from "@/lib/providers/live-provider-gate";

describe("live-provider-gate", () => {
  it("blocks when env missing", () => {
    expect(isLiveProviderHttpAllowed({})).toBe(false);
    expect(() => assertLiveProviderHttpAllowed({})).toThrow(LiveProviderCallsDisabledError);
  });

  it("blocks when LIVE_PROVIDER_CALLS_ENABLED=false", () => {
    expect(
      isLiveProviderHttpAllowed({
        VERCEL_ENV: "production",
        LIVE_PROVIDER_CALLS_ENABLED: "false",
      }),
    ).toBe(false);
  });

  it("blocks preview + true", () => {
    expect(
      isLiveProviderHttpAllowed({
        VERCEL_ENV: "preview",
        LIVE_PROVIDER_CALLS_ENABLED: "true",
      }),
    ).toBe(false);
  });

  it("blocks development + true", () => {
    expect(
      isLiveProviderHttpAllowed({
        VERCEL_ENV: "development",
        LIVE_PROVIDER_CALLS_ENABLED: "true",
      }),
    ).toBe(false);
  });

  it("allows production + true (exact)", () => {
    expect(
      isLiveProviderHttpAllowed({
        VERCEL_ENV: "production",
        LIVE_PROVIDER_CALLS_ENABLED: "true",
      }),
    ).toBe(true);
    expect(() =>
      assertLiveProviderHttpAllowed({
        VERCEL_ENV: "production",
        LIVE_PROVIDER_CALLS_ENABLED: "true",
      }),
    ).not.toThrow();
  });

  it("blocks production + TRUE / 1 / yes", () => {
    for (const flag of ["TRUE", "1", "yes", "True", " true "]) {
      expect(
        isLiveProviderHttpAllowed({
          VERCEL_ENV: "production",
          LIVE_PROVIDER_CALLS_ENABLED: flag,
        }),
      ).toBe(false);
    }
  });

  it("error code is PROVIDER_LIVE_CALLS_DISABLED", () => {
    try {
      assertLiveProviderHttpAllowed({ VERCEL_ENV: "preview", LIVE_PROVIDER_CALLS_ENABLED: "true" });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(LiveProviderCallsDisabledError);
      expect((e as LiveProviderCallsDisabledError).code).toBe(PROVIDER_LIVE_CALLS_DISABLED);
    }
  });
});
