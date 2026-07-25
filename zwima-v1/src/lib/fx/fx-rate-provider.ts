/**
 * M4 FX — rate provider interface + in-memory / DB-backed implementations.
 * Never falls back to silent 1:1 for non-EUR.
 */
import { Decimal } from "@prisma/client/runtime/library";
import type { FxRateStatus } from "@prisma/client";
import { D } from "./decimal-money";
import { FX_STALE_AFTER_MS, type FxRateLookupResult } from "./types";
import { fxRatePair } from "./usage-cost";

export type FxRateProvider = {
  getLatestRate(baseCurrency: string, quoteCurrency?: string): Promise<FxRateLookupResult | null>;
  getRateForDate(
    baseCurrency: string,
    quoteCurrency: string,
    date: Date,
  ): Promise<FxRateLookupResult | null>;
};

export type MemoryRateRow = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  source: string;
  effectiveAt: Date;
  fetchedAt: Date;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function ageStatus(fetchedAt: Date, isFallback: boolean): FxRateStatus {
  const age = Date.now() - fetchedAt.getTime();
  if (age > FX_STALE_AFTER_MS) return "STALE";
  if (isFallback) return "FALLBACK";
  return "CACHED";
}

export function resolveEurIdentity(base: string, quote = "EUR"): FxRateLookupResult | null {
  const b = base.toUpperCase();
  const q = quote.toUpperCase();
  if (b === q && q === "EUR") {
    const now = new Date();
    return {
      rate: D(1),
      baseCurrency: "EUR",
      quoteCurrency: "EUR",
      source: "identity",
      effectiveAt: now,
      rateDate: startOfUtcDay(now),
      fetchedAt: now,
      status: "LIVE",
      isFallback: false,
      pair: fxRatePair("EUR", "EUR"),
    };
  }
  return null;
}

/** In-memory provider for tests and offline seed rates (no network). */
export class MemoryFxRateProvider implements FxRateProvider {
  constructor(private rows: MemoryRateRow[] = []) {}

  seed(row: MemoryRateRow) {
    this.rows.push(row);
  }

  async getLatestRate(baseCurrency: string, quoteCurrency = "EUR"): Promise<FxRateLookupResult | null> {
    const identity = resolveEurIdentity(baseCurrency, quoteCurrency);
    if (identity) return identity;

    const b = baseCurrency.toUpperCase();
    const q = quoteCurrency.toUpperCase();
    const matches = this.rows
      .filter((r) => r.baseCurrency.toUpperCase() === b && r.quoteCurrency.toUpperCase() === q)
      .sort((a, c) => c.effectiveAt.getTime() - a.effectiveAt.getTime());
    const hit = matches[0];
    if (!hit) return null;

    const isFallback = hit.source.startsWith("fallback");
    return {
      rate: D(hit.rate),
      baseCurrency: b,
      quoteCurrency: q,
      source: hit.source,
      effectiveAt: hit.effectiveAt,
      rateDate: startOfUtcDay(hit.effectiveAt),
      fetchedAt: hit.fetchedAt,
      status: ageStatus(hit.fetchedAt, isFallback),
      isFallback,
      pair: fxRatePair(b, q),
    };
  }

  async getRateForDate(
    baseCurrency: string,
    quoteCurrency: string,
    date: Date,
  ): Promise<FxRateLookupResult | null> {
    const identity = resolveEurIdentity(baseCurrency, quoteCurrency);
    if (identity) return identity;

    const b = baseCurrency.toUpperCase();
    const q = quoteCurrency.toUpperCase();
    const day = startOfUtcDay(date).getTime();
    const matches = this.rows
      .filter(
        (r) =>
          r.baseCurrency.toUpperCase() === b &&
          r.quoteCurrency.toUpperCase() === q &&
          startOfUtcDay(r.effectiveAt).getTime() <= day,
      )
      .sort((a, c) => c.effectiveAt.getTime() - a.effectiveAt.getTime());
    const hit = matches[0];
    if (!hit) return null;
    const isFallback = hit.source.startsWith("fallback");
    return {
      rate: D(hit.rate),
      baseCurrency: b,
      quoteCurrency: q,
      source: hit.source,
      effectiveAt: hit.effectiveAt,
      rateDate: startOfUtcDay(hit.effectiveAt),
      fetchedAt: hit.fetchedAt,
      status: ageStatus(hit.fetchedAt, isFallback),
      isFallback,
      pair: fxRatePair(b, q),
    };
  }
}

/**
 * Resolve rate for usage: LIVE/CACHED/FALLBACK/STALE or MISSING.
 * Never invents 1:1 for non-EUR.
 */
export async function resolveRateForUsage(
  provider: FxRateProvider,
  baseCurrency: string,
  quoteCurrency = "EUR",
  at: Date = new Date(),
): Promise<FxRateLookupResult | { status: "MISSING"; pair: string; baseCurrency: string; quoteCurrency: string }> {
  const b = baseCurrency.toUpperCase();
  const q = quoteCurrency.toUpperCase();
  const pair = fxRatePair(b, q);

  const identity = resolveEurIdentity(b, q);
  if (identity) return identity;

  const dated = await provider.getRateForDate(b, q, at);
  if (dated) return dated;

  const latest = await provider.getLatestRate(b, q);
  if (latest) {
    return {
      ...latest,
      status: latest.status === "STALE" ? "STALE" : "FALLBACK",
      isFallback: true,
    };
  }

  return { status: "MISSING", pair, baseCurrency: b, quoteCurrency: q };
}

export function isMissingRate(
  result: FxRateLookupResult | { status: "MISSING" },
): result is { status: "MISSING" } {
  return result.status === "MISSING";
}

export function missingLookup(base: string, quote = "EUR") {
  return {
    status: "MISSING" as const,
    pair: fxRatePair(base, quote),
    baseCurrency: base.toUpperCase(),
    quoteCurrency: quote.toUpperCase(),
  };
}

/** Helper for tests: build LIVE lookup */
export function liveLookup(base: string, rate: string, quote = "EUR"): FxRateLookupResult {
  const now = new Date();
  return {
    rate: new Decimal(rate),
    baseCurrency: base.toUpperCase(),
    quoteCurrency: quote.toUpperCase(),
    source: "test-live",
    effectiveAt: now,
    rateDate: startOfUtcDay(now),
    fetchedAt: now,
    status: "LIVE",
    isFallback: false,
    pair: fxRatePair(base, quote),
  };
}
