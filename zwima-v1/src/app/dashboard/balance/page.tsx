import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentDbUser } from "@/lib/auth";
import { formatCredits } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function BalancePage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  const [balance, payments, transactions] = await Promise.all([
    prisma.creditBalance.findUnique({ where: { userId: user.id } }),
    prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const credits = balance?.credits ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Balance</h1>
        <p className="text-sm text-slate-500">Manage your credits and recharge</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Current Credits</CardTitle>
          <p className="mt-2 text-4xl font-bold">{formatCredits(credits)}</p>
        </Card>
        <Card>
          <CardTitle>Available Tokens</CardTitle>
          <p className="mt-2 text-4xl font-bold">{formatCredits(credits * 100)}</p>
          <p className="text-sm text-slate-500">Estimated at 100 tokens per credit</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Recharge</CardTitle>
          <Link href="/dashboard/billing">
            <Button>Recharge via Stripe</Button>
          </Link>
        </div>
      </Card>

      <Card>
        <CardTitle>Payment History</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                <th className="pb-2">Date</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Credits</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No payments yet
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="py-2">€{p.amountEur.toString()}</td>
                  <td className="py-2">{formatCredits(p.credits)}</td>
                  <td className="py-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle>Recent Transactions</CardTitle>
        <div className="mt-4 space-y-2 text-sm">
          {transactions.map((t) => (
            <div key={t.id} className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800">
              <span>{t.description || t.type}</span>
              <span className={t.type === "USAGE" || t.type === "REFUND" || t.type === "EXPIRATION" ? "text-red-600" : "text-green-600"}>
                {t.type === "USAGE" || t.type === "REFUND" || t.type === "EXPIRATION" ? "-" : "+"}
                {formatCredits(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
