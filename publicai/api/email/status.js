const { json, handleOptions, withCors } = require("../lib/supabase");
const { resolveEmailProvider, renderTemplate } = require("../lib/email");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const provider = resolveEmailProvider();
  const templates = ["welcome", "verifyEmail", "passwordReset", "billingNotice", "creditPurchase"];
  return json(res, 200, {
    provider: provider.name,
    massSendingEnabled: false,
    templates: templates.map((name) => {
      const sample = renderTemplate(name, { name: "Beta User", company: "Acme", email: "user@example.com", plan: "Starter", amount: 29, credits: 1000 });
      return { name, subject: sample.subject };
    }),
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
    readyFor: ["Resend", "Postmark", "SMTP"],
  });
};
