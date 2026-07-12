const EmailProvider = require("./EmailProvider");
const { sanitizeLogMessage } = require("./redact");

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_FROM &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

class SmtpEmailProvider extends EmailProvider {
  constructor() {
    const host = String(process.env.SMTP_HOST || "").toLowerCase();
    const provider = String(process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
    let name = "smtp";
    if (provider === "ionos" || host.includes("ionos")) name = "ionos";
    else if (provider === "resend" || host.includes("resend")) name = "resend";
    else if (provider === "postmark" || host.includes("postmark")) name = "postmark";
    super(name);
  }

  isConfigured() {
    return smtpConfigured();
  }

  getConfig() {
    return {
      host: process.env.SMTP_HOST || "smtp.ionos.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
      from: process.env.SMTP_FROM || "",
    };
  }

  async send({ to, subject, html, text }) {
    const { resolveProviderKind, emailConfigurationError } = require("./policy");
    const kind = resolveProviderKind();
    const configError = emailConfigurationError();

    if (kind === "fail-closed") {
      const err = new Error(configError || "Email delivery blocked — SMTP not configured for production.");
      err.code = "EMAIL_FAIL_CLOSED";
      throw err;
    }

    if (!this.isConfigured()) {
      if (kind === "mock" || kind === "mock-beta") {
        const MockEmailProvider = require("./MockEmailProvider");
        return new MockEmailProvider().send({ to, subject, html, text });
      }
      const err = new Error(configError || "SMTP not configured.");
      err.code = "EMAIL_NOT_CONFIGURED";
      throw err;
    }

    try {
      const nodemailer = require("nodemailer");
      const cfg = this.getConfig();
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
      });

      const info = await transporter.sendMail({
        from: cfg.from,
        to,
        subject,
        text: text || undefined,
        html: html || undefined,
      });

      return {
        ok: true,
        provider: this.name,
        messageId: info.messageId || `smtp_${Date.now()}`,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      };
    } catch (err) {
      console.error("[email:smtp] send failed:", sanitizeLogMessage(err.message));
      if (kind === "smtp") {
        const sendErr = new Error(`SMTP delivery failed: ${sanitizeLogMessage(err.message)}`);
        sendErr.code = "SMTP_DELIVERY_FAILED";
        throw sendErr;
      }
      const MockEmailProvider = require("./MockEmailProvider");
      const mock = new MockEmailProvider();
      const result = await mock.send({ to, subject, html, text });
      return { ...result, fallback: true, smtpError: sanitizeLogMessage(err.message) };
    }
  }
}

module.exports = SmtpEmailProvider;
module.exports.smtpConfigured = smtpConfigured;
