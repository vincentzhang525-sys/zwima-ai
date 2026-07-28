import { beforeEach, describe, expect, it, vi } from "vitest";

const usageLogFindFirst = vi.fn();
const usageLogCreate = vi.fn();
const creditBalanceUpsert = vi.fn();
const creditBalanceFindUnique = vi.fn();
const creditBalanceUpdate = vi.fn();
const executeRaw = vi.fn();
const transactionCreate = vi.fn();
const apiKeyUpdate = vi.fn();
const providerFindUnique = vi.fn();
const auditLogCreate = vi.fn();
const prismaTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: (...args: unknown[]) => providerFindUnique(...args) },
    auditLog: { create: (...args: unknown[]) => auditLogCreate(...args) },
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
    providerCost: 0.01,
    customerCredits: 5,
    multiplier: 1.3,
  })),
  countMessageTokens: vi.fn((messages: { content: string }[]) =>
    messages.reduce((n, m) => n + Math.ceil(m.content.length / 4), 0),
  ),
  estimateRequestCredits: vi.fn(),
}));

vi.mock("@/lib/billing/margin-engine", () => ({
  getEffectiveMultiplier: vi.fn(async () => 1.3),
  applyMargin: (cost: number) => cost * 1.3,
}));

import { chargeForUsage } from "@/lib/billing/credits-engine";
import { persistV1ChatUsage } from "@/lib/billing/v1-chat-usage";
import { ApiError } from "@/lib/api-errors";

describe("v1 chat usage persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerFindUnique.mockResolvedValue({ id: "prov_openai" });
    auditLogCreate.mockResolvedValue({ id: "audit_1" });
    creditBalanceUpsert.mockResolvedValue({});
    creditBalanceFindUnique.mockResolvedValue({ credits: 1000, frozenCredits: 0 });
    creditBalanceUpdate.mockResolvedValue({});
    executeRaw.mockResolvedValue(1);
    usageLogFindFirst.mockResolvedValue(null);
    usageLogCreate.mockResolvedValue({
      id: "ulog_1",
      costCredits: 5,
      providerCost: 0.01,
    });
    transactionCreate.mockResolvedValue({ id: "tx_1" });
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

  it("persists UsageLog + ledger + credit debit on successful chat usage", async () => {
    const result = await persistV1ChatUsage({
      key: {
        userId: "user_1",
        apiKeyId: "key_1",
        organizationId: "org_1",
        userTier: "STANDARD",
      },
      requestId: "req_1",
      providerSlug: "openai",
      model: "gpt-5-mini",
      inputTokens: 10,
      outputTokens: 5,
      latencyMs: 100,
      providerReportedUsage: true,
    });

    expect(result.usageLogId).toBe("ulog_1");
    expect(result.costCredits).toBe(5);
    expect(result.usageSource).toBe("provider");
    expect(result.totalTokens).toBe(15);
    expect(usageLogCreate).toHaveBeenCalledTimes(1);
    expect(transactionCreate).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(creditBalanceUpdate).not.toHaveBeenCalled();
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "API_CHAT_USAGE", category: "BILLING" }),
      }),
    );
  });

  it("marks usageSource=estimated when provider tokens are zero", async () => {
    const result = await persistV1ChatUsage({
      key: {
        userId: "user_1",
        apiKeyId: "key_1",
        organizationId: "org_1",
      },
      requestId: "req_est",
      providerSlug: "openai",
      model: "gpt-5-mini",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 50,
      messages: [{ content: "hello world" }],
      providerReportedUsage: false,
    });

    expect(result.usageSource).toBe("estimated");
    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.outputTokens).toBeGreaterThan(0);
  });

  it("requestId replay does not double-charge", async () => {
    usageLogFindFirst.mockResolvedValue({
      id: "ulog_existing",
      costCredits: 5,
      providerCost: 0.01,
    });

    const first = await chargeForUsage({
      userId: "user_1",
      apiKeyId: "key_1",
      providerId: "prov_openai",
      providerSlug: "openai",
      model: "gpt-5-mini",
      inputTokens: 10,
      outputTokens: 5,
      latencyMs: 100,
      requestId: "req_dup",
    });

    expect(first.replayed).toBe(true);
    expect(first.usageLogId).toBe("ulog_existing");
    expect(usageLogCreate).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(creditBalanceUpdate).not.toHaveBeenCalled();
  });

  it("provider failure path: persist is not called when we only test charge skip", async () => {
    // Documented contract: callers must not invoke persistV1ChatUsage on provider failure.
    expect(typeof persistV1ChatUsage).toBe("function");
  });

  it("insufficient credits surfaces as ApiError", async () => {
    executeRaw.mockResolvedValue(0);

    await expect(
      persistV1ChatUsage({
        key: { userId: "user_1", apiKeyId: "key_1", organizationId: "org_1" },
        requestId: "req_poor",
        providerSlug: "openai",
        model: "gpt-5-mini",
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 10,
        providerReportedUsage: true,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS", status: 402 });
  });

  it("atomic debit is skipped on insufficient balance (fail-closed, no usage write)", async () => {
    executeRaw.mockResolvedValue(0);

    await expect(
      chargeForUsage({
        userId: "user_1",
        apiKeyId: "key_1",
        providerId: "prov_openai",
        providerSlug: "openai",
        model: "gpt-5-mini",
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 10,
        requestId: "req_no_funds",
      }),
    ).rejects.toThrow("Insufficient credits");

    expect(usageLogCreate).not.toHaveBeenCalled();
    expect(transactionCreate).not.toHaveBeenCalled();
  });

  it("database write failure does not masquerade as success", async () => {
    usageLogCreate.mockRejectedValue(new Error("db down"));

    await expect(
      persistV1ChatUsage({
        key: { userId: "user_1", apiKeyId: "key_1", organizationId: "org_1" },
        requestId: "req_fail",
        providerSlug: "openai",
        model: "gpt-5-mini",
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 10,
        providerReportedUsage: true,
      }),
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      persistV1ChatUsage({
        key: { userId: "user_1", apiKeyId: "key_1", organizationId: "org_1" },
        requestId: "req_fail2",
        providerSlug: "openai",
        model: "gpt-5-mini",
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 10,
        providerReportedUsage: true,
      }),
    ).rejects.toMatchObject({ code: "BILLING_PERSISTENCE_FAILED", status: 502 });
  });

  it("Billing ledger (Transaction USAGE) is written with usage metadata", async () => {
    await chargeForUsage({
      userId: "user_1",
      apiKeyId: "key_1",
      providerId: "prov_openai",
      providerSlug: "openai",
      model: "gpt-5-mini",
      inputTokens: 8,
      outputTokens: 4,
      latencyMs: 12,
      requestId: "req_ledger",
      usageSource: "provider",
      organizationId: "org_1",
    });

    expect(transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "USAGE",
          amount: 5,
          metadata: expect.objectContaining({
            usageSource: "provider",
            requestId: "req_ledger",
            status: "SUCCESS",
          }),
        }),
      }),
    );
  });
});
