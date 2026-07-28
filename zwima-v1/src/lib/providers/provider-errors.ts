/**
 * GAP-015 — Provider customer-safe error normalization.
 * Never forward raw vendor bodies, secrets, or connection strings to clients/logs.
 */

import type { ProviderErrorCode } from "./types";

const SECRET_LIKE =
  /\b(?:sk-|sk_(?:test|live)_|pk_(?:test|live)_|rk_(?:test|live)_|whsec_|re_|Bearer\s+)[A-Za-z0-9\-._~+/=]{8,}/gi;
const URL_CREDS = /(?:postgres|postgresql|https?):\/\/[^\s"'`]+/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function redactProviderSecrets(text: string): string {
  return String(text ?? "")
    .replace(SECRET_LIKE, "[REDACTED]")
    .replace(URL_CREDS, "[REDACTED_URL]")
    .replace(EMAIL, "[REDACTED_EMAIL]");
}

const CODE_MESSAGES: Record<ProviderErrorCode, string> = {
  invalid_api_key: "Provider authentication failed",
  insufficient_balance: "Provider quota or balance unavailable",
  region_mismatch: "Provider region is not available for this request",
  model_not_available: "Requested model is not available",
  rate_limited: "Provider rate limit exceeded",
  timeout: "Provider request timed out",
  provider_unavailable: "Provider is temporarily unavailable",
};

export function classifyProviderError(error: unknown): ProviderErrorCode {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const msg = raw.toLowerCase();
  if (/rate.?limit|429/.test(msg)) return "rate_limited";
  if (/timeout|timed out|etimedout|abort/.test(msg)) return "timeout";
  if (/api.?key|unauthorized|401|forbidden|403|not configured|not set/.test(msg)) {
    return "invalid_api_key";
  }
  if (/insufficient|balance|quota|402/.test(msg)) return "insufficient_balance";
  if (/region|geo|country/.test(msg)) return "region_mismatch";
  if (/model.?not|unknown model|404/.test(msg)) return "model_not_available";
  if (/unavailable|503|502|overloaded/.test(msg)) return "provider_unavailable";
  return "provider_unavailable";
}

export type CustomerProviderError = {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  httpStatus: number;
};

/** Map provider failures to a stable customer-facing error (no raw vendor text). */
export function toCustomerProviderError(error: unknown): CustomerProviderError {
  const code = classifyProviderError(error);
  const retryable = code === "rate_limited" || code === "timeout" || code === "provider_unavailable";
  const httpStatus =
    code === "invalid_api_key"
      ? 502
      : code === "rate_limited"
        ? 429
        : code === "timeout"
          ? 504
          : code === "model_not_available"
            ? 400
            : 503;

  return {
    code,
    message: CODE_MESSAGES[code],
    retryable,
    httpStatus,
  };
}

export function safeProviderLogMessage(error: unknown): string {
  const code = classifyProviderError(error);
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return redactProviderSecrets(`provider_error code=${code} detail=${raw.slice(0, 120)}`);
}
