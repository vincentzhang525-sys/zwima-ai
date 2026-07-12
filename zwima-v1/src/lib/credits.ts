import { createHash, randomBytes } from "crypto";
import { BillingEngine } from "./billing";

const KEY_PREFIX = "sk_live_";

export function generateApiKey(): { fullKey: string; prefix: string; keyHash: string } {
  const secret = randomBytes(24).toString("hex");
  const fullKey = `${KEY_PREFIX}${secret}`;
  const prefix = `${KEY_PREFIX}${secret.slice(0, 8)}…`;
  const keyHash = hashApiKey(fullKey);
  return { fullKey, prefix, keyHash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** @deprecated Use BillingEngine.recharge */
export async function addCredits(userId: string, credits: number, description: string) {
  await BillingEngine.recharge({ userId, credits, amountEur: credits / 1000, description, generateInvoice: false });
  return BillingEngine.getWallet(userId);
}

/** @deprecated Use BillingEngine.chargeUsage */
export async function deductCredits(userId: string, credits: number, description: string) {
  const { prisma } = await import("./prisma");
  return prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.findUnique({ where: { userId } });
    if (!balance || balance.credits < credits) throw new Error("Insufficient credits");
    await tx.creditBalance.update({ where: { userId }, data: { credits: { decrement: credits } } });
    await tx.transaction.create({ data: { userId, type: "USAGE", amount: credits, description } });
    return balance;
  });
}
