import { UsageClient } from "@/components/usage-client";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function UsagePage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  const logs = await prisma.usageLog.findMany({
    where: { userId: user.id },
    include: { provider: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Usage</h1>
        <p className="text-sm text-slate-500">API call history and costs</p>
      </div>
      <UsageClient
        initialLogs={logs.map((l) => ({
          id: l.id,
          time: l.createdAt.toISOString(),
          provider: l.provider.name,
          model: l.model,
          inputTokens: l.inputTokens,
          outputTokens: l.outputTokens,
          cost: l.costCredits,
        }))}
      />
    </div>
  );
}
