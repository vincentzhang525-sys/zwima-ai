/**
 * M4 FX — package expected margin recalculation + alert thresholds.
 * Never auto-changes customer list prices.
 */
import type { FxMarginStatus } from "@prisma/client";
import { D, dAdd, dMul, dSub, pctChange, safeMarginRate } from "./decimal-money";
import {
  CRITICAL_GROSS_MARGIN_RATE,
  FX_REPRICE_REVIEW_THRESHOLD,
  FX_WARNING_THRESHOLD,
  MIN_TARGET_GROSS_MARGIN_RATE,
  type PackageMarginEstimate,
  type ProviderMixLeg,
} from "./types";
import { resolveFxBufferRate, type FxBufferPolicyRow } from "./fx-buffer-policy";
import type { FxRateLookupResult } from "./types";
import { isMissingRate } from "./fx-rate-provider";

export type MixRateMap = Record<string, FxRateLookupResult | { status: "MISSING" }>;

export function estimatePackageMargin(params: {
  revenueEur: string;
  legs: ProviderMixLeg[];
  ratesByCurrency: MixRateMap;
  policies: FxBufferPolicyRow[];
  pricingFxRate?: string | null;
  /** Primary currency used for package pricing FX comparison (e.g. USD). */
  comparisonCurrency?: string;
}): PackageMarginEstimate {
  const revenueEur = D(params.revenueEur);
  let expectedCostEur = D(0);
  let expectedBufferedCostEur = D(0);
  let anyMissing = false;

  for (const leg of params.legs) {
    const currency = leg.currency.toUpperCase();
    const weight = D(leg.weight ?? "1");
    const costPc = dMul(leg.costInProviderCurrency, weight);
    const rateResult = params.ratesByCurrency[currency];

    if (!rateResult || isMissingRate(rateResult)) {
      anyMissing = true;
      continue;
    }

    const costEur = dMul(costPc, rateResult.rate);
    const { bufferRate } = resolveFxBufferRate({
      currency,
      providerId: leg.providerId,
      policies: params.policies,
    });
    const buffered = dAdd(costEur, dMul(costEur, bufferRate));
    expectedCostEur = dAdd(expectedCostEur, costEur);
    expectedBufferedCostEur = dAdd(expectedBufferedCostEur, buffered);
  }

  if (anyMissing) {
    return {
      revenueEur,
      expectedCostEur,
      expectedBufferedCostEur,
      expectedGrossMarginEur: dSub(revenueEur, expectedBufferedCostEur),
      expectedGrossMarginRate: null,
      marginStatus: "FX_RATE_MISSING",
      pricingFxRate: params.pricingFxRate != null ? D(params.pricingFxRate) : null,
      currentFxRate: null,
      fxChangePct: null,
    };
  }

  const expectedGrossMarginEur = dSub(revenueEur, expectedBufferedCostEur);
  const expectedGrossMarginRate = safeMarginRate(expectedGrossMarginEur, revenueEur);

  const comparisonCurrency = (params.comparisonCurrency ?? "USD").toUpperCase();
  const current = params.ratesByCurrency[comparisonCurrency];
  const currentFxRate =
    current && !isMissingRate(current) ? current.rate : null;
  const pricingFxRate = params.pricingFxRate != null ? D(params.pricingFxRate) : null;
  const fxChangePct =
    pricingFxRate && currentFxRate ? pctChange(pricingFxRate, currentFxRate) : null;

  const marginStatus = classifyMarginStatus({
    marginRate: expectedGrossMarginRate,
    fxChangePct,
    fxMissing: false,
  });

  return {
    revenueEur,
    expectedCostEur,
    expectedBufferedCostEur,
    expectedGrossMarginEur,
    expectedGrossMarginRate,
    marginStatus,
    pricingFxRate,
    currentFxRate,
    fxChangePct,
  };
}

export function classifyMarginStatus(params: {
  marginRate: ReturnType<typeof D> | null;
  fxChangePct: ReturnType<typeof D> | null;
  fxMissing: boolean;
}): FxMarginStatus {
  if (params.fxMissing) return "FX_RATE_MISSING";

  if (params.marginRate != null) {
    if (params.marginRate.lessThan(0) || params.marginRate.lessThanOrEqualTo(D(CRITICAL_GROSS_MARGIN_RATE))) {
      return "CRITICAL";
    }
  }

  if (params.fxChangePct != null && params.fxChangePct.greaterThanOrEqualTo(D(FX_REPRICE_REVIEW_THRESHOLD))) {
    return "REPRICE_REVIEW_REQUIRED";
  }

  if (params.marginRate != null && params.marginRate.lessThan(D(MIN_TARGET_GROSS_MARGIN_RATE))) {
    return "WARNING";
  }

  if (params.fxChangePct != null && params.fxChangePct.greaterThanOrEqualTo(D(FX_WARNING_THRESHOLD))) {
    return "WARNING";
  }

  return "HEALTHY";
}

/** Explicit: customer prices are never auto-updated by margin engine. */
export function shouldAutoUpdateCustomerPrice(): false {
  return false;
}
