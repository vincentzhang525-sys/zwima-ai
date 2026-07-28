/**
 * GAP-016 — FX billing hot path unit tests (no real Provider / Stripe / DB).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

const usageLogFindFirst = vi.fn();
const usageLogCreate = vi.fn();
const creditBalanceUpsert = vi.fn();
const creditBalanceFindUnique = vi.fn();
const creditBalanceUpdate = vi.fn();
const executeRaw = vi.fn();
const transactionCreate = vi.fn();
const apiKeyUpdate = vi.fn();
const providerFindUnique = vi.fn();
const fxBufferPolicyFindMany = vi.fn();
const prismaTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: (...args: unknown[]) => providerFindUnique(...args) },
    fxBufferPolicy: { findMany: (...args: unknown[]) => fxBufferPolicyFindMany(...args) },
    usageLog: {
      findFirst: (...args: unknown[]) => usageLogFindFirst(...args),
      create: (...args: unknown[]) => usageLogCreate(...args),
    },
    creditBalance: {
      upsert: (...args: unknown[]) => creditBalanceUpsert(...args),
      findUnique: (...args: unknown[]) => creditBalanceFindUnique(...args),
      update: (...args: unknown[]) => creditBalanceUpdate(...args),
    },
    transaction: { create: (...args: unknown[]) => transactionCreate(...args) },
    apiKey: { update: (...args: unknown[]) => apiKeyUpdate(...args) },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => prismaTransaction(fn),
    $executeRaw: (...args: unknown[]) => executeRaw(...args),
  },
}));

vi.mock("@/lib/billing/pricing-engine", () => ({
  calculateUsageCredits: vi.fn(async () => ({
    providerCost: 1.0,
    customerCredits: 1000,
    multiplier: 1.3,
  })),
  countMessageTokens: vi.fn(),
  estimateRequestCredits: vi.fn(),
}));

vi.mock("@/lib/billing/margin-engine", () => ({
  getEffectiveMultiplier: vi.fn(async () => 1.3),
  applyMargin: (cost: number) => cost * 1.3,
}));

import { chargeForUsage, creditsToRevenueEur } from "@/lib/billing/credits-engine";
import {
  MemoryFxRateProvider,
  assertFxRateBillable,
  buildUsageFxCost,
  computeUsageFxCost,
  FxRateUnavailableError,
  liveLookup,
} from "@/lib/fx";
import { ApiError } from "@/lib/api-errors";

function freshUsdProvider(rate = "0.92") {
  const now = new Date();
  return new MemoryFxRateProvider([
    {
      baseCurrency: "USD",
      quoteCurrency: "EUR",
      rate,
      source: "test-ecb",
      effectiveAt: now,
      fetchedAt: now,
    },
  ]);
}

describe("GAP-016 FX billing hot path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerFindUnique.mockResolvedValue({ id: "prov_1", providerCurrency: "EUR" });
    fxBufferPolicyFindMany.mockResolvedValue([]);
    creditBalanceUpsert.mockResolvedValue({});
    creditBalanceFindUnique.mockResolvedValue({ credits: 100_000, frozenCredits: 0 });
    creditBalanceUpdate.mockResolvedValue({});
    executeRaw.mockResolvedValue(1);
    usageLogFindFirst.mockResolvedValue(null);
    usageLogCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: "ulog_fx",
      costCredits: 1000,
      providerCost: 1.0,
      ...args.data,
    }));
    transactionCreate.mockResolvedValue({ id: "tx_fx" });
    apiKeyUpdate.mockResolvedValue({});
    prismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        usageLog: { findFirst: usageLogFindFirst, create: usageLogCreate },
        creditBalance: {
          upsert: creditBalanceUpsert,
          findUnique: creditBalanceFindUnique,
          update: creditBalanceUpdate,
        },
        transaction: { create: transactionCreate },
        apiKey: { update: apiKeyUpdate },
        $executeRaw: executeRaw,
      };
      return fn(tx);
    });
  });

  it("same currency (EUR) does not invent FX — identity rate 1", async () => {
    const result = await buildUsageFxCost({
      providerCurrency: "EUR",
      costInProviderCurrency: "10",
      revenueEur: "12",
      policies: [],
      rateProvider: new MemoryFxRateProvider(),
      failClosed: true,
    });
    expect(result.fxRateAtUsage?.toString()).toBe("1");
    expect(result.fxRatePair).toBe("EUR/EUR");
    expect(result.costInEur?.toString()).toBe("10");
    expect(result.fxRateStatus).toBe("LIVE");
  });

  it("cross-currency converts with stored rate + buffer", async () => {
    const result = await buildUsageFxCost({
      providerCurrency: "USD",
      costInProviderCurrency: "10",
      revenueEur: "12",
      policies: [],
      rateProvider: freshUsdProvider("0.90"),
      failClosed: true,
    });
    // 10 * 0.90 = 9; buffer default USD 3% → 0.27; buffered 9.27
    expect(result.costInEur?.toFixed(2)).toBe("9.00");
    expect(result.fxBufferRate.toString()).toBe("0.03");
    expect(result.bufferedCostEur?.toFixed(2)).toBe("9.27");
    expect(result.fxRatePair).toBe("USD/EUR");
  });

  it("missing FX rate fail-closed (no invented rate)", async () => {
    await expect(
      buildUsageFxCost({
        providerCurrency: "USD",
        costInProviderCurrency: "1",
        revenueEur: "1",
        policies: [],
        rateProvider: new MemoryFxRateProvider(),
        failClosed: true,
      }),
    ).rejects.toBeInstanceOf(FxRateUnavailableError);

    expect(() => assertFxRateBillable("MISSING")).toThrow(FxRateUnavailableError);
  });

  it("stale FX rate is rejected", async () => {
    const staleFetched = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const provider = new MemoryFxRateProvider([
      {
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        rate: "0.91",
        source: "stale-feed",
        effectiveAt: staleFetched,
        fetchedAt: staleFetched,
      },
    ]);
    await expect(
      buildUsageFxCost({
        providerCurrency: "USD",
        costInProviderCurrency: "1",
        revenueEur: "1",
        policies: [],
        rateProvider: provider,
        failClosed: true,
      }),
    ).rejects.toMatchObject({ status: "STALE" });
  });

  it("rounding is Decimal-consistent between compute and build", () => {
    const rate = liveLookup("USD", "0.923456789");
    const pure = computeUsageFxCost({
      providerCurrency: "USD",
      costInProviderCurrency: "1.23456789",
      revenueEur: "2",
      fxBufferRate: "0.03",
      fxRateAtUsage: rate.rate,
      fxRateStatus: "LIVE",
      fxRatePair: "USD/EUR",
    });
    expect(pure.costInEur).toBeInstanceOf(Decimal);
    expect(pure.costInEur!.toFixed(8)).toBe(
      new Decimal("1.23456789").mul("0.923456789").toFixed(8),
    );
  });

  it("chargeForUsage persists FX snapshot + matching Transaction amountEur", async () => {
    const charged = await chargeForUsage({
      userId: "user_1",
      apiKeyId: "key_1",
      providerId: "prov_1",
      providerSlug: "openai",
      model: "gpt-5-mini",
      inputTokens: 10,
      outputTokens: 5,
      latencyMs: 20,
      requestId: "req_fx_eur",
      organizationId: "org_1",
      fxRateProvider: new MemoryFxRateProvider(),
    });

    expect(charged.costCredits).toBe(1000);
    expect(usageLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerCurrency: "EUR",
          fxRatePair: "EUR/EUR",
          fxRateStatus: "LIVE",
          costCredits: 1000,
        }),
      }),
    );
    const usageData = usageLogCreate.mock.calls[0][0].data;
    const txData = transactionCreate.mock.calls[0][0].data;
    expect(txData.amount).toBe(1000);
    expect(txData.amountEur).toBe(Number(creditsToRevenueEur(1000)));
    expect(Number(txData.metadata.costInEur)).toBe(Number(usageData.costInEur.toString()));
    expect(txData.metadata.providerCurrency).toBe(usageData.providerCurrency);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it("cross-currency charge uses injected rate provider", async () => {
    providerFindUnique.mockResolvedValue({ id: "prov_1", providerCurrency: "USD" });
    await chargeForUsage({
      userId: "user_1",
      apiKeyId: "key_1",
      providerId: "prov_1",
      providerSlug: "openai",
      model: "gpt-5-mini",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      requestId: "req_fx_usd",
      fxRateProvider: freshUsdProvider("0.85"),
    });
    const usageData = usageLogCreate.mock.calls[0][0].data;
    expect(usageData.providerCurrency).toBe("USD");
    expect(usageData.fxRateAtUsage.toString()).toBe("0.85");
    expect(usageData.costInEur.toString()).toBe("0.85");
  });

  it("FX unavailable before debit — no UsageLog / Transaction / credit debit", async () => {
    providerFindUnique.mockResolvedValue({ id: "prov_1", providerCurrency: "USD" });
    await expect(
      chargeForUsage({
        userId: "user_1",
        apiKeyId: "key_1",
        providerId: "prov_1",
        providerSlug: "openai",
        model: "gpt-5-mini",
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 1,
        requestId: "req_fx_miss",
        fxRateProvider: new MemoryFxRateProvider(),
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(prismaTransaction).not.toHaveBeenCalled();
    expect(usageLogCreate).not.toHaveBeenCalled();
    expect(transactionCreate).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("requestId replay skips FX and does not double-charge", async () => {
    usageLogFindFirst.mockResolvedValue({
      id: "ulog_existing",
      costCredits: 1000,
      providerCost: 1.0,
    });
    const getLatest = vi.fn();
    const fx = {
      getLatestRate: getLatest,
      getRateForDate: vi.fn(),
    };

    const replayed = await chargeForUsage({
      userId: "user_1",
      apiKeyId: "key_1",
      providerId: "prov_1",
      providerSlug: "openai",
      model: "gpt-5-mini",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      requestId: "req_idem",
      fxRateProvider: fx,
    });

    expect(replayed.replayed).toBe(true);
    expect(getLatest).not.toHaveBeenCalled();
    expect(usageLogCreate).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("ledger reconciliation: costCredits === Transaction.amount === debit amount", async () => {
    await chargeForUsage({
      userId: "user_1",
      apiKeyId: "key_1",
      providerId: "prov_1",
      providerSlug: "openai",
      model: "gpt-5-mini",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      requestId: "req_recon",
      fxRateProvider: new MemoryFxRateProvider(),
    });
    const usage = usageLogCreate.mock.calls[0][0].data;
    const tx = transactionCreate.mock.calls[0][0].data;
    expect(usage.costCredits).toBe(tx.amount);
    expect(usage.costCredits).toBe(1000);
    expect(executeRaw).toHaveBeenCalled();
  });
});
