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
  emailConfigurationError,
  SUPPORTED_SMTP_PROVIDERS,
  getEmailLogs,
  verifySmtpConnection,
} = require("../lib/email");
const { redactSmtpConfig } = require("../lib/email/redact");
const { getRuntimeProfile } = require("../lib/commercial/environment");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const provider = resolveEmailProvider();
  const kind = resolveProviderKind();
  const runtime = getRuntimeProfile();
  const SmtpEmailProvider = require("../lib/email/SmtpEmailProvider");
  const smtpProvider = new SmtpEmailProvider();
  const connection = await verifySmtpConnection();

  const templates = [
    "welcome",
    "verifyEmail",
    "passwordReset",
    "billingNotice",
    "billingReceipt",
    "creditPurchase",
    "apiKeyCreated",
    "supportTicketUpdate",
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
    smtpFallback: kind === "mock" || kind === "mock-beta",
    failClosed: kind === "fail-closed",
    configurationError: emailConfigurationError(),
    commercialBetaMode: runtime.commercialBetaMode,
    smtpConnection: { ok: connection.ok, error: connection.error || null },
    supportedSmtpProviders: SUPPORTED_SMTP_PROVIDERS,
    smtp: redactSmtpConfig(smtpProvider.getConfig()),
    recentLogs: await getEmailLogs(10),
    templates: templates.map((name) => {
      const sample = renderTemplate(name, {
        name: "Beta User",
        company: "Acme",
        email: "user@example.com",
        plan: "Starter",
        amount: 29,
        credits: 1000,
        orderNumber: "ZW-0001",
        ticketNumber: "ZW-2026-000001",
        title: "Sample ticket",
        status: "open",
      });
      return { name, subject: sample.subject };
    }),
    readyFor: ["IONOS SMTP"],
  });
};
