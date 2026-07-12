import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import type { OrgRole } from "@prisma/client";

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
    const user = await requireDbUser();
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
      const org = await prisma.organization.findFirst({ where: { ownerId: user.id } });
      if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

      const email = String(body.email || "").toLowerCase();
      const role = (body.role || "DEVELOPER") as OrgRole;
      const invitee = await prisma.user.findUnique({ where: { email } });

      const member = await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: invitee?.id ?? user.id,
          role,
          invitedEmail: invitee ? null : email,
          accepted: !!invitee,
        },
        include: { user: { select: { email: true } } },
      });

      await writeAudit({
        userId: user.id,
        action: `Invited ${email} as ${role}`,
        category: "TEAM",
        detail: { memberId: member.id },
      });

      return NextResponse.json({ member });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
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
