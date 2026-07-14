import { getCurrentDbUser } from "../auth";
import { ensureDefaultOrganization } from "../api-keys/governance";
import { prisma } from "../prisma";
import { ApiError } from "../api-errors";
import type { OrgRole, Organization, User } from "@prisma/client";

export type WorkspaceContext = {
  user: User;
  organizationId: string;
  organization: Organization;
  role: OrgRole;
};

export async function resolveOrganizationForUser(userId: string, email: string): Promise<{
  organizationId: string;
  organization: Organization;
  role: OrgRole;
}> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, accepted: true },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (membership) {
    return {
      organizationId: membership.organizationId,
      organization: membership.organization,
      role: membership.role,
    };
  }

  const orgId = await ensureDefaultOrganization(userId, email);
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  return { organizationId: orgId, organization, role: "OWNER" };
}

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const user = await getCurrentDbUser();
  if (!user) return null;
  const { organizationId, organization, role } = await resolveOrganizationForUser(user.id, user.email);
  return { user, organizationId, organization, role };
}

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext();
  if (!ctx) throw new ApiError("UNAUTHORIZED", "Authentication required.", 401);
  return ctx;
}

export async function assertOrgResource(
  ctx: WorkspaceContext,
  resourceOrgId: string | null | undefined
): Promise<void> {
  if (!resourceOrgId || resourceOrgId !== ctx.organizationId) {
    throw new ApiError("FORBIDDEN", "Cross-organization access denied.", 403);
  }
}
