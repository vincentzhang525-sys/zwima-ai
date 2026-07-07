const { parseBody, json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");
const { listProviders } = require("../lib/payments");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { admin } = await requireAdmin(req);

    if (req.method === "GET") {
      const [
        { data: plans },
        { data: packages },
        { data: orders },
        { data: invoices },
        { data: coupons },
        { data: subscriptions },
        { data: payments },
        { data: transactions },
      ] = await Promise.all([
        admin.from("subscription_plans").select("*").order("monthly_price"),
        admin.from("credit_packages").select("*").order("credits"),
        admin.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
        admin.from("invoices").select("*").order("created_at", { ascending: false }).limit(100),
        admin.from("coupons").select("*").order("created_at", { ascending: false }),
        admin.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(100),
        admin.from("payments").select("*").order("created_at", { ascending: false }).limit(100),
        admin.from("commerce_transactions").select("*").order("created_at", { ascending: false }).limit(100),
      ]);

      const totalRevenue = (payments || []).reduce((sum, p) => sum + (p.status === "completed" ? Number(p.amount) : 0), 0);
      const activeSubscriptions = (subscriptions || []).filter((s) => s.status === "active").length;

      return json(res, 200, {
        plans: (plans || []).map((p) => ({
          id: p.id,
          name: p.name,
          monthlyCredits: Number(p.monthly_credits),
          maxApiKeys: p.max_api_keys,
          maxTeamMembers: p.max_team_members,
          priorityRouting: p.priority_routing,
          rateLimit: p.rate_limit,
          monthlyPrice: Number(p.monthly_price),
          annualPrice: Number(p.annual_price),
          status: p.status,
        })),
        creditPackages: (packages || []).map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          credits: Number(p.credits),
          price: Number(p.price),
          currency: p.currency,
          taxRate: Number(p.tax_rate),
          status: p.status,
        })),
        orders: (orders || []).map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          userId: o.user_id,
          type: o.order_type,
          total: Number(o.total),
          status: o.status,
          provider: o.provider,
          createdAt: o.created_at,
        })),
        invoices: (invoices || []).map((i) => ({
          id: i.id,
          invoiceNumber: i.invoice_number,
          userId: i.user_id,
          total: Number(i.total),
          status: i.status,
          createdAt: i.created_at,
        })),
        coupons: (coupons || []).map((c) => ({
          id: c.id,
          code: c.code,
          discountType: c.discount_type,
          discountValue: Number(c.discount_value),
          usageCount: c.usage_count,
          usageLimit: c.usage_limit,
          perUserLimit: c.per_user_limit,
          status: c.status,
          expiresAt: c.expires_at,
        })),
        subscriptions: (subscriptions || []).map((s) => ({
          id: s.id,
          userId: s.user_id,
          plan: s.plan,
          status: s.status,
          credits: Number(s.credits),
          renewAt: s.renew_at,
          createdAt: s.created_at,
        })),
        transactions: (transactions || []).map((t) => ({
          id: t.id,
          userId: t.user_id,
          provider: t.provider,
          amount: Number(t.amount),
          status: t.status,
          createdAt: t.created_at,
        })),
        revenue: {
          totalRevenue: Number(totalRevenue.toFixed(2)),
          activeSubscriptions,
          orderCount: (orders || []).length,
          invoiceCount: (invoices || []).length,
        },
        paymentProviders: listProviders(),
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const action = body.action;

      if (action === "create_coupon") {
        const { data } = await admin
          .from("coupons")
          .insert({
            code: String(body.code || "").toUpperCase(),
            discount_type: body.discountType || "percentage",
            discount_value: Number(body.discountValue) || 10,
            usage_limit: body.usageLimit ?? null,
            per_user_limit: body.perUserLimit ?? 1,
            per_company_limit: body.perCompanyLimit ?? null,
            expires_at: body.expiresAt || null,
            status: "active",
          })
          .select()
          .single();
        return json(res, 200, { ok: true, coupon: data });
      }

      if (action === "update_plan") {
        const { data } = await admin
          .from("subscription_plans")
          .update({
            monthly_price: body.monthlyPrice,
            annual_price: body.annualPrice,
            monthly_credits: body.monthlyCredits,
            status: body.status,
          })
          .eq("id", body.planId)
          .select()
          .single();
        return json(res, 200, { ok: true, plan: data });
      }

      return json(res, 400, { error: "Unknown action" });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[admin/commerce]", err);
    return json(res, err.status || 500, { error: err.message || "Commerce request failed" });
  }
};
