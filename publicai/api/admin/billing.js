const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const [{ data: payments }, { data: orders }, { data: invoices }] = await Promise.all([
      admin.from("payments").select("*").order("created_at", { ascending: false }).limit(100),
      admin.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
      admin.from("invoices").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

    const orderRows = orders || [];
    const invoiceRows = invoices || [];
    const paymentRows = payments || [];

    return json(res, 200, {
      payments: paymentRows.map((p) => ({
        createdAt: p.created_at,
        amountEur: Number(p.amount) || 0,
        credits: Math.round((Number(p.amount) || 0) * 100),
        status: p.status,
        sessionId: p.id,
        provider: p.provider,
      })),
      orders: orderRows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        amountEur: Number(o.total) || 0,
        status: o.status,
        type: o.order_type,
        createdAt: o.created_at,
      })),
      invoices: invoiceRows.length
        ? invoiceRows.map((i) => ({
            id: i.id,
            invoiceNumber: i.invoice_number,
            date: String(i.created_at || "").slice(0, 10),
            amountEur: Number(i.total) || 0,
            status: i.status,
          }))
        : paymentRows.map((p) => ({
            id: p.id,
            date: String(p.created_at || "").slice(0, 10),
            amountEur: Number(p.amount) || 0,
            credits: Math.round((Number(p.amount) || 0) * 100),
            status: p.status,
          })),
    });
  } catch (err) {
    console.error("[admin/billing]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load billing" });
  }
};
