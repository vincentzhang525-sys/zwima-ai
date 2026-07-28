/**
 * GAP-015 — Multi-provider readiness gate tests (no live HTTP / no spend).
 */
import { describe, expect, it } from "vitest";
import { getAdapter, getAllAdapters } from "@/lib/providers/registry";
import {
  FOCUS_PROVIDER_CATALOG,
  assertAdapterContract,
  assertBillingHotPathPreserved,
  assertFxHotPathReused,
  assertMissingKeyFailClosed,
  assessAllProviderReadiness,
  assessProviderReadiness,
  filterRoutableProviders,
  normalizeRawProviderUsage,
  normalizeUsageForBilling,
  registryHasFiveFocusProviders,
} from "@/lib/providers/provider-readiness";
import {
  classifyProviderError,
  redactProviderSecrets,
  safeProviderLogMessage,
  toCustomerProviderError,
} from "@/lib/providers/provider-errors";
import { REQUIRED_ADAPTER_METHODS } from "@/lib/providers/contracts";

const emptyEnv = () => undefined;

describe("GAP-015 provider registry", () => {
  it("registers five focus providers in lib adapter registry", () => {
    expect(registryHasFiveFocusProviders()).toBe(true);
    expect(getAllAdapters().map((a) => a.slug).sort()).toEqual([
      "claude",
      "deepseek",
      "gemini",
      "openai",
      "qwen",
    ]);
  });
});

describe("GAP-015 adapter contracts", () => {
  for (const entry of FOCUS_PROVIDER_CATALOG) {
    it(`${entry.id} adapter satisfies unified contract`, () => {
      const adapter = getAdapter(entry.adapterSlug);
      expect(adapter).toBeTruthy();
      const result = assertAdapterContract(adapter!);
      expect(result.ok).toBe(true);
      expect(result.missing).toEqual([]);
      expect(adapter!.models().length).toBeGreaterThan(0);
      expect(typeof adapter!.estimateCost(10, 10, adapter!.models()[0]!.id)).toBe("number");
      for (const method of REQUIRED_ADAPTER_METHODS) {
        expect(adapter).toHaveProperty(method);
      }
    });
  }
});

describe("GAP-015 fail-closed & routing filter", () => {
  it("missing-key fail-closed for each adapter (no fake success)", async () => {
    for (const entry of FOCUS_PROVIDER_CATALOG) {
      const adapter = getAdapter(entry.adapterSlug)!;
      const result = await assertMissingKeyFailClosed(adapter, emptyEnv, entry.envKeyName);
      expect(result.threw).toBe(true);
      expect(result.customerSafe).toBe(true);
    }
  });

  it("disabled provider is excluded from routable set", () => {
    const reports = assessAllProviderReadiness({
      readEnv: emptyEnv,
      statusOverrides: { openai: "DISABLED", gemini: "DISABLED", claude: "DISABLED", deepseek: "DISABLED", qwen: "DISABLED" },
    });
    const filtered = filterRoutableProviders(reports);
    expect(filtered.eligible).toEqual([]);
    expect(filtered.failClosed).toBe(true);
    expect(filtered.errorCode).toBe("NO_ROUTABLE_PROVIDER");
    expect(reports.every((r) => r.exclusionReasons.includes("provider_disabled") || r.status === "DISABLED")).toBe(
      true,
    );
  });

  it("unavailable provider is excluded", () => {
    const reports = assessAllProviderReadiness({
      readEnv: (name) => (name === "OPENAI_API_KEY" ? "present" : undefined),
      statusOverrides: { openai: "UNAVAILABLE" },
    });
    const openai = reports.find((r) => r.id === "openai")!;
    expect(openai.fullyRoutable).toBe(false);
    expect(openai.exclusionReasons).toContain("provider_unavailable");
  });

  it("no-routable-provider fail-closed when keys absent", () => {
    const filtered = filterRoutableProviders(assessAllProviderReadiness({ readEnv: emptyEnv }));
    expect(filtered.eligible).toEqual([]);
    expect(filtered.failClosed).toBe(true);
    expect(filtered.errorCode).toBe("NO_ROUTABLE_PROVIDER");
  });

  it("configured ACTIVE providers with compliance enter eligible set", () => {
    const readEnv = (name: string) =>
      [
        "OPENAI_API_KEY",
        "GEMINI_API_KEY",
        "ANTHROPIC_API_KEY",
        "DEEPSEEK_API_KEY",
        "QWEN_API_KEY",
      ].includes(name)
        ? "configured"
        : undefined;
    const filtered = filterRoutableProviders(assessAllProviderReadiness({ readEnv }));
    expect(filtered.failClosed).toBe(false);
    expect(filtered.eligible.sort()).toEqual(["claude", "deepseek", "gemini", "openai", "qwen"]);
  });
});

describe("GAP-015 readiness verdicts", () => {
  it("OpenAI is PASS with historical evidence without requiring live re-spend", () => {
    const report = assessProviderReadiness(FOCUS_PROVIDER_CATALOG[0]!, { readEnv: emptyEnv });
    expect(report.id).toBe("openai");
    expect(report.historicalLiveEvidence).toBe(true);
    expect(report.contractOk).toBe(true);
    expect(report.verdict).toBe("PASS");
    expect(report.fullyRoutable).toBe(false); // key absent → not live-routable
  });

  it("non-OpenAI providers are PASS_OR_CONFIG_PENDING without keys", () => {
    for (const entry of FOCUS_PROVIDER_CATALOG.filter((e) => e.id !== "openai")) {
      const report = assessProviderReadiness(entry, { readEnv: emptyEnv });
      expect(report.verdict).toBe("PASS_OR_CONFIG_PENDING");
      expect(report.status).toBe("CONFIG_PENDING");
    }
  });

  it("requires compliance metadata for full routability", () => {
    const reports = assessAllProviderReadiness({
      readEnv: () => "configured",
    });
    expect(reports.every((r) => r.complianceComplete)).toBe(true);
  });
});

describe("GAP-015 usage / error / timeout / rate-limit normalization", () => {
  it("normalizes ChatResult into billing usage fields", () => {
    const usage = normalizeUsageForBilling("openai", {
      model: "gpt-5-mini",
      inputTokens: 12,
      outputTokens: 3,
      latencyMs: 40,
    });
    expect(usage).toEqual({
      providerSlug: "openai",
      model: "gpt-5-mini",
      inputTokens: 12,
      outputTokens: 3,
      latencyMs: 40,
      usageSource: "provider",
    });
  });

  it("normalizes raw OpenAI-style and Gemini-style usage objects", () => {
    expect(
      normalizeRawProviderUsage("openai", "gpt-5-mini", { prompt_tokens: 5, completion_tokens: 7 }, 10),
    ).toMatchObject({ inputTokens: 5, outputTokens: 7, latencyMs: 10 });
    expect(
      normalizeRawProviderUsage(
        "gemini",
        "gemini-2.5-flash",
        { promptTokenCount: 9, candidatesTokenCount: 2 },
        11,
      ),
    ).toMatchObject({ inputTokens: 9, outputTokens: 2 });
  });

  it("maps rate-limit / timeout / auth errors to stable customer codes", () => {
    expect(classifyProviderError(new Error("HTTP 429 rate limit"))).toBe("rate_limited");
    expect(classifyProviderError(new Error("request timeout"))).toBe("timeout");
    expect(classifyProviderError(new Error("OPENAI_API_KEY not configured"))).toBe("invalid_api_key");
    const customer = toCustomerProviderError(new Error("upstream 503 overloaded sk-live_abcdefghijklmnop"));
    expect(customer.code).toBe("provider_unavailable");
    expect(customer.message).toBe("Provider is temporarily unavailable");
    expect(customer.message).not.toMatch(/sk-live/);
  });

  it("redacts secrets from provider log lines", () => {
    const line = safeProviderLogMessage(new Error("boom sk-live_abcdefghijklmnop and Bearer aaa.bbb.ccc"));
    expect(line).not.toMatch(/sk-live_/);
    expect(line).not.toMatch(/Bearer\s+aaa/);
    expect(redactProviderSecrets("postgres://u:p@host/db")).toMatch(/REDACTED/);
  });
});

describe("GAP-015 billing + FX hot path reuse", () => {
  it("preserves chargeForUsage billing hot path", () => {
    expect(assertBillingHotPathPreserved()).toBe(true);
  });

  it("reuses GAP-016 FX wiring inside chargeForUsage", () => {
    expect(assertFxHotPathReused()).toBe(true);
  });
});
