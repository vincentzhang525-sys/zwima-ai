import type { OrgRole } from "@prisma/client";

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
