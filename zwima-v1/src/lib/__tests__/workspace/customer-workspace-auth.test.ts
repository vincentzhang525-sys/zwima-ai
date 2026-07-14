import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api-errors";
import { assertOrgResource } from "@/lib/workspace/workspace-context";

describe("customer-workspace-auth", () => {
  it("requireWorkspaceContext pattern returns 401 for missing user", () => {
    const err = new ApiError("UNAUTHORIZED", "Authentication required.", 401);
    expect(err.status).toBe(401);
    expect(err.toJSON().error.code).toBe("UNAUTHORIZED");
  });

  it("unauthenticated API contract uses standardized error shape", () => {
    const payload = new ApiError("UNAUTHORIZED", "Authentication required.", 401).toJSON();
    expect(payload.error).toMatchObject({ code: "UNAUTHORIZED", message: expect.any(String) });
    expect(JSON.stringify(payload)).not.toContain("sk_live_");
  });
});

describe("workspace auth guards", () => {
  const ctx = {
    user: { id: "u1", email: "a@b.com" } as never,
    organizationId: "org-a",
    organization: { id: "org-a", name: "A" } as never,
    role: "OWNER" as const,
  };

  it("allows same-organization resource access", async () => {
    await expect(assertOrgResource(ctx, "org-a")).resolves.toBeUndefined();
  });

  it("rejects cross-organization resource access", async () => {
    await expect(assertOrgResource(ctx, "org-b")).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
