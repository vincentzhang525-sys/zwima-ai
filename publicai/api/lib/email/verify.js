const { smtpConfigured } = require("./SmtpEmailProvider");
const { sanitizeLogMessage } = require("./redact");
const { emailMustFailClosed } = require("../commercial/environment");

async function verifySmtpConnection() {
  if (!smtpConfigured()) {
    return { ok: false, error: "SMTP not configured", configured: false };
  }
  if (emailMustFailClosed()) {
    return { ok: false, error: "Production SMTP required", configured: false, failClosed: true };
  }

  try {
    const nodemailer = require("nodemailer");
    const SmtpEmailProvider = require("./SmtpEmailProvider");
    const provider = new SmtpEmailProvider();
    const cfg = provider.getConfig();
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.verify();
    return { ok: true, configured: true, host: cfg.host, port: cfg.port, from: cfg.from };
  } catch (err) {
    return { ok: false, configured: true, error: sanitizeLogMessage(err.message) };
  }
}

module.exports = { verifySmtpConnection };
