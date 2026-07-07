const MockEmailProvider = require("./MockEmailProvider");
const SmtpEmailProvider = require("./SmtpEmailProvider");
const { smtpConfigured } = SmtpEmailProvider;
const { renderTemplate } = require("./templates");
const { appendEmailLog } = require("./emailLogs");

let massSendingEnabled = false;

function isDevMode() {
  return process.env.NODE_ENV !== "production" || String(process.env.VERCEL_ENV || "") === "development";
}

function sendingDisabled() {
  return String(process.env.EMAIL_DISABLE_SEND || "").toLowerCase() === "true";
}

function resolveEmailProvider() {
  if (sendingDisabled()) {
    return new MockEmailProvider();
  }

  const provider = String(process.env.EMAIL_PROVIDER || "mock").toLowerCase();
  if (provider === "mock") {
    return new MockEmailProvider();
  }

  if (provider === "smtp" || provider === "ionos" || provider === "resend" || provider === "postmark") {
    if (smtpConfigured()) {
      return new SmtpEmailProvider();
    }
    return new MockEmailProvider();
  }

  return new MockEmailProvider();
}

async function sendEmail({ template, to, data }) {
  if (!to) throw new Error("Email recipient is required");
  const rendered = renderTemplate(template, data);
  const provider = resolveEmailProvider();

  if (sendingDisabled()) {
    const row = appendEmailLog({
      template,
      to,
      subject: rendered.subject,
      provider: "disabled",
      status: "skipped",
      reason: "EMAIL_DISABLE_SEND=true",
    });
    return { ok: true, provider: "disabled", messageId: row.id, skipped: true };
  }

  const result = await provider.send({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
  appendEmailLog({
    template,
    to,
    subject: rendered.subject,
    provider: result.fallback ? "mock" : result.provider || provider.name,
    status: result.ok ? (result.fallback ? "fallback" : "sent") : "failed",
    messageId: result.messageId,
    detail: result.smtpError || result.fallback ? "smtp_fallback" : undefined,
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

module.exports = {
  resolveEmailProvider,
  sendEmail,
  sendTransactional,
  renderTemplate,
  isDevMode,
  sendingDisabled,
  smtpConfigured,
  getEmailLogs: require("./emailLogs").getEmailLogs,
};
