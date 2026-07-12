import { getCurrentDbUser } from "@/lib/auth";
import { BillingEngine } from "@/lib/billing";
import { listUserSubscriptions } from "@/lib/billing/subscription-engine";
import { Card, CardTitle } from "@/components/ui/card";
import { formatCredits } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function WalletPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  const wallet = await BillingEngine.getWallet(user.id);
  const subs = await listUserSubscriptions(user.id);
  const nextBilling = subs.find((s) => s.status === "ACTIVE")?.currentPeriodEnd;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Wallet</h1>
        <p className="text-sm text-slate-500">Credits balance and lifetime stats</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardTitle>Current Balance</CardTitle>
          <p className="mt-2 text-3xl font-bold">{formatCredits(wallet.credits)}</p>
          <p className="text-sm text-slate-500">Available: {formatCredits(wallet.availableCredits)}</p>
        </Card>
        <Card>
          <CardTitle>Frozen Balance</CardTitle>
          <p className="mt-2 text-3xl font-bold">{formatCredits(wallet.frozenCredits)}</p>
        </Card>
        <Card>
          <CardTitle>Lifetime Recharge</CardTitle>
          <p className="mt-2 text-3xl font-bold">{formatCredits(wallet.lifetimeRecharge)}</p>
        </Card>
        <Card>
          <CardTitle>Lifetime Spend</CardTitle>
          <p className="mt-2 text-3xl font-bold">{formatCredits(wallet.lifetimeSpend)}</p>
        </Card>
        <Card>
          <CardTitle>Next Billing</CardTitle>
          <p className="mt-2 text-lg">{nextBilling ? new Date(nextBilling).toLocaleDateString() : "—"}</p>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/billing"><Button>Recharge</Button></Link>
        <Link href="/dashboard/invoices"><Button variant="secondary">Invoices</Button></Link>
      </div>
    </div>
  );
}
