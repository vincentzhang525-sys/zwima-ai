const { smtpConfigured } = require("./SmtpEmailProvider");
const {
  isCommercialBetaMode,
  isProductionRuntime,
  isPreviewRuntime,
  isLocalRuntime,
} = require("../commercial/environment");

/** Supabase Auth transactional email is never used — all mail goes through app providers. */
function isSupabaseEmailDisabled() {
  return true;
}

function isDevMode() {
  return isLocalRuntime() || isPreviewRuntime();
}

function isPreviewMode() {
  return isPreviewRuntime();
}

function sendingDisabled() {
  return String(process.env.EMAIL_DISABLE_SEND || "").toLowerCase() === "true";
}

function resolveProviderKind() {
  if (String(process.env.EMAIL_PROVIDER || "").toLowerCase() === "mock") return "mock";
  if (sendingDisabled()) return "disabled";
  if (isLocalRuntime() || isPreviewRuntime()) return "mock";
  if (isProductionRuntime()) {
    const provider = String(process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
    const smtpWanted = ["smtp", "ionos", "resend", "postmark"].includes(provider);
    if (smtpWanted && smtpConfigured()) return "smtp";
    if (isCommercialBetaMode()) return "mock-beta";
    return "fail-closed";
  }
  return "mock";
}

function shouldAutoConfirmEmail() {
  const kind = resolveProviderKind();
  return kind !== "smtp";
}

function getEmailModeLabel() {
  const kind = resolveProviderKind();
  if (kind === "smtp") return "production-smtp";
  if (kind === "fail-closed") return "production-fail-closed";
  if (kind === "mock-beta") return "production-beta-mock";
  if (kind === "disabled") return "disabled";
  if (kind === "mock") return isProductionRuntime() ? "mock" : "development-mock";
  return kind;
}

function emailConfigurationError() {
  const kind = resolveProviderKind();
  if (kind === "fail-closed") {
    return "Production email misconfigured: set EMAIL_PROVIDER=smtp and all SMTP_* variables, or enable COMMERCIAL_BETA_MODE for controlled beta.";
  }
  if (kind === "smtp" && !smtpConfigured()) {
    return "SMTP provider selected but SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM are required.";
  }
  return null;
}

const SUPPORTED_SMTP_PROVIDERS = ["ionos", "smtp", "resend", "postmark"];

module.exports = {
  isSupabaseEmailDisabled,
  isDevMode,
  isPreviewMode,
  isProductionRuntime,
  sendingDisabled,
  resolveProviderKind,
  shouldAutoConfirmEmail,
  getEmailModeLabel,
  emailConfigurationError,
  isCommercialBetaMode,
  SUPPORTED_SMTP_PROVIDERS,
};
