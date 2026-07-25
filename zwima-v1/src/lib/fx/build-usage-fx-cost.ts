/**
 * M4 FX — build usage FX cost from provider currency + rate lookup + buffer policy.
 */
import { computeUsageFxCost } from "./usage-cost";
import { resolveFxBufferRate, type FxBufferPolicyRow } from "./fx-buffer-policy";
import {
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
}): Promise<UsageFxCostResult> {
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
    return computeUsageFxCost({
      providerCurrency: currency,
      costInProviderCurrency: params.costInProviderCurrency,
      revenueEur: params.revenueEur,
      fxBufferRate: bufferRate,
      fxRateAtUsage: null,
      fxRateStatus: "MISSING",
      fxRatePair: rate.pair,
    });
  }

  return computeUsageFxCost({
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
  });
}
