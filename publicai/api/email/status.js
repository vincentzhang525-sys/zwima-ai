const { json, handleOptions, withCors } = require("../lib/supabase");
const {
  resolveEmailProvider,
  renderTemplate,
  isDevMode,
  sendingDisabled,
  smtpConfigured,
  isSupabaseEmailDisabled,
  resolveProviderKind,
  getEmailModeLabel,
  SUPPORTED_SMTP_PROVIDERS,
  getEmailLogs,
} = require("../lib/email");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const provider = resolveEmailProvider();
  const kind = resolveProviderKind();
  const templates = [
    "welcome",
    "verifyEmail",
    "passwordReset",
    "billingNotice",
    "billingReceipt",
    "creditPurchase",
    "apiKeyCreated",
    "contactMessage",
  ];
  return json(res, 200, {
    provider: provider.name,
    providerKind: kind,
    emailMode: getEmailModeLabel(),
    supabaseEmailDisabled: isSupabaseEmailDisabled(),
    massSendingEnabled: false,
    devMode: isDevMode(),
    sendingDisabled: sendingDisabled(),
    smtpConfigured: smtpConfigured(),
    smtpFallback: kind === "mock" || kind === "mock-fallback",
    supportedSmtpProviders: SUPPORTED_SMTP_PROVIDERS,
    smtp: {
      host: process.env.SMTP_HOST || "smtp.ionos.com",
      port: Number(process.env.SMTP_PORT || 587),
      from: process.env.SMTP_FROM || null,
      userConfigured: Boolean(process.env.SMTP_USER),
    },
    recentLogs: getEmailLogs(10),
    templates: templates.map((name) => {
      const sample = renderTemplate(name, {
        name: "Beta User",
        company: "Acme",
        email: "user@example.com",
        plan: "Starter",
        amount: 29,
        credits: 1000,
        orderNumber: "ZW-0001",
      });
      return { name, subject: sample.subject };
    }),
    readyFor: ["IONOS SMTP", "Resend", "Postmark"],
  });
};
