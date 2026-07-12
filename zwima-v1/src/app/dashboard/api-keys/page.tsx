import { ApiKeysClient } from "@/components/api-keys-client";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ApiKeysPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h1>
        <p className="text-sm text-slate-500">Create, rename, disable, and manage API key permissions</p>
      </div>
      <ApiKeysClient
        initialKeys={keys.map((k) => ({
          ...k,
          createdAt: k.createdAt.toISOString(),
          lastUsed: k.lastUsed?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
