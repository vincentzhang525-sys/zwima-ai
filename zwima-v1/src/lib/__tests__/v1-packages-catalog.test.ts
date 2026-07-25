import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/packages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns packages when the catalog has rows (public / unauthenticated)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_PREVIEW_DISABLED", "");

    vi.doMock("@/lib/stripe", () => ({
      listCreditPackages: vi.fn(async () => [
        { id: "pkg_1", label: "Starter", amountEur: 10, credits: 1000 },
      ]),
    }));

    const { GET } = await import("@/app/api/v1/packages/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stripePreviewDisabled).toBe(false);
    expect(body.packages).toEqual([
      { id: "pkg_1", label: "Starter", amountEur: "10", credits: 1000 },
    ]);
  });

  it("returns HTTP 200 with an empty array when no packages exist", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_PREVIEW_DISABLED", "");

    vi.doMock("@/lib/stripe", () => ({
      listCreditPackages: vi.fn(async () => []),
    }));

    const { GET } = await import("@/app/api/v1/packages/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.packages).toEqual([]);
    expect(body.error).toBeUndefined();
  });

  it("returns sanitized controlled error on database/read failure outside Preview", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_PREVIEW_DISABLED", "");

    vi.doMock("@/lib/stripe", () => ({
      listCreditPackages: vi.fn(async () => {
        throw new Error("postgresql://user:secret@host/db boom sk_test_abc123");
      }),
    }));

    const { GET } = await import("@/app/api/v1/packages/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("PACKAGE_CATALOG_UNAVAILABLE");
    expect(body.packages).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/sk_test_|postgresql:\/\/user:secret/);
  });

  it("Preview read failure returns HTTP 200 empty catalog (not 500)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("STRIPE_PREVIEW_DISABLED", "true");

    vi.doMock("@/lib/stripe", () => ({
      listCreditPackages: vi.fn(async () => {
        throw new Error("relation CreditPackage does not exist");
      }),
    }));

    const { GET } = await import("@/app/api/v1/packages/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stripePreviewDisabled).toBe(true);
    expect(body.packages).toEqual([]);
  });

  it("remains publicly callable without auth (unauthenticated behavior)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("STRIPE_PREVIEW_DISABLED", "true");

    // No auth mock — route must not require one.
    vi.doMock("@/lib/stripe", () => ({
      listCreditPackages: vi.fn(async () => []),
    }));

    const { GET } = await import("@/app/api/v1/packages/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ packages: [], stripePreviewDisabled: true });
  });
});
