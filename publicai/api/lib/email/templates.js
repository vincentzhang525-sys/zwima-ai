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
  creditPurchase({ credits, amount }) {
    const subject = "ZWIMA AI credit purchase confirmation";
    const text = `You purchased ${credits} credits for €${amount}. Credits are now available in your wallet.`;
    return { subject, text, html: `<p>${text}</p>` };
  },
};

function renderTemplate(name, data) {
  const fn = templates[name];
  if (!fn) throw new Error(`Unknown email template: ${name}`);
  return fn(data || {});
}

module.exports = { templates, renderTemplate };
