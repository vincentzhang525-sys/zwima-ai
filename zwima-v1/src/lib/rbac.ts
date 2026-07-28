import type { OrgRole } from "@prisma/client";
import { ApiError } from "@/lib/api-errors";

const PERMISSIONS: Record<OrgRole, string[]> = {
  OWNER: ["*"],
  ADMIN: ["team", "api_keys", "usage", "billing", "playground"],
  BILLING: ["billing", "invoices", "usage"],
  DEVELOPER: ["api_keys", "usage", "playground"],
  VIEWER: ["usage"],
};

export function canAccess(role: OrgRole, resource: string): boolean {
  const perms = PERMISSIONS[role] ?? [];
  return perms.includes("*") || perms.includes(resource);
}

/** Fail-closed workspace resource gate (GAP-012). */
export function assertCanAccess(role: OrgRole, resource: string): void {
  if (!canAccess(role, resource)) {
    throw new ApiError(
      "FORBIDDEN",
      `Insufficient permission for resource: ${resource}`,
      403,
    );
  }
}

/** Owner/Admin-only org management (settings, destructive team ops). */
export function assertCanManageOrg(role: OrgRole): void {
  if (role !== "OWNER" && role !== "ADMIN") {
    throw new ApiError("FORBIDDEN", "Organization admin permission required.", 403);
  }
}

export function roleLabel(role: OrgRole): string {
  const labels: Record<OrgRole, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    BILLING: "Billing",
    DEVELOPER: "Developer",
    VIEWER: "Viewer",
  };
  return labels[role];
}

export const ORG_ROLES: OrgRole[] = ["OWNER", "ADMIN", "BILLING", "DEVELOPER", "VIEWER"];
