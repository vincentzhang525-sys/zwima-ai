import { ApiKeysClient } from "@/components/api-keys-client";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ApiKeysPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, enabled: true, createdAt: true, lastUsed: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h1>
        <p className="text-sm text-slate-500">Create and manage your API keys</p>
      </div>
      <ApiKeysClient initialKeys={keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsed: k.lastUsed?.toISOString() ?? null }))} />
    </div>
  );
}
