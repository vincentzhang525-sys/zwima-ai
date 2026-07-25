import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/health — read-only", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("never mutates the database across repeated Preview health requests", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("LIVE_PROVIDER_CALLS_ENABLED", "true");

    const updateMany = vi.fn();
    const upsert = vi.fn();
    const create = vi.fn();
    const update = vi.fn();
    const deleteFn = vi.fn();
    const transaction = vi.fn();

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        provider: { updateMany, upsert, create, update, delete: deleteFn },
        $transaction: transaction,
      },
    }));

    const checkAllProvidersHealth = vi.fn(async () => {
      throw new Error("live health must not run in Preview");
    });

    vi.doMock("@/lib/providers/router", () => ({
      checkAllProvidersHealth,
      getAllAdapters: () => [
        { slug: "openai", name: "OpenAI" },
        { slug: "gemini", name: "Gemini" },
      ],
    }));

    const { GET, HEAD } = await import("@/app/api/v1/health/route");

    const first = await GET();
    const second = await GET();
    const head = await HEAD();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(head.status).toBe(200);

    const body1 = await first.json();
    const body2 = await second.json();
    expect(body1).toEqual({ openai: "blocked", gemini: "blocked" });
    expect(body2).toEqual({ openai: "blocked", gemini: "blocked" });

    expect(checkAllProvidersHealth).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("probes providers when live calls are allowed but still never writes", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIVE_PROVIDER_CALLS_ENABLED", "true");

    const updateMany = vi.fn();
    vi.doMock("@/lib/prisma", () => ({
      prisma: { provider: { updateMany } },
    }));

    const checkAllProvidersHealth = vi.fn(async () => ({ openai: "ok" }));
    vi.doMock("@/lib/providers/router", () => ({
      checkAllProvidersHealth,
      getAllAdapters: () => [{ slug: "openai", name: "OpenAI" }],
    }));

    const { GET } = await import("@/app/api/v1/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ openai: "ok" });
    expect(checkAllProvidersHealth).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
