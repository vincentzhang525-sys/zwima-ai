import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [revenueToday, revenueMonth, payments, usageLogs, topCustomers, subscriptions] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: "COMPLETED", createdAt: { gte: startOfDay } },
        _sum: { amountEur: true },
      }),
      prisma.payment.aggregate({
        where: { status: "COMPLETED", createdAt: { gte: startOfMonth } },
        _sum: { amountEur: true },
      }),
      prisma.payment.findMany({
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { email: true, companyName: true } } },
      }),
      prisma.usageLog.findMany({
        where: { createdAt: { gte: startOfMonth } },
        select: { costCredits: true, providerCost: true },
      }),
      prisma.payment.groupBy({
        by: ["userId"],
        where: { status: "COMPLETED", createdAt: { gte: startOfMonth } },
        _sum: { amountEur: true, credits: true },
        orderBy: { _sum: { amountEur: "desc" } },
        take: 10,
      }),
      prisma.subscription.findMany({ where: { status: "ACTIVE" } }),
    ]);

    const revenueTodayEur = Number(revenueToday._sum.amountEur ?? 0);
    const revenueMonthEur = Number(revenueMonth._sum.amountEur ?? 0);
    const mrr = subscriptions.reduce((s, sub) => s + Number(sub.amountEur ?? 0), 0);
    const arr = mrr * 12;

    const totalProviderCost = usageLogs.reduce((s, u) => s + Number(u.providerCost ?? 0), 0);
    const totalUsageCredits = usageLogs.reduce((s, u) => s + u.costCredits, 0);
    const grossMargin = revenueMonthEur > 0 ? ((revenueMonthEur - totalProviderCost) / revenueMonthEur) * 100 : 0;
    const netMargin = revenueMonthEur > 0 ? ((revenueMonthEur - totalProviderCost * 1.1) / revenueMonthEur) * 100 : 0;

    const topCustomerIds = topCustomers.map((t) => t.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: topCustomerIds } },
      select: { id: true, email: true, companyName: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return NextResponse.json({
      revenueToday: revenueTodayEur,
      revenueMonth: revenueMonthEur,
      mrr,
      arr,
      rechargeCount: payments.length,
      recentPayments: payments,
      topCustomers: topCustomers.map((t) => ({
        user: userMap[t.userId],
        amountEur: Number(t._sum.amountEur ?? 0),
        credits: t._sum.credits ?? 0,
      })),
      providerCost: totalProviderCost,
      grossMargin: Math.round(grossMargin * 10) / 10,
      netMargin: Math.round(netMargin * 10) / 10,
      totalUsageCredits,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status: 403 });
  }
}
