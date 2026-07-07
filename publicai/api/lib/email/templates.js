const templates = {
  welcome({ name, company }) {
    const subject = "Welcome to ZWIMA AI";
    const text = `Welcome${name ? ` ${name}` : ""}! Your ZWIMA AI account for ${company || "your business"} is ready. Start with 500 free credits and create your first API key.`;
    return { subject, text, html: `<p>${text}</p><p><a href="https://zwima-group.info/dashboard.html">Open Dashboard</a></p>` };
  },
  verifyEmail({ email, link }) {
    const subject = "Verify your ZWIMA AI email";
    const text = `Please verify your email (${email}) to activate your ZWIMA AI account.`;
    return { subject, text, html: `<p>${text}</p>${link ? `<p><a href="${link}">Verify Email</a></p>` : ""}` };
  },
  passwordReset({ email, link }) {
    const subject = "Reset your ZWIMA AI password";
    const text = `A password reset was requested for ${email}. If this was you, use the link in this email.`;
    return { subject, text, html: `<p>${text}</p>${link ? `<p><a href="${link}">Reset Password</a></p>` : ""}` };
  },
  billingNotice({ plan, amount }) {
    const subject = "ZWIMA AI billing notice";
    const text = `Your subscription was updated to ${plan}. Amount: €${amount}.`;
    return { subject, text, html: `<p>${text}</p>` };
  },
  billingReceipt({ plan, amount, orderNumber }) {
    const subject = "ZWIMA AI billing receipt";
    const text = `Payment received. Plan: ${plan || "—"}. Amount: €${amount}.${orderNumber ? ` Order: ${orderNumber}.` : ""}`;
    return { subject, text, html: `<p>${text}</p><p>Thank you for your business.</p>` };
  },
  creditPurchase({ credits, amount }) {
    const subject = "ZWIMA AI credit purchase confirmation";
    const text = `You purchased ${credits} credits for €${amount}. Credits are now available in your wallet.`;
    return { subject, text, html: `<p>${text}</p>` };
  },
  apiKeyCreated({ name, email }) {
    const subject = "ZWIMA AI API key created";
    const text = `A new API key "${name || "API Key"}" was created for ${email || "your account"}. Store your key securely — it is shown only once at creation.`;
    return { subject, text, html: `<p>${text}</p><p><a href="https://zwima-group.info/apikeys.html">API Key Center</a></p>` };
  },
  contactMessage({ name, company, email, usecase, message }) {
    const subject = `ZWIMA AI contact: ${company || name || "Inquiry"}`;
    const text = `From: ${name}\nCompany: ${company}\nEmail: ${email}\nUse case: ${usecase || "—"}\n\n${message}`;
    return { subject, text, html: `<pre>${text}</pre>` };
  },
};

function renderTemplate(name, data) {
  const fn = templates[name];
  if (!fn) throw new Error(`Unknown email template: ${name}`);
  return fn(data || {});
}

module.exports = { templates, renderTemplate };
