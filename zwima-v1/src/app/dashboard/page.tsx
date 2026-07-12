import { Card, CardTitle } from "@/components/ui/card";
import { getCurrentDbUser } from "@/lib/auth";
import { formatCredits } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  const [balance, usageCount, payments, recentUsage, providerUsage] = await Promise.all([
    prisma.creditBalance.findUnique({ where: { userId: user.id } }),
    prisma.usageLog.count({ where: { userId: user.id } }),
    prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.usageLog.findMany({
      where: { userId: user.id },
      include: { provider: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.usageLog.groupBy({
      by: ["providerId"],
      where: { userId: user.id },
      _sum: { costCredits: true, inputTokens: true, outputTokens: true },
    }),
  ]);

  const providers = await prisma.provider.findMany();
  const providerMap = Object.fromEntries(providers.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back, {user.companyName || user.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardTitle>Current Balance</CardTitle>
          <p className="mt-2 text-3xl font-bold">{formatCredits(balance?.credits ?? 0)}</p>
          <p className="text-sm text-slate-500">credits</p>
        </Card>
        <Card>
          <CardTitle>Total Usage</CardTitle>
          <p className="mt-2 text-3xl font-bold">{formatCredits(usageCount)}</p>
          <p className="text-sm text-slate-500">requests logged</p>
        </Card>
        <Card>
          <CardTitle>Provider Usage</CardTitle>
          <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
            {providerUsage.length === 0 && <li>No usage yet</li>}
            {providerUsage.map((row) => (
              <li key={row.providerId}>
                {providerMap[row.providerId] ?? "Unknown"}: {formatCredits(row._sum.costCredits ?? 0)} credits
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Recent Requests</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Provider</th>
                  <th className="pb-2">Model</th>
                  <th className="pb-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recentUsage.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-slate-500">
                      No requests yet
                    </td>
                  </tr>
                )}
                {recentUsage.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="py-2">{row.provider.name}</td>
                    <td className="py-2">{row.model}</td>
                    <td className="py-2">{row.costCredits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardTitle>Recent Payments</CardTitle>
          <div className="mt-4 space-y-3">
            {payments.length === 0 && <p className="text-sm text-slate-500">No payments yet</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{formatCredits(p.credits)} credits</p>
                  <p className="text-slate-500">{new Date(p.createdAt).toLocaleString()}</p>
                </div>
                <span
                  className={
                    p.status === "COMPLETED"
                      ? "text-green-600"
                      : p.status === "PENDING"
                        ? "text-amber-600"
                        : "text-red-600"
                  }
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
