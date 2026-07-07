const {
  parseBody,
  json,
  handleOptions,
  withCors,
  enforceRateLimit,
  writeAuditLog,
  getClientIp,
} = require("../lib/supabase");
const { sendTransactional } = require("../lib/email");

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || "hello@zwima-group.info";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const ip = getClientIp(req);
    const limiter = await enforceRateLimit({
      req,
      route: "contact",
      limit: 5,
      windowSeconds: 300,
      key: `contact:${ip}`,
    });
    if (!limiter.allowed) {
      return json(res, 429, { error: "Too many contact requests. Please try again later." });
    }

    const body = parseBody(req);

    if (String(body.website || body._hp || "").trim()) {
      return json(res, 200, { ok: true, message: "Thank you for your message." });
    }

    const name = String(body.name || "").trim();
    const company = String(body.company || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const usecase = String(body.usecase || body.useCase || "").trim();
    const message = String(body.message || "").trim();

    if (!name || name.length < 2) return json(res, 400, { error: "Name is required." });
    if (!company || company.length < 2) return json(res, 400, { error: "Company is required." });
    if (!isValidEmail(email)) return json(res, 400, { error: "Valid email is required." });
    if (!message || message.length < 10) return json(res, 400, { error: "Message must be at least 10 characters." });
    if (message.length > 5000) return json(res, 400, { error: "Message is too long." });

    await writeAuditLog({
      eventType: "contact",
      action: "contact_form_submitted",
      target: email,
      detail: `${company} — ${usecase || "general"}`,
      ip,
    });

    try {
      await sendTransactional("contactMessage", SUPPORT_EMAIL, { name, company, email, usecase, message });
    } catch (mailErr) {
      console.error("[contact] email", mailErr);
    }

    return json(res, 200, {
      ok: true,
      message: "Thank you for your message. We will respond within 2 business days.",
      supportEmail: SUPPORT_EMAIL,
    });
  } catch (err) {
    console.error("[contact]", err);
    return json(res, err.status || 500, { error: err.message || "Contact request failed" });
  }
};
