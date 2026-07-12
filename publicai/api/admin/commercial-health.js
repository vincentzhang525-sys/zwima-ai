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
    const stripe = getStripeConfig();
    const smtpVerify = await verifySmtpConnection();
    const reconciliation = await ledger.reconcileAllWallets(admin, 50);

    let webhookCount = 0;
    try {
      const { count } = await admin
        .from("stripe_webhook_events")
        .select("*", { count: "exact", head: true })
        .gte("processed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      webhookCount = count || 0;
    } catch {
      webhookCount = 0;
    }

    const { data: pendingOrders } = await admin.from("orders").select("id").eq("status", "pending");
    const { data: completedPayments } = await admin
      .from("payments")
      .select("id")
      .eq("status", "completed")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

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

    return json(res, 200, {
      runtime: profile,
      email: {
        providerKind: profile.emailProviderKind,
        modeLabel: require("../lib/email").getEmailModeLabel(),
        smtpConfigured: profile.smtpConfigured,
        connection: { ok: smtpVerify.ok, error: smtpVerify.error || null },
        smtp: redactSmtpConfig(smtpProvider.getConfig()),
        failClosed: profile.emailFailClosed,
      },
      stripe: {
        ...stripe,
        keys: redactStripeKeys(),
        webhookEvents7d: webhookCount || 0,
      },
      reconciliation: {
        walletsChecked: reconciliation.checked,
        mismatches: reconciliation.mismatches,
        samples: reconciliation.samples,
      },
      payments: {
        pendingOrders: (pendingOrders || []).length,
        completedPayments30d: (completedPayments || []).length,
      },
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
