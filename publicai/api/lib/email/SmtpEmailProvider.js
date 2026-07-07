const EmailProvider = require("./EmailProvider");

class SmtpEmailProvider extends EmailProvider {
  constructor() {
    super(process.env.SMTP_HOST?.includes("ionos") ? "ionos" : "smtp");
  }

  isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  }

  getConfig() {
    return {
      host: process.env.SMTP_HOST || "smtp.ionos.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      user: process.env.SMTP_USER || "",
      from: process.env.SMTP_FROM || "",
    };
  }

  async send({ to, subject, html, text }) {
    if (!this.isConfigured()) {
      const MockEmailProvider = require("./MockEmailProvider");
      const mock = new MockEmailProvider();
      return mock.send({ to, subject, html, text });
    }
    // IONOS / SMTP ready — wire nodemailer or Resend/Postmark relay in production
    const cfg = this.getConfig();
    console.log(`[email:smtp:queued] host=${cfg.host} port=${cfg.port} to=${to} subject=${subject}`);
    return { ok: true, provider: this.name, messageId: `smtp_${Date.now()}`, queued: true, host: cfg.host };
  }
}

module.exports = SmtpEmailProvider;
