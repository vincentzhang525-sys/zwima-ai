import { prisma } from "../prisma";
import type { TransactionType, UserTier, Prisma } from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";
import { calculateUsageCredits, countMessageTokens, estimateRequestCredits } from "./pricing-engine";
import { createInvoice, type InvoiceLineItem } from "./invoice-engine";
import type { MarginContext } from "./margin-engine";
import { atomicDebitAvailableCredits } from "./atomic-debit";

export type WalletSnapshot = {
  credits: number;
  frozenCredits: number;
  availableCredits: number;
  lifetimeSpend: number;
  lifetimeRecharge: number;
};

async function ensureWallet(userId: string) {
  return prisma.creditBalance.upsert({
    where: { userId },
    create: { userId, credits: 1000 },
    update: {},
  });
}

export async function getWallet(userId: string): Promise<WalletSnapshot> {
  const w = await ensureWallet(userId);
  return {
    credits: w.credits,
    frozenCredits: w.frozenCredits,
    availableCredits: w.credits - w.frozenCredits,
    lifetimeSpend: w.lifetimeSpend,
    lifetimeRecharge: w.lifetimeRecharge,
  };
}

export async function recordTransaction(params: {
  userId: string;
  type: TransactionType;
  amount: number;
  amountEur?: number;
  description?: string;
  metadata?: Prisma.InputJsonValue;
  invoiceId?: string;
}) {
  return prisma.transaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      amountEur: params.amountEur,
      description: params.description,
      metadata: params.metadata ?? undefined,
      invoiceId: params.invoiceId,
    },
  });
}

export async function processRecharge(params: {
  userId: string;
  credits: number;
  amountEur: number;
  description?: string;
  paymentId?: string;
  couponCode?: string;
  generateInvoice?: boolean;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error("User not found");

  let credits = params.credits;
  if (params.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: params.couponCode.toUpperCase() } });
    if (coupon?.enabled && (!coupon.expiresAt || coupon.expiresAt > new Date())) {
      if (!coupon.maxUsage || coupon.currentUsage < coupon.maxUsage) {
        credits = Math.round(credits * (1 + Number(coupon.discountPct) / 100));
        await prisma.coupon.update({
          where: { id: coupon.id },
          data: { currentUsage: { increment: 1 } },
        });
      }
    }
  }

  const lineItems: InvoiceLineItem[] = [
    {
      description: params.description ?? "Credit recharge",
      quantity: 1,
      unitPriceEur: params.amountEur,
      totalEur: params.amountEur,
    },
  ];

  const invoice =
    params.generateInvoice !== false
      ? await createInvoice({ user, lineItems, paid: true })
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.creditBalance.upsert({
      where: { userId: params.userId },
      create: { userId: params.userId, credits, lifetimeRecharge: credits },
      update: { credits: { increment: credits }, lifetimeRecharge: { increment: credits } },
    });

    await tx.transaction.create({
      data: {
        userId: params.userId,
        type: "RECHARGE",
        amount: credits,
        amountEur: params.amountEur,
        description: params.description ?? "Credit recharge",
        invoiceId: invoice?.id,
        metadata: { paymentId: params.paymentId, couponCode: params.couponCode },
      },
    });

    if (params.paymentId && invoice) {
      await tx.payment.update({
        where: { id: params.paymentId },
        data: { invoiceId: invoice.id, status: "COMPLETED" },
      });
    }
  });

  return { credits, invoiceId: invoice?.id, invoiceNumber: invoice?.invoiceNumber };
}

export async function chargeForUsage(params: {
  userId: string;
  apiKeyId: string;
  providerId: string;
  providerSlug: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  userTier?: UserTier;
  requestId?: string;
  usageSource?: "provider" | "estimated";
  organizationId?: string;
  workspaceId?: string | null;
}): Promise<{
  costCredits: number;
  usageLogId: string;
  providerCost: number;
  replayed?: boolean;
}> {
  const marginCtx: MarginContext = {
    providerSlug: params.providerSlug,
    modelId: params.model,
    userId: params.userId,
    userTier: params.userTier,
  };

  const { providerCost, customerCredits } = await calculateUsageCredits({
    providerSlug: params.providerSlug,
    modelId: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    marginCtx,
  });

  return prisma.$transaction(async (tx) => {
    if (params.requestId) {
      const existing = await tx.usageLog.findFirst({
        where: { requestId: params.requestId },
      });
      if (existing) {
        return {
          costCredits: existing.costCredits,
          usageLogId: existing.id,
          providerCost: Number(existing.providerCost ?? providerCost),
          replayed: true,
        };
      }
    }

    await tx.creditBalance.upsert({
      where: { userId: params.userId },
      create: { userId: params.userId, credits: 0 },
      update: {},
    });

    const debited = await atomicDebitAvailableCredits(tx, params.userId, customerCredits);
    if (!debited) throw new Error("Insufficient credits");

    let usageLog;
    try {
      usageLog = await tx.usageLog.create({
        data: {
          userId: params.userId,
          apiKeyId: params.apiKeyId,
          providerId: params.providerId,
          model: params.model,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          costCredits: customerCredits,
          providerCost,
          requestId: params.requestId,
          latencyMs: params.latencyMs,
          success: true,
        },
      });
    } catch (err) {
      // Concurrent identical requestId: unique constraint → fail-closed replay (no second charge).
      if (
        params.requestId &&
        err instanceof PrismaNS.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const existing = await tx.usageLog.findFirst({
          where: { requestId: params.requestId },
        });
        if (existing) {
          // Roll back this transaction's debit by throwing — outer caller must not commit a
          // double-charge. Interactive transaction abort discards the conditional UPDATE.
          throw new IdempotentUsageConflictError(existing.id, existing.costCredits, Number(existing.providerCost ?? providerCost));
        }
      }
      throw err;
    }

    await tx.transaction.create({
      data: {
        userId: params.userId,
        type: "USAGE",
        amount: customerCredits,
        description: `${params.providerSlug}/${params.model}`,
        metadata: {
          usageLogId: usageLog.id,
          providerCost,
          usageSource: params.usageSource ?? "provider",
          totalTokens: params.inputTokens + params.outputTokens,
          currency: "CREDITS",
          requestId: params.requestId,
          organizationId: params.organizationId,
          workspaceId: params.workspaceId ?? null,
          status: "SUCCESS",
        },
      },
    });

    await tx.apiKey.update({
      where: { id: params.apiKeyId },
      data: { lastUsed: new Date(), usageCount: { increment: 1 } },
    });

    return { costCredits: customerCredits, usageLogId: usageLog.id, providerCost };
  }).catch(async (err) => {
    if (err instanceof IdempotentUsageConflictError) {
      return {
        costCredits: err.costCredits,
        usageLogId: err.usageLogId,
        providerCost: err.providerCost,
        replayed: true,
      };
    }
    throw err;
  });
}

/** Internal: concurrent requestId collision after a lost debit race — abort tx, surface replay. */
export class IdempotentUsageConflictError extends Error {
  readonly usageLogId: string;
  readonly costCredits: number;
  readonly providerCost: number;

  constructor(usageLogId: string, costCredits: number, providerCost: number) {
    super("IDEMPOTENT_USAGE_CONFLICT");
    this.name = "IdempotentUsageConflictError";
    this.usageLogId = usageLogId;
    this.costCredits = costCredits;
    this.providerCost = providerCost;
  }
}

export async function processRefund(userId: string, credits: number, amountEur: number, reason: string) {
  await prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.findUnique({ where: { userId } });
    const deduct = Math.min(credits, balance?.credits ?? 0);
    if (deduct > 0) {
      await tx.creditBalance.update({ where: { userId }, data: { credits: { decrement: deduct } } });
    }
    await tx.transaction.create({
      data: { userId, type: "REFUND", amount: deduct, amountEur, description: reason },
    });
  });
}

export async function processAdjustment(userId: string, credits: number, reason: string) {
  await prisma.$transaction(async (tx) => {
    if (credits >= 0) {
      await tx.creditBalance.update({ where: { userId }, data: { credits: { increment: credits } } });
    } else {
      await tx.creditBalance.update({ where: { userId }, data: { credits: { increment: credits } } });
    }
    await tx.transaction.create({
      data: { userId, type: "ADJUSTMENT", amount: Math.abs(credits), description: reason },
    });
  });
}

export async function getUserTransactions(userId: string, limit = 50) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function validateCoupon(code: string): Promise<{ valid: boolean; discountPct: number }> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon?.enabled) return { valid: false, discountPct: 0 };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { valid: false, discountPct: 0 };
  if (coupon.maxUsage && coupon.currentUsage >= coupon.maxUsage) return { valid: false, discountPct: 0 };
  return { valid: true, discountPct: Number(coupon.discountPct) };
}

export async function getOrCreateReferral(userId: string) {
  const existing = await prisma.referral.findUnique({ where: { userId } });
  if (existing) return existing;
  const code = `ZW-${userId.slice(-6).toUpperCase()}`;
  return prisma.referral.create({ data: { userId, code } });
}

export async function addReferralCommission(referrerUserId: string, amountCents: number) {
  return prisma.referral.update({
    where: { userId: referrerUserId },
    data: { balanceCents: { increment: amountCents }, totalEarned: { increment: amountCents } },
  });
}

export { countMessageTokens, estimateRequestCredits, calculateUsageCredits };
