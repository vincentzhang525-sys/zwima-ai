import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const { enabled } = await req.json();

    const key = await prisma.apiKey.findFirst({ where: { id, userId: user.id } });
    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.apiKey.update({ where: { id }, data: { enabled: Boolean(enabled) } });
    return NextResponse.json({ key: updated });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireDbUser();
    const { id } = await params;

    const key = await prisma.apiKey.findFirst({ where: { id, userId: user.id } });
    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.apiKey.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
