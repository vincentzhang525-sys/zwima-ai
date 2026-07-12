const { smtpConfigured } = require("../email/SmtpEmailProvider");

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  return String(raw).toLowerCase() === "true" || raw === "1";
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" && String(process.env.VERCEL_ENV || "") === "production";
}

function isPreviewRuntime() {
  const env = String(process.env.VERCEL_ENV || "");
  return env === "preview" || env === "development";
}

function isLocalRuntime() {
  return !process.env.VERCEL && process.env.NODE_ENV !== "production";
}

function isCommercialBetaMode() {
  return envFlag("COMMERCIAL_BETA_MODE", true);
}

function getStripeMode() {
  const mode = String(process.env.STRIPE_MODE || "mock").toLowerCase();
  if (mode === "live" || mode === "production") return "live";
  if (mode === "test") return "test";
  return "mock";
}

function stripeKeysPresent() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
}

function stripeWebhookConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

function stripeLiveReady() {
  return getStripeMode() === "live" && stripeKeysPresent() && stripeWebhookConfigured();
}

function stripeTestReady() {
  return getStripeMode() === "test" && stripeKeysPresent() && stripeWebhookConfigured();
}

function emailProviderKind() {
  const provider = String(process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
  if (provider === "mock") return "mock";
  if (isLocalRuntime() || isPreviewRuntime()) return "mock";
  if (String(process.env.EMAIL_DISABLE_SEND || "").toLowerCase() === "true") return "disabled";
  if (isProductionRuntime()) {
    const smtpWanted = ["smtp", "ionos", "resend", "postmark"].includes(provider);
    if (smtpWanted && smtpConfigured()) return "smtp";
    if (isCommercialBetaMode()) return "mock-beta";
    return "fail-closed";
  }
  return "mock";
}

function emailMustFailClosed() {
  return emailProviderKind() === "fail-closed";
}

function paymentMustFailClosed() {
  const mode = getStripeMode();
  if (mode === "mock") return false;
  if (mode === "test") return !stripeTestReady();
  if (mode === "live") return !stripeLiveReady();
  return false;
}

function allowsMockPaymentFallback() {
  return getStripeMode() === "mock" || (isCommercialBetaMode() && isProductionRuntime() && !stripeKeysPresent());
}

function allowsMockEmailFallback() {
  const kind = emailProviderKind();
  return kind === "mock" || kind === "mock-beta";
}

function getRuntimeProfile() {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    vercelEnv: process.env.VERCEL_ENV || null,
    isProduction: isProductionRuntime(),
    isPreview: isPreviewRuntime(),
    isLocal: isLocalRuntime(),
    commercialBetaMode: isCommercialBetaMode(),
    stripeMode: getStripeMode(),
    emailProviderKind: emailProviderKind(),
    smtpConfigured: smtpConfigured(),
    stripeKeysPresent: stripeKeysPresent(),
    stripeWebhookConfigured: stripeWebhookConfigured(),
    paymentFailClosed: paymentMustFailClosed(),
    emailFailClosed: emailMustFailClosed(),
  };
}

function getCommercialBlockers() {
  const blockers = [];
  const profile = getRuntimeProfile();

  if (profile.emailFailClosed) {
    blockers.push({ id: "smtp", severity: "critical", message: "Production SMTP required (EMAIL_PROVIDER=smtp + SMTP_* vars)" });
  } else if (profile.emailProviderKind === "mock-beta") {
    blockers.push({ id: "smtp-beta", severity: "warning", message: "Email running in controlled beta mock mode" });
  }

  if (profile.paymentFailClosed) {
    blockers.push({
      id: "stripe",
      severity: "critical",
      message: `Stripe ${profile.stripeMode} mode incomplete — set STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET`,
    });
  } else if (profile.stripeMode === "mock") {
    blockers.push({ id: "stripe-mock", severity: "warning", message: "Stripe in mock mode — no real payments" });
  }

  const { getMissingLegalFields } = require("./companyConfig");
  const missingLegal = getMissingLegalFields();
  if (missingLegal.length) {
    blockers.push({
      id: "legal",
      severity: "warning",
      message: `Missing legal fields: ${missingLegal.map((f) => f.label).join(", ")}`,
    });
  }

  return blockers;
}

module.exports = {
  envFlag,
  isProductionRuntime,
  isPreviewRuntime,
  isLocalRuntime,
  isCommercialBetaMode,
  getStripeMode,
  stripeKeysPresent,
  stripeWebhookConfigured,
  stripeLiveReady,
  stripeTestReady,
  emailProviderKind,
  emailMustFailClosed,
  paymentMustFailClosed,
  allowsMockPaymentFallback,
  allowsMockEmailFallback,
  getRuntimeProfile,
  getCommercialBlockers,
};
