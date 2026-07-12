const { parseBody, json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");
const commercial = require("../lib/commercial");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { admin } = await requireAdmin(req);
    const body = parseBody(req);

    if (req.method === "GET") {
      const section = req.query?.section || "overview";

      if (section === "overview") {
        const [providers, models, audits, metrics] = await Promise.all([
          commercial.providerRegistry.getAll(),
          commercial.modelRegistry.getAll(),
          commercial.requestAudit.queryAudits({}, 20),
          commercial.requestAudit.aggregateMetrics(),
        ]);
        const { data: pricingRules } = await admin.from("commercial_pricing_rules").select("*").order("priority");
        const { data: routingPolicies } = await admin.from("commercial_routing_policies").select("*").order("priority");

        return json(res, 200, {
          enabled: commercial.isEnabled(),
          architecture: "sprint47a",
          providers: { count: providers.length, active: providers.filter((p) => p.status === "active").length, items: providers },
          models: { count: models.length, active: models.filter((m) => m.availability === "active").length, items: models },
          pricingRules: pricingRules || [],
          routingPolicies: routingPolicies || [],
          recentAudits: audits,
          metrics,
        });
      }

      if (section === "providers") {
        const providers = await commercial.providerRegistry.getAll();
        return json(res, 200, { providers });
      }

      if (section === "models") {
        const models = await commercial.modelRegistry.getAll({
          providerId: req.query?.providerId,
        });
        return json(res, 200, { models });
      }

      if (section === "pricing") {
        const { data } = await admin.from("commercial_pricing_rules").select("*").order("priority");
        return json(res, 200, { rules: data || [] });
      }

      if (section === "routing") {
        const { data } = await admin.from("commercial_routing_policies").select("*").order("priority");
        return json(res, 200, { policies: data || [] });
      }

      if (section === "audit") {
        const audits = await commercial.requestAudit.queryAudits(
          {
            providerId: req.query?.providerId,
            organizationId: req.query?.organizationId,
          },
          Number(req.query?.limit) || 100
        );
        const metrics = await commercial.requestAudit.aggregateMetrics();
        return json(res, 200, { audits, metrics });
      }

      if (section === "health") {
        const providers = await commercial.providerRegistry.getAll();
        return json(res, 200, {
          providers: providers.map((p) => ({
            id: p.id,
            name: p.name,
            healthStatus: p.healthStatus,
            healthScore: p.healthScore,
            avgLatencyMs: p.avgLatencyMs,
            status: p.status,
          })),
        });
      }

      return json(res, 400, { error: "Unknown section" });
    }

    if (req.method === "POST") {
      const action = body.action;

      if (action === "simulate_pricing") {
        const model = await commercial.modelRegistry.getById(body.modelId || "gpt-4o");
        const provider = await commercial.providerRegistry.getById(model?.providerId || "openai");
        const result = await commercial.pricingEngine.calculateRequestPricing({
          inputTokens: Number(body.inputTokens) || 1000,
          outputTokens: Number(body.outputTokens) || 500,
          model,
          provider,
          organizationId: body.organizationId,
        });
        return json(res, 200, { ok: true, pricing: result });
      }

      if (action === "simulate_routing") {
        const route = await commercial.routingEngineV2.resolveRoute({
          organizationId: body.organizationId,
          region: body.region,
          explicitModelId: body.modelId,
          explicitProviderId: body.providerId,
          requiredCapabilities: body.capabilities,
        });
        return json(res, 200, {
          ok: true,
          route: {
            providerId: route.provider?.id,
            modelId: route.model?.id,
            routingReason: route.routingReason,
            score: route.score,
            fallbackChain: route.fallbackChain,
          },
        });
      }

      if (action === "update_provider") {
        const { providerId, patch } = body;
        const { data, error } = await admin
          .from("commercial_providers")
          .update(patch)
          .eq("id", providerId)
          .select()
          .single();
        if (error) throw error;
        return json(res, 200, { ok: true, provider: commercial.providerRegistry.mapProvider(data) });
      }

      return json(res, 400, { error: "Unknown action" });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[admin/commercial]", err);
    return json(res, err.status || 500, { error: err.message || "Commercial admin request failed" });
  }
};
