const MockEmailProvider = require("./MockEmailProvider");
const SmtpEmailProvider = require("./SmtpEmailProvider");
const { smtpConfigured } = SmtpEmailProvider;
const { renderTemplate } = require("./templates");
const { appendEmailLog } = require("./emailLogs");
const {
  isSupabaseEmailDisabled,
  isDevMode,
  sendingDisabled,
  resolveProviderKind,
  shouldAutoConfirmEmail,
  getEmailModeLabel,
  SUPPORTED_SMTP_PROVIDERS,
} = require("./policy");

let massSendingEnabled = false;

function resolveEmailProvider() {
  const kind = resolveProviderKind();
  if (kind === "smtp") {
    return new SmtpEmailProvider();
  }
  return new MockEmailProvider();
}

async function sendEmail({ template, to, data }) {
  if (!to) throw new Error("Email recipient is required");
  const rendered = renderTemplate(template, data);
  const provider = resolveEmailProvider();
  const kind = resolveProviderKind();

  if (sendingDisabled()) {
    const row = await appendEmailLog({
      template,
      to,
      subject: rendered.subject,
      provider: "mock",
      status: "skipped",
      reason: "EMAIL_DISABLE_SEND=true",
    });
    return { ok: true, provider: "mock", messageId: row.id, skipped: true };
  }

  const result = await provider.send({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
  await appendEmailLog({
    template,
    to,
    subject: rendered.subject,
    provider: result.fallback ? "mock" : result.provider || provider.name,
    status: result.ok ? (result.fallback ? "fallback" : "sent") : "failed",
    messageId: result.messageId,
    detail: result.smtpError ? `smtp_fallback:${result.smtpError}` : kind === "mock-fallback" ? "smtp_not_configured" : undefined,
  });
  return result;
}

async function sendTransactional(template, to, data) {
  if (massSendingEnabled === false && Array.isArray(to)) {
    throw new Error("Mass email sending is disabled.");
  }
  if (Array.isArray(to)) {
    const results = [];
    for (const recipient of to.slice(0, 1)) {
      results.push(await sendEmail({ template, to: recipient, data }));
    }
    return results;
  }
  return sendEmail({ template, to, data });
}

/** @deprecated Use shouldAutoConfirmEmail */
function shouldAutoVerifyEmail() {
  return shouldAutoConfirmEmail();
}

module.exports = {
  resolveEmailProvider,
  sendEmail,
  sendTransactional,
  renderTemplate,
  isDevMode,
  sendingDisabled,
  smtpConfigured,
  shouldAutoVerifyEmail,
  shouldAutoConfirmEmail,
  isSupabaseEmailDisabled,
  resolveProviderKind,
  getEmailModeLabel,
  SUPPORTED_SMTP_PROVIDERS,
  getEmailLogs: require("./emailLogs").getEmailLogs,
};
