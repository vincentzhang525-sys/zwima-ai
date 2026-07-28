import { describe, expect, it } from "vitest";
import {
  assertClerkInstanceIsolated,
  classifyClerkInstance,
  classifyClerkKey,
  clerkInstanceDiagnostic,
  clerkInstanceIsolationViolation,
  ClerkInstanceMismatchError,
  CLERK_INSTANCE_MISMATCH,
  isClerkInstanceIsolated,
} from "@/lib/auth/clerk-instance-gate";

describe("clerk-instance-gate", () => {
  it("classifies publishable and secret prefixes", () => {
    expect(classifyClerkKey("pk_live_abc", "publishable")).toBe("live");
    expect(classifyClerkKey("pk_test_abc", "publishable")).toBe("test");
    expect(classifyClerkKey("pk_placeholder_x", "publishable")).toBe("placeholder");
    expect(classifyClerkKey("", "publishable")).toBe("missing");
    expect(classifyClerkKey("sk_live_abc", "secret")).toBe("live");
    expect(classifyClerkKey("sk_test_abc", "secret")).toBe("test");
    expect(classifyClerkKey("not-a-key", "secret")).toBe("invalid");
  });

  it("classifies matching live pair as production instance", () => {
    const c = classifyClerkInstance({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
      CLERK_SECRET_KEY: "sk_live_y",
    });
    expect(c.instanceType).toBe("production");
    expect(c.configured).toBe(true);
  });

  it("classifies matching test pair as development instance", () => {
    const c = classifyClerkInstance({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x",
      CLERK_SECRET_KEY: "sk_test_y",
    });
    expect(c.instanceType).toBe("development");
  });

  it("detects mixed live/test pair as mismatch", () => {
    const c = classifyClerkInstance({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
      CLERK_SECRET_KEY: "sk_test_y",
    });
    expect(c.instanceType).toBe("mismatch");
  });

  it("production requires live Clerk and rejects development keys", () => {
    expect(
      clerkInstanceIsolationViolation({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x",
        CLERK_SECRET_KEY: "sk_test_y",
      }),
    ).toBe("production_must_not_use_development_clerk");

    expect(
      isClerkInstanceIsolated({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
        CLERK_SECRET_KEY: "sk_live_y",
      }),
    ).toBe(true);
  });

  it("production rejects placeholder Clerk", () => {
    expect(
      clerkInstanceIsolationViolation({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_placeholder",
        CLERK_SECRET_KEY: "sk_live_placeholder",
      }),
    ).toBe("production_requires_live_clerk_not_placeholder");
  });

  it("preview requires development Clerk and rejects production keys", () => {
    expect(
      clerkInstanceIsolationViolation({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
        CLERK_SECRET_KEY: "sk_live_y",
      }),
    ).toBe("preview_must_not_use_production_clerk");

    expect(
      isClerkInstanceIsolated({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x",
        CLERK_SECRET_KEY: "sk_test_y",
      }),
    ).toBe(true);
  });

  it("assert throws CLERK_INSTANCE_MISMATCH with stable code", () => {
    expect(() =>
      assertClerkInstanceIsolated({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x",
        CLERK_SECRET_KEY: "sk_test_y",
      }),
    ).toThrow(ClerkInstanceMismatchError);

    try {
      assertClerkInstanceIsolated({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
        CLERK_SECRET_KEY: "sk_live_y",
      });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ClerkInstanceMismatchError);
      expect((e as ClerkInstanceMismatchError).code).toBe(CLERK_INSTANCE_MISMATCH);
      expect((e as Error).message).toContain("preview_must_not_use_production_clerk");
    }
  });

  it("diagnostic payload never includes key bodies", () => {
    const diag = clerkInstanceDiagnostic({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_SECRET_BODY_SHOULD_NOT_LEAK",
      CLERK_SECRET_KEY: "sk_test_SECRET_BODY_SHOULD_NOT_LEAK",
    });
    const json = JSON.stringify(diag);
    expect(json).not.toMatch(/SECRET_BODY/);
    expect(json).not.toMatch(/pk_test_/);
    expect(json).not.toMatch(/sk_test_/);
    expect(diag.clerkInstanceType).toBe("development");
    expect(diag.isolated).toBe(true);
    expect(diag.publishableKind).toBe("test");
    expect(diag.secretKind).toBe("test");
  });
});
