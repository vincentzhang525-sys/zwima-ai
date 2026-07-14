import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/credits";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ensureDefaultOrganization, revokeApiKey } from "@/lib/api-keys/governance";
import type { KeyPermission } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireDbUser();
    const orgId = await ensureDefaultOrganization(user.id, user.email);
    const { id } = await params;
    const body = await req.json();

    const key = await prisma.apiKey.findFirst({ where: { id, userId: user.id, organizationId: orgId } });
    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.enabled !== undefined) {
      data.enabled = Boolean(body.enabled);
      data.status = body.enabled ? "ACTIVE" : "DISABLED";
    }
    if (body.name !== undefined) data.name = String(body.name);
    if (body.permission !== undefined) data.permission = body.permission as KeyPermission;
    if (body.permissions !== undefined) data.permissions = body.permissions;
    if (body.ipWhitelist !== undefined) data.ipWhitelist = body.ipWhitelist || null;
    if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit ? Number(body.usageLimit) : null;
    if (body.rpmLimit !== undefined) data.rpmLimit = body.rpmLimit ? Number(body.rpmLimit) : null;
    if (body.tpmLimit !== undefined) data.tpmLimit = body.tpmLimit ? Number(body.tpmLimit) : null;
    if (body.dailyBudget !== undefined) data.dailyBudget = body.dailyBudget ? Number(body.dailyBudget) : null;
    if (body.monthlyBudget !== undefined) data.monthlyBudget = body.monthlyBudget ? Number(body.monthlyBudget) : null;
    if (body.allowedProviders !== undefined) data.allowedProviders = body.allowedProviders;
    if (body.allowedModels !== undefined) data.allowedModels = body.allowedModels;
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const updated = await prisma.apiKey.update({ where: { id }, data });
    await writeAudit({ userId: user.id, action: "Updated API key", category: "API_KEY", detail: { keyId: id } });

    return NextResponse.json({ key: { ...updated, createdAt: updated.createdAt.toISOString() } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireDbUser();
    const orgId = await ensureDefaultOrganization(user.id, user.email);
    const { id } = await params;

    const key = await prisma.apiKey.findFirst({ where: { id, userId: user.id, organizationId: orgId } });
    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await revokeApiKey(id, orgId, user.id, "Deleted by user");
    await writeAudit({ userId: user.id, action: "Revoked API key", category: "API_KEY", detail: { keyId: id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const user = await requireDbUser();
    const orgId = await ensureDefaultOrganization(user.id, user.email);
    const { id } = await params;

    const key = await prisma.apiKey.findFirst({ where: { id, userId: user.id, organizationId: orgId } });
    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.apiKey.update({
      where: { id },
      data: { status: "REVOKED", enabled: false, revokedAt: new Date(), revokedById: user.id, revokeReason: "Rotated" },
    });

    const { fullKey, prefix, keyHash } = generateApiKey();
    const newKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        name: `${key.name} (rotated)`,
        prefix,
        keyHash,
        permission: key.permission,
        permissions: key.permissions,
        allowedProviders: key.allowedProviders,
        allowedModels: key.allowedModels,
        rpmLimit: key.rpmLimit,
        tpmLimit: key.tpmLimit,
        dailyBudget: key.dailyBudget,
        monthlyBudget: key.monthlyBudget,
      },
    });

    await writeAudit({ userId: user.id, action: "Rotated API key", category: "API_KEY", detail: { oldKeyId: id, newKeyId: newKey.id } });

    return NextResponse.json({ fullKey, key: { id: newKey.id, prefix: newKey.prefix } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
