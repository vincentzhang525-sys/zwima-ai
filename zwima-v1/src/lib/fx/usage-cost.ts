/**
 * M4 FX — unified cost / margin formulas (Decimal only).
 */
import type { FxRateStatus } from "@prisma/client";
import { D, dAdd, dIsZero, dMul, dSub, safeMarginRate } from "./decimal-money";
import type { UsageFxCostInput, UsageFxCostResult } from "./types";

export function fxRatePair(base: string, quote = "EUR"): string {
  return `${base.toUpperCase()}/${quote.toUpperCase()}`;
}

/**
 * Pure conversion + margin. Does not fetch FX.
 * When fxRateStatus is MISSING or rate is null → cost_in_eur stays null; margin not finalized.
 */
export function computeUsageFxCost(input: UsageFxCostInput): UsageFxCostResult {
  const providerCurrency = input.providerCurrency.toUpperCase();
  const costInProviderCurrency = D(input.costInProviderCurrency);
  const revenueEur = D(input.revenueEur);
  const fxBufferRate = D(input.fxBufferRate);
  const pair = input.fxRatePair ?? fxRatePair(providerCurrency);

  const missing =
    input.fxRateStatus === "MISSING" ||
    input.fxRateAtUsage == null ||
    (typeof input.fxRateAtUsage === "string" && input.fxRateAtUsage.trim() === "");

  if (missing) {
    return {
      providerCurrency,
      fxRateAtUsage: null,
      costInProviderCurrency,
      costInEur: null,
      fxBufferRate,
      fxBuffer: null,
      bufferedCostEur: null,
      revenueEur,
      grossMarginEur: null,
      grossMarginRate: null,
      fxRateStatus: "MISSING",
      fxRateSource: input.fxRateSource ?? null,
      fxRateTimestamp: input.fxRateTimestamp ?? null,
      fxRateDate: input.fxRateDate ?? null,
      fxRatePair: pair,
      marginFinalized: false,
    };
  }

  const fxRateAtUsage = D(input.fxRateAtUsage!);
  // Explicit rule: never silent 1:1 for non-EUR unless rate was intentionally EUR/EUR = 1
  if (providerCurrency !== "EUR" && fxRateAtUsage.eq(1) && input.fxRateStatus === "MISSING") {
    // unreachable due to missing branch; kept for clarity
  }

  const costInEur = dMul(costInProviderCurrency, fxRateAtUsage);
  const fxBuffer = dMul(costInEur, fxBufferRate);
  const bufferedCostEur = dAdd(costInEur, fxBuffer);
  const grossMarginEur = dSub(revenueEur, bufferedCostEur);
  const grossMarginRate = safeMarginRate(grossMarginEur, revenueEur);

  return {
    providerCurrency,
    fxRateAtUsage,
    costInProviderCurrency,
    costInEur,
    fxBufferRate,
    fxBuffer,
    bufferedCostEur,
    revenueEur,
    grossMarginEur,
    grossMarginRate,
    fxRateStatus: input.fxRateStatus,
    fxRateSource: input.fxRateSource ?? null,
    fxRateTimestamp: input.fxRateTimestamp ?? null,
    fxRateDate: input.fxRateDate ?? null,
    fxRatePair: pair,
    marginFinalized: true,
  };
}

/** EUR provider shortcut: rate = 1, pair EUR/EUR. */
export function eurIdentityRateStatus(): { rate: string; status: FxRateStatus; pair: string } {
  return { rate: "1", status: "LIVE", pair: "EUR/EUR" };
}

export function assertHistoricalCostImmutable(params: {
  existingCostInEur: string | null | undefined;
  attemptedNewCostInEur: string;
}): void {
  if (params.existingCostInEur == null || params.existingCostInEur === "") return;
  if (!D(params.existingCostInEur).eq(D(params.attemptedNewCostInEur))) {
    throw new Error("FX_SNAPSHOT_IMMUTABLE: historical cost_in_eur must not be overwritten");
  }
}

export function computeRefundMarginReversal(params: {
  originalRevenueEur: string;
  originalBufferedCostEur: string;
  refundRevenueEur: string;
}): {
  revenueEur: string;
  bufferedCostEur: string;
  grossMarginEur: string;
  grossMarginRate: string | null;
} {
  // Full refund of revenue; cost typically stays (provider already charged) unless ops reverses cost separately.
  const revenue = dSub(params.originalRevenueEur, params.refundRevenueEur);
  const buffered = D(params.originalBufferedCostEur);
  const margin = dSub(revenue, buffered);
  const rate = dIsZero(revenue) ? null : safeMarginRate(margin, revenue);
  return {
    revenueEur: revenue.toFixed(8),
    bufferedCostEur: buffered.toFixed(8),
    grossMarginEur: margin.toFixed(8),
    grossMarginRate: rate ? rate.toFixed(8) : null,
  };
}
