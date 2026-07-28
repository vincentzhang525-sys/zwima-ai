/**
 * Atomic credit debit helpers (GAP-004).
 * Conditional UPDATE prevents overdraft under concurrent charges.
 */

import type { Prisma } from "@prisma/client";

/** Returns true when the debit applied; false when available credits were insufficient. */
export async function atomicDebitAvailableCredits(
  tx: Prisma.TransactionClient,
  userId: string,
  credits: number,
): Promise<boolean> {
  if (!Number.isFinite(credits) || credits < 0) {
    throw new Error("Invalid debit amount");
  }
  if (credits === 0) return true;

  const affected = await tx.$executeRaw`
    UPDATE "CreditBalance"
    SET
      "credits" = "credits" - ${credits},
      "lifetimeSpend" = "lifetimeSpend" + ${credits},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${userId}
      AND ("credits" - "frozenCredits") >= ${credits}
  `;

  return Number(affected) > 0;
}

/**
 * Pure concurrency model for tests: N workers each try to debit `cost` from a shared balance.
 * Only CAS-style success counts — mirrors SQL conditional UPDATE semantics.
 */
export function simulateConcurrentAtomicDebits(params: {
  startingAvailable: number;
  cost: number;
  attempts: number;
}): { successes: number; finalBalance: number; overdraft: boolean } {
  let balance = params.startingAvailable;
  let successes = 0;
  for (let i = 0; i < params.attempts; i++) {
    if (balance >= params.cost) {
      balance -= params.cost;
      successes += 1;
    }
  }
  return {
    successes,
    finalBalance: balance,
    overdraft: balance < 0,
  };
}

export function maxSuccessfulDebits(startingAvailable: number, cost: number): number {
  if (cost <= 0) return 0;
  return Math.floor(startingAvailable / cost);
}
