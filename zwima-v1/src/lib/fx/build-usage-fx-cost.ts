/**
 * M4 FX — build usage FX cost from provider currency + rate lookup + buffer policy.
 */
import { computeUsageFxCost } from "./usage-cost";
import { resolveFxBufferRate, type FxBufferPolicyRow } from "./fx-buffer-policy";
import {
  assertFxRateBillable,
  isMissingRate,
  resolveRateForUsage,
  type FxRateProvider,
} from "./fx-rate-provider";
import type { UsageFxCostResult } from "./types";

export async function buildUsageFxCost(params: {
  providerCurrency: string;
  costInProviderCurrency: string;
  revenueEur: string;
  providerId?: string | null;
  policies: FxBufferPolicyRow[];
  rateProvider: FxRateProvider;
  at?: Date;
  /** When true (billing hot path), MISSING/STALE throw — never invent rates. */
  failClosed?: boolean;
}): Promise<UsageFxCostResult & { fxRateSnapshotId?: string | null }> {
  const at = params.at ?? new Date();
  const currency = params.providerCurrency.toUpperCase();
  const { bufferRate } = resolveFxBufferRate({
    currency,
    providerId: params.providerId,
    policies: params.policies,
    at,
  });

  const rate = await resolveRateForUsage(params.rateProvider, currency, "EUR", at);

  if (isMissingRate(rate)) {
    if (params.failClosed) {
      assertFxRateBillable("MISSING");
    }
    return {
      ...computeUsageFxCost({
        providerCurrency: currency,
        costInProviderCurrency: params.costInProviderCurrency,
        revenueEur: params.revenueEur,
        fxBufferRate: bufferRate,
        fxRateAtUsage: null,
        fxRateStatus: "MISSING",
        fxRatePair: rate.pair,
      }),
      fxRateSnapshotId: null,
    };
  }

  if (params.failClosed) {
    assertFxRateBillable(rate.status);
  }

  return {
    ...computeUsageFxCost({
      providerCurrency: currency,
      costInProviderCurrency: params.costInProviderCurrency,
      revenueEur: params.revenueEur,
      fxBufferRate: bufferRate,
      fxRateAtUsage: rate.rate,
      fxRateStatus: rate.status,
      fxRateSource: rate.source,
      fxRateTimestamp: rate.fetchedAt,
      fxRateDate: rate.rateDate,
      fxRatePair: rate.pair,
    }),
    fxRateSnapshotId: rate.snapshotId ?? null,
  };
}
