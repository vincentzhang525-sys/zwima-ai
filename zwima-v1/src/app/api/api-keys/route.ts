import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireDbUser();
    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, prefix: true, enabled: true, createdAt: true, lastUsed: true },
    });
    return NextResponse.json({ keys });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const { fullKey, prefix, keyHash } = generateApiKey();
    const key = await prisma.apiKey.create({
      data: { userId: user.id, name: String(name), prefix, keyHash },
    });

    return NextResponse.json({
      fullKey,
      key: {
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        enabled: key.enabled,
        createdAt: key.createdAt.toISOString(),
        lastUsed: null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
