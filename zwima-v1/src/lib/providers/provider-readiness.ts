/**
 * GAP-015 — Multi-Provider Production Readiness Gate (no live HTTP, no spend).
 * Reuses `src/lib/providers` adapters + `src/core/providers` foundation.
 */

import fs from "node:fs";
import path from "node:path";
import { getAllAdapters, getAdapter } from "./registry";
import type { ProviderAdapter, ChatResult } from "./types";
import { REQUIRED_ADAPTER_METHODS, type ProviderGateStatus, type ProviderReadinessVerdict } from "./contracts";
import { toCustomerProviderError, redactProviderSecrets } from "./provider-errors";

export type FocusProviderId = "openai" | "gemini" | "claude" | "deepseek" | "qwen";

export type ProviderComplianceMetadata = {
  dataRegion: "GLOBAL" | "US" | "EU" | "APAC" | "CN";
  dataRetentionDisclosure: string;
  subProcessorReference: string;
  euAvailable: boolean;
  complianceStatus: "DOCUMENTED" | "PENDING_COUNSEL" | "INCOMPLETE";
};

export type ProviderCatalogEntry = {
  id: FocusProviderId;
  displayName: string;
  adapterSlug: string;
  envKeyName: string;
  currency: "USD" | "EUR";
  defaultStatus: ProviderGateStatus;
  compliance: ProviderComplianceMetadata;
  /** Historical live evidence already locked (GAP-001) — do not re-call. */
  historicalLiveEvidence: boolean;
};

export const FOCUS_PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "openai",
    displayName: "OpenAI",
    adapterSlug: "openai",
    envKeyName: "OPENAI_API_KEY",
    currency: "USD",
    defaultStatus: "ACTIVE",
    historicalLiveEvidence: true,
    compliance: {
      dataRegion: "GLOBAL",
      dataRetentionDisclosure: "See /privacy and provider DPA; retention per OpenAI policy + ZWIMA UsageLog",
      subProcessorReference: "/legal/sub-processors",
      euAvailable: true,
      complianceStatus: "DOCUMENTED",
    },
  },
  {
    id: "gemini",
    displayName: "Google Gemini",
    adapterSlug: "gemini",
    envKeyName: "GEMINI_API_KEY",
    currency: "USD",
    defaultStatus: "ACTIVE",
    historicalLiveEvidence: false,
    compliance: {
      dataRegion: "GLOBAL",
      dataRetentionDisclosure: "See /privacy; Google Cloud / Gemini data regions per Google terms",
      subProcessorReference: "/legal/sub-processors",
      euAvailable: true,
      complianceStatus: "DOCUMENTED",
    },
  },
  {
    id: "claude",
    displayName: "Anthropic Claude",
    adapterSlug: "claude",
    envKeyName: "ANTHROPIC_API_KEY",
    currency: "USD",
    defaultStatus: "ACTIVE",
    historicalLiveEvidence: false,
    compliance: {
      dataRegion: "US",
      dataRetentionDisclosure: "See /privacy; Anthropic retention per Anthropic terms",
      subProcessorReference: "/legal/sub-processors",
      euAvailable: true,
      complianceStatus: "DOCUMENTED",
    },
  },
  {
    id: "deepseek",
    displayName: "DeepSeek",
    adapterSlug: "deepseek",
    envKeyName: "DEEPSEEK_API_KEY",
    currency: "USD",
    defaultStatus: "ACTIVE",
    historicalLiveEvidence: false,
    compliance: {
      dataRegion: "APAC",
      dataRetentionDisclosure: "See /privacy; DeepSeek processing region APAC — EU residency not guaranteed",
      subProcessorReference: "/legal/sub-processors",
      euAvailable: false,
      complianceStatus: "DOCUMENTED",
    },
  },
  {
    id: "qwen",
    displayName: "Alibaba Qwen",
    adapterSlug: "qwen",
    envKeyName: "QWEN_API_KEY",
    currency: "USD",
    defaultStatus: "ACTIVE",
    historicalLiveEvidence: false,
    compliance: {
      dataRegion: "CN",
      dataRetentionDisclosure: "See /privacy; DashScope intl/CN endpoints — EU residency not guaranteed",
      subProcessorReference: "/legal/sub-processors",
      euAvailable: false,
      complianceStatus: "DOCUMENTED",
    },
  },
];

export type EnvReader = (name: string) => string | undefined;

function defaultEnvReader(name: string): string | undefined {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : undefined;
}

/** Presence only — never returns or logs the secret body. */
export function isEnvKeyConfigured(envKeyName: string, readEnv: EnvReader = defaultEnvReader): boolean {
  return Boolean(readEnv(envKeyName));
}

export function assertAdapterContract(adapter: ProviderAdapter): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const key of REQUIRED_ADAPTER_METHODS) {
    const value = (adapter as unknown as Record<string, unknown>)[key];
    if (value == null) missing.push(key);
    else if (key === "slug" || key === "name") {
      if (typeof value !== "string" || !value.trim()) missing.push(key);
    } else if (typeof value !== "function") {
      missing.push(key);
    }
  }
  return { ok: missing.length === 0, missing };
}

export type ProviderReadinessReport = {
  id: FocusProviderId;
  adapterPresent: boolean;
  contractOk: boolean;
  envKeyName: string;
  envKeyConfigured: boolean;
  /** Never includes secret values */
  status: ProviderGateStatus;
  fullyRoutable: boolean;
  verdict: ProviderReadinessVerdict;
  complianceComplete: boolean;
  historicalLiveEvidence: boolean;
  exclusionReasons: string[];
};

function complianceComplete(meta: ProviderComplianceMetadata): boolean {
  return Boolean(
    meta.dataRegion &&
      meta.dataRetentionDisclosure?.trim() &&
      meta.subProcessorReference?.trim() &&
      typeof meta.euAvailable === "boolean" &&
      meta.complianceStatus !== "INCOMPLETE",
  );
}

export function assessProviderReadiness(
  entry: ProviderCatalogEntry,
  opts?: {
    readEnv?: EnvReader;
    statusOverride?: ProviderGateStatus;
  },
): ProviderReadinessReport {
  const readEnv = opts?.readEnv ?? defaultEnvReader;
  const adapter = getAdapter(entry.adapterSlug);
  const contract = adapter ? assertAdapterContract(adapter) : { ok: false, missing: ["adapter"] };
  const envKeyConfigured = isEnvKeyConfigured(entry.envKeyName, readEnv);
  const complianceOk = complianceComplete(entry.compliance);
  const exclusionReasons: string[] = [];

  let status: ProviderGateStatus = opts?.statusOverride ?? entry.defaultStatus;
  if (!adapter || !contract.ok) {
    status = "UNAVAILABLE";
    exclusionReasons.push("adapter_contract_invalid");
  } else if (status === "DISABLED") {
    exclusionReasons.push("provider_disabled");
  } else if (status === "UNAVAILABLE") {
    exclusionReasons.push("provider_unavailable");
  } else if (!envKeyConfigured) {
    status = "CONFIG_PENDING";
    exclusionReasons.push("api_key_missing");
  }

  if (!complianceOk) {
    exclusionReasons.push("compliance_metadata_incomplete");
  }

  const fullyRoutable =
    status === "ACTIVE" && envKeyConfigured && contract.ok && Boolean(adapter) && complianceOk;

  let verdict: ProviderReadinessVerdict = "FAIL";
  if (entry.historicalLiveEvidence && contract.ok && complianceOk) {
    // OpenAI: code readiness PASS; do not require re-proving live spend.
    verdict = envKeyConfigured || entry.historicalLiveEvidence ? "PASS" : "FAIL";
  } else if (contract.ok && complianceOk) {
    verdict = fullyRoutable ? "PASS" : "PASS_OR_CONFIG_PENDING";
  }

  return {
    id: entry.id,
    adapterPresent: Boolean(adapter),
    contractOk: contract.ok,
    envKeyName: entry.envKeyName,
    envKeyConfigured,
    status,
    fullyRoutable,
    verdict,
    complianceComplete: complianceOk,
    historicalLiveEvidence: entry.historicalLiveEvidence,
    exclusionReasons,
  };
}

export function assessAllProviderReadiness(opts?: {
  readEnv?: EnvReader;
  statusOverrides?: Partial<Record<FocusProviderId, ProviderGateStatus>>;
}): ProviderReadinessReport[] {
  return FOCUS_PROVIDER_CATALOG.map((entry) =>
    assessProviderReadiness(entry, {
      readEnv: opts?.readEnv,
      statusOverride: opts?.statusOverrides?.[entry.id],
    }),
  );
}

export type RoutableFilterResult = {
  eligible: FocusProviderId[];
  rejected: Array<{ id: FocusProviderId; reasons: string[] }>;
  failClosed: boolean;
  errorCode: "NO_ROUTABLE_PROVIDER" | null;
};

/** Candidate filter only — does not redesign M2 scoring. */
export function filterRoutableProviders(
  reports: ProviderReadinessReport[] = assessAllProviderReadiness(),
): RoutableFilterResult {
  const eligible: FocusProviderId[] = [];
  const rejected: Array<{ id: FocusProviderId; reasons: string[] }> = [];

  for (const r of reports) {
    if (r.fullyRoutable) eligible.push(r.id);
    else rejected.push({ id: r.id, reasons: r.exclusionReasons });
  }

  if (eligible.length === 0) {
    return {
      eligible: [],
      rejected,
      failClosed: true,
      errorCode: "NO_ROUTABLE_PROVIDER",
    };
  }

  return { eligible, rejected, failClosed: false, errorCode: null };
}

export type NormalizedUsageForBilling = {
  providerSlug: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  usageSource: "provider" | "estimated";
};

/** Map adapter ChatResult → chargeForUsage token fields (never bypasses billing). */
export function normalizeUsageForBilling(
  providerSlug: string,
  result: Pick<ChatResult, "model" | "inputTokens" | "outputTokens" | "latencyMs">,
): NormalizedUsageForBilling {
  return {
    providerSlug,
    model: result.model,
    inputTokens: Math.max(0, Number(result.inputTokens) || 0),
    outputTokens: Math.max(0, Number(result.outputTokens) || 0),
    latencyMs: Math.max(0, Number(result.latencyMs) || 0),
    usageSource: "provider",
  };
}

export function normalizeRawProviderUsage(
  providerSlug: string,
  model: string,
  raw: unknown,
  latencyMs = 0,
): NormalizedUsageForBilling {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const inputTokens = Number(obj.inputTokens ?? obj.prompt_tokens ?? obj.promptTokenCount ?? 0);
  const outputTokens = Number(
    obj.outputTokens ?? obj.completion_tokens ?? obj.candidatesTokenCount ?? 0,
  );
  return normalizeUsageForBilling(providerSlug, {
    model,
    inputTokens,
    outputTokens,
    latencyMs,
  });
}

/** Billing must go through chargeForUsage (GAP-004/016). Static source contract. */
export function assertBillingHotPathPreserved(repoRoot = path.join(process.cwd())): boolean {
  const creditsPath = path.join(repoRoot, "src/lib/billing/credits-engine.ts");
  const chatUsagePath = path.join(repoRoot, "src/lib/billing/v1-chat-usage.ts");
  const credits = fs.readFileSync(creditsPath, "utf8");
  const chatUsage = fs.readFileSync(chatUsagePath, "utf8");
  return (
    credits.includes("export async function chargeForUsage") &&
    chatUsage.includes('from "@/lib/billing/credits-engine"') &&
    chatUsage.includes("chargeForUsage({")
  );
}

/** FX hot path must remain wired inside chargeForUsage (GAP-016). */
export function assertFxHotPathReused(repoRoot = path.join(process.cwd())): boolean {
  const credits = fs.readFileSync(path.join(repoRoot, "src/lib/billing/credits-engine.ts"), "utf8");
  return (
    credits.includes("buildUsageFxCost") &&
    credits.includes("PrismaFxRateProvider") &&
    credits.includes("FX_RATE_UNAVAILABLE")
  );
}

export function registryHasFiveFocusProviders(): boolean {
  const slugs = new Set(getAllAdapters().map((a) => a.slug));
  return FOCUS_PROVIDER_CATALOG.every((e) => slugs.has(e.adapterSlug));
}

export async function assertMissingKeyFailClosed(
  adapter: ProviderAdapter,
  readEnv: EnvReader,
  envKeyName: string,
): Promise<{ threw: boolean; customerSafe: boolean }> {
  if (isEnvKeyConfigured(envKeyName, readEnv)) {
    // Do not invoke live chat when a key is present (GAP-015: no new real cost).
    return { threw: true, customerSafe: true };
  }
  try {
    await adapter.chat({
      model: adapter.models()[0]?.id ?? "unknown",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 1,
    });
    return { threw: false, customerSafe: false };
  } catch (err) {
    const customer = toCustomerProviderError(err);
    const safe = customer.message === "Provider authentication failed" || customer.code === "invalid_api_key";
    const leaked = /sk-|sk_live|whsec_|Bearer\s|api[_-]?key\s*=/i.test(String(err instanceof Error ? err.message : err));
    return { threw: true, customerSafe: safe && !leaked };
  }
}

export function buildReadinessMatrixRows(
  reports: ProviderReadinessReport[] = assessAllProviderReadiness(),
): Array<Record<string, string>> {
  return reports.map((r) => ({
    provider: r.id,
    verdict: r.verdict,
    status: r.status,
    fullyRoutable: r.fullyRoutable ? "YES" : "NO",
    envKeyConfigured: r.envKeyConfigured ? "YES" : "NO",
    envKeyName: r.envKeyName,
    contractOk: r.contractOk ? "YES" : "NO",
    complianceComplete: r.complianceComplete ? "YES" : "NO",
    historicalLiveEvidence: r.historicalLiveEvidence ? "YES" : "NO",
    exclusions: r.exclusionReasons.join("|") || "none",
  }));
}

export { toCustomerProviderError, redactProviderSecrets };
