import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgRole, Organization, OrganizationMember, User } from "@prisma/client";

type MemberRow = OrganizationMember & { user?: { email: string | null } | null; organization?: Organization };

const users = new Map<string, User>();
const orgs = new Map<string, Organization>();
const members: MemberRow[] = [];

function reset() {
  users.clear();
  orgs.clear();
  members.length = 0;
}

function makeUser(partial: Partial<User> & Pick<User, "id" | "email" | "clerkId">): User {
  const user = {
    companyName: null,
    country: null,
    vatId: null,
    tier: "STANDARD",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as User;
  users.set(user.id, user);
  return user;
}

function makeOrg(partial: Partial<Organization> & Pick<Organization, "id" | "name" | "ownerId">): Organization {
  const org = {
    defaultRoutingPolicyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as Organization;
  orgs.set(org.id, org);
  return org;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { clerkId?: string; email?: string; id?: string } }) => {
        if (where.clerkId) return [...users.values()].find((u) => u.clerkId === where.clerkId) ?? null;
        if (where.email) return [...users.values()].find((u) => u.email === where.email) ?? null;
        if (where.id) return users.get(where.id) ?? null;
        return null;
      }),
      create: vi.fn(async ({ data }: { data: { email: string; clerkId: string; emailVerified?: boolean } }) => {
        const user = makeUser({
          id: `u_${users.size + 1}`,
          email: data.email,
          clerkId: data.clerkId,
          emailVerified: Boolean(data.emailVerified),
        });
        return user;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
        const user = users.get(where.id);
        if (!user) throw new Error("not found");
        const next = { ...user, ...data } as User;
        users.set(where.id, next);
        return next;
      }),
    },
    organization: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => orgs.get(where.id) ?? null),
      findFirst: vi.fn(async ({ where }: { where: { ownerId?: string } }) => {
        if (where.ownerId) return [...orgs.values()].find((o) => o.ownerId === where.ownerId) ?? null;
        return null;
      }),
    },
    organizationMember: {
      findFirst: vi.fn(
        async ({
          where,
          include,
        }: {
          where: Record<string, unknown>;
          include?: { organization?: boolean; user?: unknown };
        }) => {
          const orgId = where.organizationId as string | undefined;
          const userId = where.userId as string | undefined;
          const accepted = where.accepted as boolean | undefined;
          const roleIn = (where.role as { in?: OrgRole[] } | undefined)?.in;
          const orClause = where.OR as Array<{ userId?: string; invitedEmail?: string }> | undefined;

          let hit = members.find((m) => {
            if (orgId && m.organizationId !== orgId) return false;
            if (userId && m.userId !== userId) return false;
            if (accepted !== undefined && m.accepted !== accepted) return false;
            if (roleIn && !roleIn.includes(m.role)) return false;
            if (orClause) {
              return orClause.some(
                (c) => (c.userId && c.userId === m.userId) || (c.invitedEmail && c.invitedEmail === m.invitedEmail),
              );
            }
            return true;
          });

          // When only userId+role for invite-capable lookup without orgId
          if (!hit && userId && roleIn && !orgId) {
            hit = members.find((m) => m.userId === userId && roleIn.includes(m.role) && (accepted === undefined || m.accepted === accepted));
          }
          if (!hit && userId && accepted !== undefined && !orgId && !roleIn && !orClause) {
            hit = members.find((m) => m.userId === userId && m.accepted === accepted);
          }

          if (!hit) return null;
          if (include?.organization) {
            return { ...hit, organization: orgs.get(hit.organizationId) };
          }
          if (include?.user) {
            const u = users.get(hit.userId);
            return { ...hit, user: u ? { email: u.email } : null };
          }
          return hit;
        },
      ),
      create: vi.fn(
        async ({
          data,
          include,
        }: {
          data: {
            organizationId: string;
            userId: string;
            role: OrgRole;
            invitedEmail?: string | null;
            accepted?: boolean;
          };
          include?: { user?: unknown };
        }) => {
          if (members.some((m) => m.organizationId === data.organizationId && m.userId === data.userId)) {
            const err = Object.assign(new Error("Unique constraint"), { code: "P2002" });
            throw err;
          }
          const row: MemberRow = {
            id: `m_${members.length + 1}`,
            organizationId: data.organizationId,
            userId: data.userId,
            role: data.role,
            invitedEmail: data.invitedEmail ?? null,
            accepted: data.accepted ?? true,
            createdAt: new Date(),
          };
          members.push(row);
          if (include?.user) {
            const u = users.get(row.userId);
            return { ...row, user: u ? { email: u.email } : null };
          }
          return row;
        },
      ),
    },
  },
}));

import {
  inviteTeamMember,
  resolveAuthenticatedPrismaUser,
  resolveInviteCapableOrganization,
  TeamInviteError,
} from "@/lib/team/invite";

beforeEach(() => {
  reset();
  vi.clearAllMocks();
});

describe("resolveAuthenticatedPrismaUser", () => {
  it("resolves by clerkId first", async () => {
    makeUser({ id: "u1", email: "a@example.com", clerkId: "clerk_a" });
    const user = await resolveAuthenticatedPrismaUser({ clerkUserId: "clerk_a", email: "other@example.com" });
    expect(user?.id).toBe("u1");
  });

  it("falls back to email when clerkId misses", async () => {
    makeUser({ id: "u2", email: "b@example.com", clerkId: "clerk_b" });
    const user = await resolveAuthenticatedPrismaUser({ clerkUserId: "missing", email: "b@example.com" });
    expect(user?.id).toBe("u2");
  });

  it("falls back to internal user id", async () => {
    makeUser({ id: "u3", email: "c@example.com", clerkId: "clerk_c" });
    const user = await resolveAuthenticatedPrismaUser({ internalUserId: "u3" });
    expect(user?.id).toBe("u3");
  });
});

describe("inviteTeamMember", () => {
  it("Owner invites a new Member", async () => {
    const owner = makeUser({ id: "owner1", email: "owner@example.com", clerkId: "clerk_owner" });
    makeOrg({ id: "org1", name: "Primary", ownerId: owner.id });
    members.push({
      id: "m_owner",
      organizationId: "org1",
      userId: owner.id,
      role: "OWNER",
      invitedEmail: null,
      accepted: true,
      createdAt: new Date(),
    });

    const result = await inviteTeamMember({
      actor: owner,
      email: "new-member@example.com",
      role: "DEVELOPER",
    });

    expect(result.alreadyMember).toBe(false);
    expect(result.organizationId).toBe("org1");
    expect(result.member.userId).not.toBe(owner.id);
    expect(result.member.role).toBe("DEVELOPER");
  });

  it("Owner re-invites an existing Member idempotently", async () => {
    const owner = makeUser({ id: "owner1", email: "owner@example.com", clerkId: "clerk_owner" });
    const memberUser = makeUser({ id: "member1", email: "member@example.com", clerkId: "clerk_member" });
    makeOrg({ id: "org1", name: "Primary", ownerId: owner.id });
    members.push({
      id: "m_owner",
      organizationId: "org1",
      userId: owner.id,
      role: "OWNER",
      invitedEmail: null,
      accepted: true,
      createdAt: new Date(),
    });
    members.push({
      id: "m_member",
      organizationId: "org1",
      userId: memberUser.id,
      role: "DEVELOPER",
      invitedEmail: null,
      accepted: true,
      createdAt: new Date(),
    });

    const result = await inviteTeamMember({
      actor: owner,
      email: "member@example.com",
      role: "DEVELOPER",
    });

    expect(result.alreadyMember).toBe(true);
    expect(result.member.id).toBe("m_member");
  });

  it("ADMIN membership (not ownerId) can invite", async () => {
    const realOwner = makeUser({ id: "owner1", email: "owner@example.com", clerkId: "clerk_owner" });
    const admin = makeUser({ id: "admin1", email: "admin@example.com", clerkId: "clerk_admin" });
    makeOrg({ id: "org1", name: "Primary", ownerId: realOwner.id });
    members.push({
      id: "m_admin",
      organizationId: "org1",
      userId: admin.id,
      role: "ADMIN",
      invitedEmail: null,
      accepted: true,
      createdAt: new Date(),
    });

    const result = await inviteTeamMember({
      actor: admin,
      email: "fresh@example.com",
      role: "DEVELOPER",
    });
    expect(result.alreadyMember).toBe(false);
    expect(result.organizationId).toBe("org1");
  });

  it("ordinary Member cannot invite", async () => {
    const owner = makeUser({ id: "owner1", email: "owner@example.com", clerkId: "clerk_owner" });
    const member = makeUser({ id: "member1", email: "member@example.com", clerkId: "clerk_member" });
    makeOrg({ id: "org1", name: "Primary", ownerId: owner.id });
    members.push({
      id: "m_member",
      organizationId: "org1",
      userId: member.id,
      role: "DEVELOPER",
      invitedEmail: null,
      accepted: true,
      createdAt: new Date(),
    });

    await expect(
      inviteTeamMember({ actor: member, email: "x@example.com", role: "DEVELOPER" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("cross-org invite target is forbidden", async () => {
    const ownerA = makeUser({ id: "ownerA", email: "a@example.com", clerkId: "clerk_a" });
    const ownerB = makeUser({ id: "ownerB", email: "b@example.com", clerkId: "clerk_b" });
    makeOrg({ id: "orgA", name: "A", ownerId: ownerA.id });
    makeOrg({ id: "orgB", name: "B", ownerId: ownerB.id });
    members.push({
      id: "m_a",
      organizationId: "orgA",
      userId: ownerA.id,
      role: "OWNER",
      invitedEmail: null,
      accepted: true,
      createdAt: new Date(),
    });

    await expect(
      inviteTeamMember({
        actor: ownerA,
        email: "x@example.com",
        role: "DEVELOPER",
        organizationId: "orgB",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("does not throw 500 on unique constraint race", async () => {
    const owner = makeUser({ id: "owner1", email: "owner@example.com", clerkId: "clerk_owner" });
    const memberUser = makeUser({ id: "member1", email: "member@example.com", clerkId: "clerk_member" });
    makeOrg({ id: "org1", name: "Primary", ownerId: owner.id });
    members.push({
      id: "m_owner",
      organizationId: "org1",
      userId: owner.id,
      role: "OWNER",
      invitedEmail: null,
      accepted: true,
      createdAt: new Date(),
    });

    // First invite succeeds
    await inviteTeamMember({ actor: owner, email: "member@example.com", role: "DEVELOPER" });
    // Second invite must be idempotent (alreadyMember), never 500
    const second = await inviteTeamMember({ actor: owner, email: "member@example.com", role: "DEVELOPER" });
    expect(second.alreadyMember).toBe(true);
    expect(second.member.userId).toBe(memberUser.id);
  });
});

describe("resolveInviteCapableOrganization", () => {
  it("returns null when actor has no admin capability", async () => {
    const member = makeUser({ id: "m1", email: "m@example.com", clerkId: "c1" });
    makeOrg({ id: "org1", name: "O", ownerId: "someone_else" });
    members.push({
      id: "mm",
      organizationId: "org1",
      userId: member.id,
      role: "VIEWER",
      invitedEmail: null,
      accepted: true,
      createdAt: new Date(),
    });
    await expect(resolveInviteCapableOrganization(member.id)).resolves.toBeNull();
  });
});

describe("TeamInviteError contract", () => {
  it("exposes stable codes without leaking secrets", () => {
    const err = new TeamInviteError("FORBIDDEN", "Only organization owners or admins can invite members", 403);
    expect(err.status).toBe(403);
    expect(JSON.stringify(err)).not.toMatch(/sk_live_|password|DATABASE_URL/i);
  });
});
