const { getAuthedClient, getAdminClient, json, handleOptions, withCors } = require("../lib/supabase");
const { getCompanyConfig } = require("../lib/commercial/companyConfig");

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInvoiceHtml(inv, profile, company) {
  const lines = [
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Invoice ",
    escHtml(inv.invoice_number),
    "</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;color:#111}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #ddd;padding:8px;text-align:left}h1{margin-bottom:4px}.muted{color:#666}</style></head><body>",
    `<h1>${escHtml(company.legalName)}</h1>`,
    `<p class="muted">${escHtml(company.street)}, ${escHtml(company.postalCode)} ${escHtml(company.city)}, ${escHtml(company.country)}</p>`,
    profile?.email ? `<p class="muted">Bill to: ${escHtml(profile.email)}</p>` : "",
    `<h2>Invoice ${escHtml(inv.invoice_number)}</h2>`,
    `<p>Date: ${escHtml(new Date(inv.created_at).toLocaleDateString("de-DE"))}</p>`,
    `<p>Status: ${escHtml(inv.status)}</p>`,
    "<table><tr><th>Description</th><th>Amount</th></tr>",
    `<tr><td>ZWIMA AI services</td><td>€${Number(inv.subtotal).toFixed(2)}</td></tr>`,
    `<tr><td>VAT (${company.vatId ? "19%" : "—"})</td><td>€${Number(inv.tax).toFixed(2)}</td></tr>`,
    `<tr><th>Total</th><th>€${Number(inv.total).toFixed(2)} ${escHtml(inv.currency || "EUR")}</th></tr>`,
    "</table>",
    company.vatId ? `<p class="muted">USt-IdNr.: ${escHtml(company.vatId)}</p>` : "",
    `<p class="muted">${escHtml(company.email)} · ${escHtml(company.website)}</p>`,
    "</body></html>",
  ];
  return lines.join("");
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const invoiceId = String(req.query?.id || req.query?.invoice || "").trim();
    if (!invoiceId) return json(res, 400, { error: "Invoice id required" });

    const { client, user } = await getAuthedClient(req);
    const { data: inv, error } = await client
      .from("invoices")
      .select("*")
      .or(`invoice_number.eq.${invoiceId},id.eq.${invoiceId}`)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!inv) return json(res, 404, { error: "Invoice not found" });

    const company = getCompanyConfig();
    const { data: profile } = await client.from("profiles").select("email, company").eq("id", user.id).maybeSingle();
    const html = renderInvoiceHtml(inv, profile, company);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${inv.invoice_number}.html"`);
    return res.status(200).send(html);
  } catch (err) {
    console.error("[billing/invoice]", err);
    return json(res, err.status || 500, { error: err.message || "Invoice unavailable" });
  }
};
