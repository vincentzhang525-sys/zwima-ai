import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-errors";
import { assertCanAccess, assertCanManageOrg, canAccess } from "@/lib/rbac";

describe("GAP-012 RBAC fail-closed", () => {
  it("VIEWER can only access usage", () => {
    expect(canAccess("VIEWER", "usage")).toBe(true);
    expect(canAccess("VIEWER", "api_keys")).toBe(false);
    expect(canAccess("VIEWER", "billing")).toBe(false);
    expect(canAccess("VIEWER", "team")).toBe(false);
    expect(canAccess("VIEWER", "playground")).toBe(false);
  });

  it("DEVELOPER (Member) can use api_keys but not manage org", () => {
    expect(canAccess("DEVELOPER", "api_keys")).toBe(true);
    expect(canAccess("DEVELOPER", "usage")).toBe(true);
    expect(() => assertCanManageOrg("DEVELOPER")).toThrow(ApiError);
  });

  it("OWNER can manage org and all resources", () => {
    expect(canAccess("OWNER", "billing")).toBe(true);
    expect(() => assertCanManageOrg("OWNER")).not.toThrow();
    expect(() => assertCanAccess("OWNER", "api_keys")).not.toThrow();
  });

  it("assertCanAccess fails closed for Viewer api_keys", () => {
    try {
      assertCanAccess("VIEWER", "api_keys");
      expect.unreachable("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("FORBIDDEN");
      expect((err as ApiError).status).toBe(403);
    }
  });
});
