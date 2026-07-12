const templates = {
  welcome({ name, company }) {
    const subject = "Welcome to ZWIMA AI";
    const text = `Welcome${name ? ` ${name}` : ""}! Your ZWIMA AI account for ${company || "your business"} is ready. Purchase credits and create your first API key to get started.`;
    return { subject, text, html: `<p>${text}</p><p><a href="https://zwima-group.info/dashboard.html">Open Dashboard</a></p>` };
  },
  verifyEmail({ email, link, code }) {
    const subject = "Verify your ZWIMA AI email";
    const text = code
      ? `Your ZWIMA AI verification code is: ${code}\n\nThis code expires in 30 minutes.`
      : `Please verify your email (${email}) to activate your ZWIMA AI account.`;
    const html = code
      ? `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p>This code expires in 30 minutes.</p>`
      : `<p>${text}</p>${link ? `<p><a href="${link}">Verify Email</a></p>` : ""}`;
    return { subject, text, html };
  },
  passwordReset({ email, link, code }) {
    const subject = "Reset your ZWIMA AI password";
    const text = code
      ? `Your password reset code is: ${code}\n\nEnter this code on the reset page. It expires in 60 minutes.`
      : `A password reset was requested for ${email}. If this was you, use the link in this email.`;
    const html = code
      ? `<p>Your password reset code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p><a href="${link || "#"}">Open reset page</a></p>`
      : `<p>${text}</p>${link ? `<p><a href="${link}">Reset Password</a></p>` : ""}`;
    return { subject, text, html };
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
  supportTicketUpdate({ ticketNumber, title, status, message }) {
    const subject = `Support ticket update — ${ticketNumber}`;
    const text = `Your support ticket ${ticketNumber} (${title}) was updated to status: ${status}.${message ? `\n\n${message}` : ""}`;
    return {
      subject,
      text,
      html: `<p>${text.replace(/\n/g, "<br>")}</p><p><a href="https://zwima-group.info/support.html">View tickets</a></p>`,
    };
  },
};

function renderTemplate(name, data) {
  const fn = templates[name];
  if (!fn) throw new Error(`Unknown email template: ${name}`);
  return fn(data || {});
}

module.exports = { templates, renderTemplate };
