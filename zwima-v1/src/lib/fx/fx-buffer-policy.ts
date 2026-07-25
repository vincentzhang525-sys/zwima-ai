/**
 * M4 FX — buffer policy resolution.
 * Priority: provider-specific → currency-specific → system default.
 */
import type { Decimal } from "@prisma/client/runtime/library";
import { D } from "./decimal-money";
import { DEFAULT_FX_BUFFER_RATES } from "./types";

export type FxBufferPolicyRow = {
  providerId: string | null;
  currency: string | null;
  bufferRate: Decimal | string;
  minimumBufferRate?: Decimal | string | null;
  maximumBufferRate?: Decimal | string | null;
  enabled: boolean;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
};

function inWindow(row: FxBufferPolicyRow, at: Date): boolean {
  if (!row.enabled) return false;
  if (row.effectiveFrom && at < row.effectiveFrom) return false;
  if (row.effectiveTo && at > row.effectiveTo) return false;
  return true;
}

function clamp(rate: Decimal, min?: Decimal | string | null, max?: Decimal | string | null): Decimal {
  let r = rate;
  if (min != null && min !== "") {
    const m = D(min);
    if (r.lessThan(m)) r = m;
  }
  if (max != null && max !== "") {
    const x = D(max);
    if (r.greaterThan(x)) r = x;
  }
  return r;
}

export function systemDefaultBufferRate(currency: string): Decimal {
  const c = currency.toUpperCase();
  return D(DEFAULT_FX_BUFFER_RATES[c] ?? DEFAULT_FX_BUFFER_RATES.DEFAULT);
}

export function resolveFxBufferRate(params: {
  currency: string;
  providerId?: string | null;
  policies: FxBufferPolicyRow[];
  at?: Date;
}): { bufferRate: Decimal; source: "provider" | "currency" | "system_default" } {
  const at = params.at ?? new Date();
  const currency = params.currency.toUpperCase();
  const active = params.policies.filter((p) => inWindow(p, at));

  if (params.providerId) {
    const providerHit = active.find(
      (p) =>
        p.providerId === params.providerId &&
        (p.currency == null || p.currency.toUpperCase() === currency),
    );
    if (providerHit) {
      return {
        bufferRate: clamp(D(providerHit.bufferRate), providerHit.minimumBufferRate, providerHit.maximumBufferRate),
        source: "provider",
      };
    }
  }

  const currencyHit = active.find((p) => p.providerId == null && p.currency?.toUpperCase() === currency);
  if (currencyHit) {
    return {
      bufferRate: clamp(D(currencyHit.bufferRate), currencyHit.minimumBufferRate, currencyHit.maximumBufferRate),
      source: "currency",
    };
  }

  return { bufferRate: systemDefaultBufferRate(currency), source: "system_default" };
}
