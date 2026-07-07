const { json, handleOptions, withCors, getAdminClient } = require("../lib/supabase");
const providerRegistry = require("../../config/providerRegistry.js");
const modelRegistry = require("../../config/modelRegistry.js");
const ProviderAdapters = require("../../gateway/adapters");
const healthChecker = require("../../gateway/healthChecker.js");
const support = require("../lib/support");

const PUBLIC_PROVIDERS = [
  { id: "openai", name: "OpenAI", availability: "live", availabilityLabel: "Live" },
  { id: "google", name: "Google Gemini", availability: "live", availabilityLabel: "Live" },
  { id: "anthropic", name: "Claude", availability: "waiting_api_key", availabilityLabel: "Waiting API Key" },
  { id: "deepseek", name: "DeepSeek", availability: "waiting_balance", availabilityLabel: "Waiting Balance / API Key" },
  { id: "qwen", name: "Qwen", availability: "waiting_api_key", availabilityLabel: "Waiting API Key" },
  { id: "mistral", name: "Mistral", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  { id: "openrouter", name: "OpenRouter", availability: "coming_soon", availabilityLabel: "Coming Soon" },
];

const SYSTEM_COMPONENTS = [
  { id: "gateway", name: "Gateway", check: "gateway" },
  { id: "authentication", name: "Authentication", check: "auth" },
  { id: "billing", name: "Billing", check: "billing" },
  { id: "database", name: "Database", check: "database" },
  { id: "smtp", name: "SMTP", check: "smtp" },
];

async function checkSystemComponent(id) {
  const start = Date.now();
  try {
    if (id === "gateway") {
      const res = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost"}/api/gateway/health`).catch(() => null);
      if (!res) return { status: "operational", latencyMs: Date.now() - start };
      const ok = res.ok;
      return { status: ok ? "operational" : "degraded", latencyMs: Date.now() - start };
    }
    if (id === "authentication") {
      const admin = getAdminClient();
      const { error } = await admin.from("profiles").select("id").limit(1);
      return { status: error ? "degraded" : "operational", latencyMs: Date.now() - start };
    }
    if (id === "billing") {
      const admin = getAdminClient();
      const { error } = await admin.from("subscription_plans").select("id").limit(1);
      return { status: error ? "degraded" : "operational", latencyMs: Date.now() - start };
    }
    if (id === "database") {
      const admin = getAdminClient();
      const t0 = Date.now();
      const { error } = await admin.from("profiles").select("id").limit(1);
      return { status: error ? "offline" : "operational", latencyMs: Date.now() - t0 };
    }
    if (id === "smtp") {
      const emailStatus = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost"}/api/email/status`).catch(() => null);
      if (!emailStatus?.ok) return { status: "degraded", latencyMs: Date.now() - start };
      const data = await emailStatus.json();
      const live = data.massSendingEnabled && data.provider !== "mock";
      return { status: live ? "operational" : "degraded", latencyMs: Date.now() - start };
    }
  } catch {
    return { status: "offline", latencyMs: Date.now() - start };
  }
  return { status: "operational", latencyMs: Date.now() - start };
}

function mapHealthStatus(health, availability) {
  if (availability !== "live") {
    if (availability === "coming_soon") return "maintenance";
    return "degraded";
  }
  return support.healthToImpact(health === "online" ? "operational" : health === "inactive" ? "offline" : health);
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const host = req.headers.host || "zwima-group.info";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const base = `${proto}://${host}`;

    const providerResults = await Promise.all(
      PUBLIC_PROVIDERS.map(async (def) => {
        let health = "not_configured";
        let healthLabel = "Not configured";
        let latencyMs = 0;
        try {
          const adapterId = providerRegistry.getAdapterId(def.id);
          const adapter = ProviderAdapters.getAdapter(adapterId);
          const configured = providerRegistry.isConfigured(def);
          const check = await healthChecker.checkProvider(adapter, configured);
          health = check.healthStatus;
          healthLabel = healthChecker.label(check.healthStatus);
          latencyMs = check.latencyMs || 0;
        } catch {
          health = "inactive";
          healthLabel = "Inactive";
        }
        const models = modelRegistry.getByProvider(def.id).map((m) => ({
          id: m.id,
          displayName: m.displayName,
          status: m.status,
        }));
        const availability = def.availability === "live" && health === "online" ? "live" : def.availability;
        const operationalStatus = mapHealthStatus(health, availability);
        return {
          provider: def.name,
          providerId: def.id,
          health,
          healthLabel,
          latencyMs,
          operationalStatus,
          models,
          modelCount: models.length,
          availability,
          availabilityLabel: def.availabilityLabel,
        };
      })
    );

    const componentResults = await Promise.all(
      SYSTEM_COMPONENTS.map(async (comp) => {
        let status = "operational";
        let latencyMs = 0;
        if (comp.id === "gateway") {
          const t0 = Date.now();
          const gw = await fetch(`${base}/api/gateway/health`);
          latencyMs = Date.now() - t0;
          status = gw.ok ? "operational" : "degraded";
        } else if (comp.id === "authentication" || comp.id === "database") {
          const admin = getAdminClient();
          const t0 = Date.now();
          const { error } = await admin.from("profiles").select("id").limit(1);
          latencyMs = Date.now() - t0;
          status = error ? "offline" : "operational";
        } else if (comp.id === "billing") {
          const admin = getAdminClient();
          const t0 = Date.now();
          const { error } = await admin.from("credit_packages").select("id").limit(1);
          latencyMs = Date.now() - t0;
          status = error ? "degraded" : "operational";
        } else if (comp.id === "smtp") {
          const t0 = Date.now();
          const em = await fetch(`${base}/api/email/status`);
          latencyMs = Date.now() - t0;
          if (!em.ok) status = "degraded";
          else {
            const data = await em.json();
            status = data.massSendingEnabled && !String(data.provider || "").includes("mock") ? "operational" : "degraded";
          }
        }
        return { id: comp.id, name: comp.name, operationalStatus: status, latencyMs };
      })
    );

    const admin = getAdminClient();
    const { data: incidents } = await admin
      .from("status_incidents")
      .select("*")
      .eq("published", true)
      .neq("incident_status", "resolved")
      .order("starts_at", { ascending: false })
      .limit(5);

    for (const comp of componentResults) {
      const match = (incidents || []).find((i) => i.component === comp.id && !i.resolved_at);
      if (match) comp.operationalStatus = match.impact;
    }
    for (const p of providerResults) {
      const match = (incidents || []).find((i) => i.component === p.providerId && !i.resolved_at);
      if (match) p.operationalStatus = match.impact;
    }

    const liveCount = providerResults.filter((r) => r.availability === "live" && r.operationalStatus === "operational").length;
    const degradedComponents = [...providerResults, ...componentResults].filter((c) => c.operationalStatus !== "operational");

    return json(res, 200, {
      status: degradedComponents.length === 0 ? "operational" : liveCount >= 2 ? "degraded" : "major_outage",
      providers: providerResults,
      components: componentResults,
      activeIncidents: (incidents || []).map(support.mapIncident),
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[status/public]", err);
    return json(res, 500, { error: err.message || "Status check failed" });
  }
};
