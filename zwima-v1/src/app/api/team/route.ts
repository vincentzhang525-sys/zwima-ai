import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentDbUser, requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import type { OrgRole } from "@prisma/client";
import {
  inviteTeamMember,
  resolveAuthenticatedPrismaUser,
  TeamInviteError,
} from "@/lib/team/invite";

export async function GET() {
  try {
    const user = await requireDbUser();
    const org = await prisma.organization.findFirst({
      where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      include: {
        owner: { select: { email: true, id: true } },
        members: { include: { user: { select: { id: true, email: true, companyName: true } } } },
      },
    });
    return NextResponse.json({ organization: org });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
    }

    const sessionUser = await getCurrentDbUser();
    const user =
      sessionUser ??
      (await resolveAuthenticatedPrismaUser({
        clerkUserId,
        email: null,
        internalUserId: null,
      }));

    if (!user) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
    }

    const body = await req.json();

    if (body.action === "create") {
      const name = String(body.name || "My Organization");
      const existing = await prisma.organization.findFirst({ where: { ownerId: user.id } });
      if (existing) return NextResponse.json({ error: "Organization already exists" }, { status: 400 });

      const org = await prisma.organization.create({
        data: {
          name,
          ownerId: user.id,
          members: { create: { userId: user.id, role: "OWNER" } },
        },
        include: { members: { include: { user: { select: { email: true } } } } },
      });
      await writeAudit({ userId: user.id, action: "Created organization", category: "TEAM", detail: { orgId: org.id } });
      return NextResponse.json({ organization: org });
    }

    if (body.action === "invite") {
      // Resolve Prisma actor again with explicit clerk/email priority — never compare Clerk id to ownerId.
      const actor =
        (await resolveAuthenticatedPrismaUser({
          clerkUserId,
          email: user.email,
          internalUserId: user.id,
        })) ?? user;

      const result = await inviteTeamMember({
        actor,
        email: String(body.email || ""),
        role: body.role as OrgRole | string | undefined,
        organizationId: body.organizationId ? String(body.organizationId) : undefined,
      });

      if (!result.alreadyMember) {
        await writeAudit({
          userId: actor.id,
          action: `Invited ${String(body.email || "").toLowerCase()} as ${result.member.role}`,
          category: "TEAM",
          detail: { memberId: result.member.id, organizationId: result.organizationId },
        });
      }

      return NextResponse.json(
        {
          member: result.member,
          alreadyMember: result.alreadyMember,
          organizationId: result.organizationId,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    if (err instanceof TeamInviteError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message }, alreadyMember: err.code === "MEMBER_ALREADY_EXISTS" },
        { status: err.status },
      );
    }
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Failed" } },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireDbUser();
    const { memberId, role } = await req.json();
    const org = await prisma.organization.findFirst({ where: { ownerId: user.id } });
    if (!org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
    });
    await writeAudit({ userId: user.id, action: `Updated role to ${role}`, category: "TEAM", detail: { memberId } });
    return NextResponse.json({ member: updated });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireDbUser();
    const { memberId } = await req.json();
    const org = await prisma.organization.findFirst({ where: { ownerId: user.id } });
    if (!org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.organizationMember.delete({ where: { id: memberId } });
    await writeAudit({ userId: user.id, action: "Removed member", category: "TEAM", detail: { memberId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
