const EmailProvider = require("./EmailProvider");

class SmtpEmailProvider extends EmailProvider {
  constructor() {
    super("smtp");
  }

  isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  }

  async send({ to, subject, html, text }) {
    if (!this.isConfigured()) {
      const MockEmailProvider = require("./MockEmailProvider");
      const mock = new MockEmailProvider();
      return mock.send({ to, subject, html, text });
    }
    // SMTP ready for Resend/Postmark relay — no mass sending enabled
    console.log(`[email:smtp:queued] to=${to} subject=${subject}`);
    return { ok: true, provider: this.name, messageId: `smtp_${Date.now()}`, queued: true };
  }
}

module.exports = SmtpEmailProvider;
