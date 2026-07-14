import { prisma } from "../prisma";
import { isStripePreviewDisabled } from "../stripe-preview-guard";
import { creditsToEur } from "./http";

export async function getWorkspaceBilling(userId: string, organizationId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [balance, monthUsage, transactions, payments, user] = await Promise.all([
    prisma.creditBalance.findUnique({ where: { userId } }),
    prisma.usageLog.aggregate({
      where: { userId, createdAt: { gte: monthStart } },
      _sum: { costCredits: true },
      _count: { id: true },
    }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  const monthCredits = monthUsage._sum.costCredits ?? 0;

  return {
    organizationId,
    currentCredits: balance?.credits ?? 0,
    currentCreditsEur: creditsToEur(balance?.credits ?? 0),
    currentMonthUsageCredits: monthCredits,
    currentMonthUsageEur: creditsToEur(monthCredits),
    currentMonthRequests: monthUsage._count.id,
    creditTransactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      credits: t.amount,
      amountEur: Number(t.amountEur ?? 0),
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
    paymentHistory: payments.map((p) => ({
      id: p.id,
      status: p.status,
      amountEur: Number(p.amountEur),
      credits: p.credits,
      createdAt: p.createdAt.toISOString(),
    })),
    billingProfile: {
      companyName: user?.companyName ?? "",
      vatId: user?.vatId ?? "",
      country: user?.country ?? "",
      currency: "EUR" as const,
    },
    paymentStatus: isStripePreviewDisabled() ? "PREVIEW_DISABLED" : "AVAILABLE",
    checkoutDisabled: isStripePreviewDisabled(),
    checkoutMessage: isStripePreviewDisabled()
      ? "Payments are temporarily unavailable in Preview"
      : null,
    currency: "EUR" as const,
  };
}

export async function getWorkspaceInvoices(userId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    subtotalEur: Number(inv.subtotalEur),
    taxEur: Number(inv.taxEur),
    totalEur: Number(inv.totalEur),
    paid: inv.paid,
    companyName: inv.companyName,
    country: inv.country,
    vatId: inv.vatId,
    lineItems: inv.lineItems,
    createdAt: inv.createdAt.toISOString(),
    hasDownload: Boolean(inv.lineItems),
  }));
}

export async function getWorkspaceInvoiceDetail(userId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId } });
  if (!invoice) return null;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    subtotalEur: Number(invoice.subtotalEur),
    taxEur: Number(invoice.taxEur),
    totalEur: Number(invoice.totalEur),
    paid: invoice.paid,
    companyName: invoice.companyName,
    country: invoice.country,
    vatId: invoice.vatId,
    lineItems: invoice.lineItems,
    createdAt: invoice.createdAt.toISOString(),
    hasDownload: Boolean(invoice.lineItems),
    currency: "EUR" as const,
  };
}
