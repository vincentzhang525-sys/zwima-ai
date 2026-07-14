import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/credits";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ensureDefaultOrganization, maskKeyPrefix } from "@/lib/api-keys/governance";

const KEY_SELECT = {
  id: true,
  name: true,
  prefix: true,
  enabled: true,
  status: true,
  permission: true,
  permissions: true,
  ipWhitelist: true,
  usageLimit: true,
  usageCount: true,
  rpmLimit: true,
  tpmLimit: true,
  dailyBudget: true,
  monthlyBudget: true,
  currentMonthUsage: true,
  allowedProviders: true,
  allowedModels: true,
  environment: true,
  expiresAt: true,
  revokedAt: true,
  revokeReason: true,
  createdAt: true,
  lastUsed: true,
  organizationId: true,
} as const;

export async function GET() {
  try {
    const user = await requireDbUser();
    const orgId = await ensureDefaultOrganization(user.id, user.email);
    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id, organizationId: orgId, name: { not: "__playground__" } },
      orderBy: { createdAt: "desc" },
      select: KEY_SELECT,
    });
    return NextResponse.json({
      keys: keys.map((k) => ({
        ...k,
        prefix: maskKeyPrefix(k.prefix),
        createdAt: k.createdAt.toISOString(),
        lastUsed: k.lastUsed?.toISOString() ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const orgId = await ensureDefaultOrganization(user.id, user.email);
    const body = await req.json();
    const name = body.name;
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const { fullKey, prefix, keyHash } = generateApiKey();
    const key = await prisma.apiKey.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        name: String(name),
        prefix,
        keyHash,
        permission: body.permission ?? "FULL",
        permissions: body.permissions ?? [],
        ipWhitelist: body.ipWhitelist ?? null,
        usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
        rpmLimit: body.rpmLimit ? Number(body.rpmLimit) : null,
        tpmLimit: body.tpmLimit ? Number(body.tpmLimit) : null,
        dailyBudget: body.dailyBudget ? Number(body.dailyBudget) : null,
        monthlyBudget: body.monthlyBudget ? Number(body.monthlyBudget) : null,
        allowedProviders: body.allowedProviders ?? [],
        allowedModels: body.allowedModels ?? [],
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        environment: body.environment ?? "production",
      },
    });

    await writeAudit({
      userId: user.id,
      action: "Created API key",
      category: "API_KEY",
      detail: { keyId: key.id, name, organizationId: orgId },
    });

    return NextResponse.json({
      fullKey,
      key: {
        id: key.id,
        name: key.name,
        prefix: maskKeyPrefix(prefix),
        enabled: key.enabled,
        status: key.status,
        permission: key.permission,
        expiresAt: key.expiresAt?.toISOString() ?? null,
        createdAt: key.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
