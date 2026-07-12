function redactSecret(value, visible = 4) {
  if (!value) return null;
  const str = String(value);
  if (str.length <= visible * 2) return "***";
  return `${str.slice(0, visible)}…${str.slice(-visible)}`;
}

function redactSmtpConfig(cfg = {}) {
  return {
    host: cfg.host || null,
    port: cfg.port || null,
    secure: cfg.secure,
    from: cfg.from || null,
    user: cfg.user ? redactSecret(cfg.user, 3) : null,
    passConfigured: Boolean(cfg.pass),
  };
}

function redactStripeKeys() {
  return {
    secretKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    publishableKeyConfigured: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    secretKeyPreview: redactSecret(process.env.STRIPE_SECRET_KEY, 6),
    publishableKeyPreview: redactSecret(process.env.STRIPE_PUBLISHABLE_KEY, 6),
  };
}

function sanitizeLogMessage(message) {
  if (!message) return message;
  let out = String(message);
  for (const key of ["SMTP_PASS", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) {
    const val = process.env[key];
    if (val && out.includes(val)) out = out.split(val).join("[REDACTED]");
  }
  if (process.env.SMTP_USER && out.includes(process.env.SMTP_USER)) {
    out = out.replaceAll(process.env.SMTP_USER, redactSecret(process.env.SMTP_USER, 3));
  }
  return out;
}

module.exports = { redactSecret, redactSmtpConfig, redactStripeKeys, sanitizeLogMessage };
