const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");
const { getRuntimeProfile, getCommercialBlockers } = require("../lib/commercial/environment");
const { getCompanyConfig, getMissingLegalFields } = require("../lib/commercial/companyConfig");
const { verifySmtpConnection } = require("../lib/email");
const { getStripeConfig } = require("../lib/payments/stripeConfig");
const { redactSmtpConfig, redactStripeKeys } = require("../lib/email/redact");
const ledger = require("../lib/credits/ledger");
const providerRegistry = require("../../config/providerRegistry.js");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const { admin } = await requireAdmin(req);
    const profile = getRuntimeProfile();
    const stripeCfg = getStripeConfig();
    const smtpVerify = await verifySmtpConnection();
    const reconciliation = await ledger.reconcileAllWallets(admin, 50);

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let webhookCount = 0;
    try {
      const { count } = await admin.from("stripe_webhook_events").select("*", { count: "exact", head: true }).gte("processed_at", since7d);
      webhookCount = count || 0;
    } catch {
      webhookCount = 0;
    }

    const [
      { data: pendingOrders },
      { data: completedPayments },
      { count: userCount },
      { count: registrations24h },
      { data: revenueRows },
      { count: gatewayErrors24h },
      { count: dailyUsage },
    ] = await Promise.all([
      admin.from("orders").select("id").eq("status", "pending"),
      admin.from("payments").select("id, amount").eq("status", "completed").gte("created_at", since30d),
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since24h),
      admin.from("payments").select("amount").eq("status", "completed").gte("created_at", since30d),
      admin.from("gateway_request_logs").select("*", { count: "exact", head: true }).eq("status", "error").gte("created_at", since24h),
      admin.from("usage_records").select("*", { count: "exact", head: true }).gte("created_at", since24h),
    ]);

    const revenue30d = (revenueRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const providers = providerRegistry.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      enabled: p.enabled,
      configured: Boolean(p.configured),
    }));

    const cfg = getCompanyConfig();
    const SmtpEmailProvider = require("../lib/email/SmtpEmailProvider");
    const smtpProvider = new SmtpEmailProvider();
    const keys = redactStripeKeys();

    let gatewayHealth = "unknown";
    try {
      const gh = await fetch(`${process.env.PLATFORM_URL || "https://zwima-group.info"}/api/gateway/health`).then((r) => r.json());
      gatewayHealth = gh?.status || "ok";
    } catch {
      gatewayHealth = "unreachable";
    }

    return json(res, 200, {
      runtime: profile,
      platformHealth: profile.emailFailClosed || profile.paymentFailClosed ? "degraded" : "healthy",
      email: {
        providerKind: profile.emailProviderKind,
        modeLabel: require("../lib/email").getEmailModeLabel(),
        smtpConfigured: profile.smtpConfigured,
        connection: { ok: smtpVerify.ok, error: smtpVerify.error || null },
        smtp: redactSmtpConfig(smtpProvider.getConfig()),
        failClosed: profile.emailFailClosed,
      },
      stripe: {
        mode: stripeCfg.mode,
        keysPresent: stripeCfg.keysPresent,
        webhookConfigured: stripeCfg.webhookConfigured,
        failClosed: stripeCfg.failClosed,
        webhookEvents7d: webhookCount || 0,
        keys,
      },
      gateway: { status: gatewayHealth },
      reconciliation: {
        walletsChecked: reconciliation.checked,
        mismatches: reconciliation.mismatches,
        samples: reconciliation.samples,
      },
      payments: {
        pendingOrders: (pendingOrders || []).length,
        completedPayments30d: (completedPayments || []).length,
        revenue30d: Number(revenue30d.toFixed(2)),
      },
      usage: { requests24h: dailyUsage || 0 },
      users: { total: userCount || 0, registrations24h: registrations24h || 0 },
      errors: { gatewayErrors24h: gatewayErrors24h || 0 },
      legal: {
        company: {
          legalName: cfg.legalName,
          address: `${cfg.street}, ${cfg.postalCode} ${cfg.city}, ${cfg.country}`,
          email: cfg.email,
          website: cfg.website,
          vatId: cfg.vatId,
        },
        missingFields: getMissingLegalFields(),
      },
      providers,
      blockers: getCommercialBlockers(),
      launchReady: getCommercialBlockers().filter((b) => b.severity === "critical").length === 0,
    });
  } catch (err) {
    console.error("[admin/commercial-health]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load commercial health" });
  }
};
