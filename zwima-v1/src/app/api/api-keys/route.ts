import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/credits";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireDbUser();
    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id, name: { not: "__playground__" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        enabled: true,
        permission: true,
        ipWhitelist: true,
        usageLimit: true,
        usageCount: true,
        expiresAt: true,
        createdAt: true,
        lastUsed: true,
      },
    });
    return NextResponse.json({
      keys: keys.map((k) => ({
        ...k,
        createdAt: k.createdAt.toISOString(),
        lastUsed: k.lastUsed?.toISOString() ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const body = await req.json();
    const name = body.name;
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const { fullKey, prefix, keyHash } = generateApiKey();
    const key = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: String(name),
        prefix,
        keyHash,
        permission: body.permission ?? "FULL",
        ipWhitelist: body.ipWhitelist ?? null,
        usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    await writeAudit({ userId: user.id, action: "Created API key", category: "API_KEY", detail: { keyId: key.id, name } });

    return NextResponse.json({
      fullKey,
      key: {
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        enabled: key.enabled,
        permission: key.permission,
        ipWhitelist: key.ipWhitelist,
        usageLimit: key.usageLimit,
        usageCount: key.usageCount,
        expiresAt: key.expiresAt?.toISOString() ?? null,
        createdAt: key.createdAt.toISOString(),
        lastUsed: null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
