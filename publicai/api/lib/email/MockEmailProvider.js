const EmailProvider = require("./EmailProvider");

class MockEmailProvider extends EmailProvider {
  constructor() {
    super("mock");
  }

  async send({ to, subject, html, text }) {
    console.log(`[email:mock] to=${to} subject=${subject}`);
    return { ok: true, provider: this.name, messageId: `mock_${Date.now()}`, preview: { to, subject, text: text || html?.slice(0, 120) } };
  }
}

module.exports = MockEmailProvider;
