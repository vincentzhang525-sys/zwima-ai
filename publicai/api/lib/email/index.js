const MockEmailProvider = require("./MockEmailProvider");
const SmtpEmailProvider = require("./SmtpEmailProvider");
const { renderTemplate } = require("./templates");

let massSendingEnabled = false;

function resolveEmailProvider() {
  const provider = String(process.env.EMAIL_PROVIDER || "mock").toLowerCase();
  if (provider === "smtp" || provider === "resend" || provider === "postmark") {
    return new SmtpEmailProvider();
  }
  return new MockEmailProvider();
}

async function sendEmail({ template, to, data }) {
  if (!to) throw new Error("Email recipient is required");
  const rendered = renderTemplate(template, data);
  const provider = resolveEmailProvider();
  return provider.send({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
}

async function sendTransactional(template, to, data) {
  // Mass sending disabled for beta launch
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
};
