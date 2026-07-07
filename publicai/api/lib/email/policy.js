const { smtpConfigured } = require("./SmtpEmailProvider");

/** Supabase Auth transactional email is never used — all mail goes through app providers. */
function isSupabaseEmailDisabled() {
  return true;
}

function isDevMode() {
  return process.env.NODE_ENV !== "production" || String(process.env.VERCEL_ENV || "") === "development";
}

function isPreviewMode() {
  const env = String(process.env.VERCEL_ENV || "");
  return env === "preview" || env === "development";
}

function sendingDisabled() {
  return String(process.env.EMAIL_DISABLE_SEND || "").toLowerCase() === "true";
}

/** Production runtime on Vercel (not preview/dev). */
function isProductionRuntime() {
  return process.env.NODE_ENV === "production" && String(process.env.VERCEL_ENV || "") === "production";
}

/**
 * Development / preview: mock only.
 * Production: SMTP when configured; otherwise mock fallback.
 */
function resolveProviderKind() {
  if (sendingDisabled() || isDevMode() || isPreviewMode()) {
    return "mock";
  }
  if (isProductionRuntime()) {
    const provider = String(process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
    const smtpProvider =
      provider === "smtp" || provider === "ionos" || provider === "resend" || provider === "postmark";
    if (smtpProvider && smtpConfigured()) {
      return "smtp";
    }
    return "mock-fallback";
  }
  return "mock";
}

function shouldAutoConfirmEmail() {
  return resolveProviderKind() !== "smtp";
}

function getEmailModeLabel() {
  const kind = resolveProviderKind();
  if (kind === "smtp") return "production-smtp";
  if (kind === "mock-fallback") return "production-mock-fallback";
  return "development-mock";
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
  SUPPORTED_SMTP_PROVIDERS,
};
