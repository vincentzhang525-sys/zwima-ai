import { createHash, randomBytes } from "crypto";

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

export async function addCredits(userId: string, credits: number, description: string) {
  const { prisma } = await import("./prisma");

  return prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.upsert({
      where: { userId },
      create: { userId, credits },
      update: { credits: { increment: credits } },
    });

    await tx.transaction.create({
      data: { userId, type: "RECHARGE", amount: credits, description },
    });

    return balance;
  });
}

export async function deductCredits(userId: string, credits: number, description: string) {
  const { prisma } = await import("./prisma");

  return prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.findUnique({ where: { userId } });
    if (!balance || balance.credits < credits) {
      throw new Error("Insufficient credits");
    }

    const updated = await tx.creditBalance.update({
      where: { userId },
      data: { credits: { decrement: credits } },
    });

    await tx.transaction.create({
      data: { userId, type: "DEBIT", amount: credits, description },
    });

    return updated;
  });
}
