const MockEmailProvider = require("./MockEmailProvider");
const SmtpEmailProvider = require("./SmtpEmailProvider");
const { smtpConfigured } = SmtpEmailProvider;
const { renderTemplate } = require("./templates");
const { appendEmailLog } = require("./emailLogs");
const { sanitizeLogMessage } = require("./redact");
const {
  isSupabaseEmailDisabled,
  isDevMode,
  sendingDisabled,
  resolveProviderKind,
  shouldAutoConfirmEmail,
  getEmailModeLabel,
  emailConfigurationError,
  SUPPORTED_SMTP_PROVIDERS,
} = require("./policy");

function resolveEmailProvider() {
  const kind = resolveProviderKind();
  if (kind === "smtp") return new SmtpEmailProvider();
  if (kind === "disabled") return new MockEmailProvider();
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

  const configError = emailConfigurationError();
  if (configError && kind === "fail-closed") {
    await appendEmailLog({
      template,
      to,
      subject: rendered.subject,
      provider: "fail-closed",
      status: "failed",
      reason: configError,
    });
    const err = new Error(configError);
    err.code = "EMAIL_FAIL_CLOSED";
    throw err;
  }

  let result;
  try {
    result = await provider.send({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
  } catch (err) {
    await appendEmailLog({
      template,
      to,
      subject: rendered.subject,
      provider: provider.name,
      status: "failed",
      reason: sanitizeLogMessage(err.message),
      bounce: true,
    });
    throw err;
  }

  const status = result.ok ? (result.fallback ? "fallback" : "sent") : "failed";
  await appendEmailLog({
    template,
    to,
    subject: rendered.subject,
    provider: result.fallback ? "mock" : result.provider || provider.name,
    status,
    messageId: result.messageId,
    reason:
      result.smtpError ||
      (kind === "mock-beta" ? "commercial_beta_mock" : undefined) ||
      (result.rejected?.length ? `rejected:${result.rejected.join(",")}` : undefined),
    bounce: status === "failed",
  });
  return result;
}

async function sendTransactional(template, to, data) {
  if (Array.isArray(to)) {
    const results = [];
    for (const recipient of to.slice(0, 1)) {
      results.push(await sendEmail({ template, to: recipient, data }));
    }
    return results;
  }
  return sendEmail({ template, to, data });
}

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
  emailConfigurationError,
  SUPPORTED_SMTP_PROVIDERS,
  getEmailLogs: require("./emailLogs").getEmailLogs,
  verifySmtpConnection: require("./verify").verifySmtpConnection,
};
