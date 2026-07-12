import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/credits";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { KeyPermission } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const body = await req.json();

    const key = await prisma.apiKey.findFirst({ where: { id, userId: user.id } });
    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
    if (body.name !== undefined) data.name = String(body.name);
    if (body.permission !== undefined) data.permission = body.permission as KeyPermission;
    if (body.ipWhitelist !== undefined) data.ipWhitelist = body.ipWhitelist || null;
    if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit ? Number(body.usageLimit) : null;
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const updated = await prisma.apiKey.update({ where: { id }, data });

    if (body.name) {
      await writeAudit({ userId: user.id, action: "Renamed API key", category: "API_KEY", detail: { keyId: id, name: body.name } });
    } else if (body.enabled !== undefined) {
      await writeAudit({
        userId: user.id,
        action: body.enabled ? "Enabled API key" : "Disabled API key",
        category: "API_KEY",
        detail: { keyId: id },
      });
    }

    return NextResponse.json({
      key: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        lastUsed: updated.lastUsed?.toISOString() ?? null,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
      },
    });
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
    await writeAudit({ userId: user.id, action: "Deleted API key", category: "API_KEY", detail: { keyId: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const user = await requireDbUser();
    const { id } = await params;

    const key = await prisma.apiKey.findFirst({ where: { id, userId: user.id } });
    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { fullKey, prefix, keyHash } = generateApiKey();
    const updated = await prisma.apiKey.update({
      where: { id },
      data: { prefix, keyHash, usageCount: 0 },
    });

    await writeAudit({ userId: user.id, action: "Regenerated API key", category: "API_KEY", detail: { keyId: id } });

    return NextResponse.json({
      fullKey,
      key: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        lastUsed: updated.lastUsed?.toISOString() ?? null,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
