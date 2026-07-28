import type { FxMarginStatus, FxRateStatus } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

export const FX_WARNING_THRESHOLD = "0.02";
export const FX_REPRICE_REVIEW_THRESHOLD = "0.05";
export const MIN_TARGET_GROSS_MARGIN_RATE = "0.20";
export const CRITICAL_GROSS_MARGIN_RATE = "0.05";
export const FX_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** System default buffer rates by currency (overridable via FxBufferPolicy). */
export const DEFAULT_FX_BUFFER_RATES: Record<string, string> = {
  EUR: "0",
  USD: "0.03",
  GBP: "0.03",
  CNY: "0.04",
  DEFAULT: "0.05",
};

export type FxRateLookupResult = {
  rate: Decimal;
  baseCurrency: string;
  quoteCurrency: string;
  source: string;
  effectiveAt: Date;
  rateDate: Date;
  fetchedAt: Date;
  status: FxRateStatus;
  isFallback: boolean;
  pair: string;
  /** Optional FxRateSnapshot.id when loaded from DB */
  snapshotId?: string;
};

export type UsageFxCostInput = {
  providerCurrency: string;
  costInProviderCurrency: Decimal | string;
  revenueEur: Decimal | string;
  fxBufferRate: Decimal | string;
  fxRateAtUsage: Decimal | string | null;
  fxRateStatus: FxRateStatus;
  fxRateSource?: string | null;
  fxRateTimestamp?: Date | null;
  fxRateDate?: Date | null;
  fxRatePair?: string | null;
};

export type UsageFxCostResult = {
  providerCurrency: string;
  fxRateAtUsage: Decimal | null;
  costInProviderCurrency: Decimal;
  costInEur: Decimal | null;
  fxBufferRate: Decimal;
  fxBuffer: Decimal | null;
  bufferedCostEur: Decimal | null;
  revenueEur: Decimal;
  grossMarginEur: Decimal | null;
  grossMarginRate: Decimal | null;
  fxRateStatus: FxRateStatus;
  fxRateSource: string | null;
  fxRateTimestamp: Date | null;
  fxRateDate: Date | null;
  fxRatePair: string;
  marginFinalized: boolean;
};

export type PackageMarginEstimate = {
  revenueEur: Decimal;
  expectedCostEur: Decimal;
  expectedBufferedCostEur: Decimal;
  expectedGrossMarginEur: Decimal;
  expectedGrossMarginRate: Decimal | null;
  marginStatus: FxMarginStatus;
  pricingFxRate: Decimal | null;
  currentFxRate: Decimal | null;
  fxChangePct: Decimal | null;
};

export type ProviderMixLeg = {
  providerId?: string;
  providerSlug?: string;
  currency: string;
  costInProviderCurrency: string;
  weight?: string;
};
