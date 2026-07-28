import { createHash } from "node:crypto";
import type { OrgRole, Organization, OrganizationMember, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ResolveAuthenticatedPrismaUserInput = {
  clerkUserId?: string | null;
  email?: string | null;
  /** Existing internal Prisma user id mapping, if already known. */
  internalUserId?: string | null;
};

/**
 * Resolve the authenticated Prisma User from Clerk identity.
 * Priority: clerkId → verified/primary email → internal userId.
 * Never treats Clerk userId as Organization.ownerId.
 */
export async function resolveAuthenticatedPrismaUser(
  input: ResolveAuthenticatedPrismaUserInput,
): Promise<User | null> {
  const clerkUserId = String(input.clerkUserId ?? "").trim();
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase();
  const internalUserId = String(input.internalUserId ?? "").trim();

  if (clerkUserId) {
    const byClerk = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    if (byClerk) return byClerk;
  }

  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      if (clerkUserId && byEmail.clerkId !== clerkUserId && byEmail.clerkId.startsWith("pending_invite_")) {
        return prisma.user.update({
          where: { id: byEmail.id },
          data: { clerkId: clerkUserId },
        });
      }
      return byEmail;
    }
  }

  if (internalUserId) {
    return prisma.user.findUnique({ where: { id: internalUserId } });
  }

  return null;
}

const INVITE_ADMIN_ROLES: OrgRole[] = ["OWNER", "ADMIN"];

export type TeamInviteErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "ORG_NOT_FOUND"
  | "MEMBER_ALREADY_EXISTS";

export class TeamInviteError extends Error {
  code: TeamInviteErrorCode;
  status: number;

  constructor(code: TeamInviteErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type InviteTeamMemberInput = {
  actor: User;
  email: string;
  role?: OrgRole | string;
  /** Optional explicit org; otherwise resolves actor's admin-capable org. */
  organizationId?: string;
};

export type InviteTeamMemberResult = {
  member: OrganizationMember & { user?: { email: string | null } | null };
  alreadyMember: boolean;
  organizationId: string;
};

function normalizeInviteEmail(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

function normalizeInviteRole(raw: unknown): OrgRole {
  const role = String(raw || "DEVELOPER").toUpperCase() as OrgRole;
  const allowed: OrgRole[] = ["OWNER", "ADMIN", "BILLING", "DEVELOPER", "VIEWER"];
  if (!allowed.includes(role)) return "DEVELOPER";
  // Invitees must not be granted OWNER via invite API.
  if (role === "OWNER") return "ADMIN";
  return role;
}

function pendingClerkIdForEmail(email: string): string {
  const hash = createHash("sha256").update(email).digest("hex").slice(0, 24);
  return `pending_invite_${hash}`;
}

async function assertInviteCapability(
  actorId: string,
  organization: Organization,
): Promise<{ organization: Organization; role: OrgRole } | null> {
  if (organization.ownerId === actorId) {
    return { organization, role: "OWNER" };
  }
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: organization.id,
      userId: actorId,
      accepted: true,
      role: { in: INVITE_ADMIN_ROLES },
    },
  });
  if (!membership) return null;
  return { organization, role: membership.role };
}

/**
 * Resolve an organization the actor may invite into.
 * Uses workspace-aligned org selection (membership first), then requires
 * Organization.ownerId === actor.id OR OWNER/ADMIN membership — never Clerk ids.
 */
export async function resolveInviteCapableOrganization(
  actorId: string,
  organizationId?: string,
): Promise<{ organization: Organization; role: OrgRole } | null> {
  if (organizationId) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return null;
    return assertInviteCapability(actorId, org);
  }

  // Prefer the actor's primary accepted membership (same ordering as workspace-context).
  const primaryMembership = await prisma.organizationMember.findFirst({
    where: { userId: actorId, accepted: true },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (primaryMembership) {
    return assertInviteCapability(actorId, primaryMembership.organization);
  }

  const owned = await prisma.organization.findFirst({
    where: { ownerId: actorId },
    orderBy: { createdAt: "asc" },
  });
  if (!owned) return null;
  return assertInviteCapability(actorId, owned);
}

async function findOrCreateInviteeUser(email: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  try {
    return await prisma.user.create({
      data: {
        email,
        clerkId: pendingClerkIdForEmail(email),
        emailVerified: false,
        creditBalance: { create: { credits: 0 } },
      },
    });
  } catch {
    const raced = await prisma.user.findUnique({ where: { email } });
    if (raced) return raced;
    throw new TeamInviteError("VALIDATION_ERROR", "Unable to create invitee user", 400);
  }
}

/**
 * Invite a member into the actor's admin-capable organization.
 * Idempotent for existing membership — returns alreadyMember=true (no 500).
 * Does not send email.
 */
export async function inviteTeamMember(input: InviteTeamMemberInput): Promise<InviteTeamMemberResult> {
  const email = normalizeInviteEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new TeamInviteError("VALIDATION_ERROR", "A valid email is required", 400);
  }

  const resolved = await resolveInviteCapableOrganization(input.actor.id, input.organizationId);
  if (!resolved) {
    // Actor has an org membership but lacks invite permission, or has no org.
    const anyMembership = await prisma.organizationMember.findFirst({
      where: { userId: input.actor.id, accepted: true },
    });
    if (anyMembership) {
      throw new TeamInviteError("FORBIDDEN", "Only organization owners or admins can invite members", 403);
    }
    throw new TeamInviteError("ORG_NOT_FOUND", "No organization found for invite", 404);
  }

  const { organization } = resolved;
  const role = normalizeInviteRole(input.role);
  const invitee = await findOrCreateInviteeUser(email);

  const existing = await prisma.organizationMember.findFirst({
    where: {
      organizationId: organization.id,
      OR: [{ userId: invitee.id }, { invitedEmail: email }],
    },
    include: { user: { select: { email: true } } },
  });

  if (existing) {
    return {
      member: existing,
      alreadyMember: true,
      organizationId: organization.id,
    };
  }

  try {
    const member = await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: invitee.id,
        role,
        invitedEmail: invitee.clerkId.startsWith("pending_invite_") ? email : null,
        accepted: !invitee.clerkId.startsWith("pending_invite_"),
      },
      include: { user: { select: { email: true } } },
    });
    return {
      member,
      alreadyMember: false,
      organizationId: organization.id,
    };
  } catch (err) {
    // Unique constraint race → treat as idempotent success
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code === "P2002") {
      const raced = await prisma.organizationMember.findFirst({
        where: { organizationId: organization.id, userId: invitee.id },
        include: { user: { select: { email: true } } },
      });
      if (raced) {
        return { member: raced, alreadyMember: true, organizationId: organization.id };
      }
      throw new TeamInviteError("MEMBER_ALREADY_EXISTS", "Member already exists in this organization", 409);
    }
    throw err;
  }
}
