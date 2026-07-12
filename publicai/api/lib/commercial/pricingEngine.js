const { getAdminClient } = require("../supabase");

/**
 * Pricing Engine — calculates provider cost, customer price, margin, tax.
 * Supports: fixed_margin, percentage_margin, custom_margin, enterprise_margin
 */

async function resolvePricingRule(context = {}) {
  const admin = getAdminClient();
  const { organizationId, providerId, modelId, planId } = context;

  const { data: rules } = await admin
    .from("commercial_pricing_rules")
    .select("*")
    .eq("status", "active")
    .order("priority");

  const now = new Date().toISOString();
  const active = (rules || []).filter((r) => {
    if (r.effective_until && r.effective_until < now) return false;
    if (r.effective_from && r.effective_from > now) return false;
    return true;
  });

  const match =
    active.find((r) => r.applies_to === "organization" && r.organization_id === organizationId) ||
    active.find((r) => r.applies_to === "model" && r.target_id === modelId) ||
    active.find((r) => r.applies_to === "provider" && r.target_id === providerId) ||
    active.find((r) => r.applies_to === "plan" && r.target_id === planId) ||
    active.find((r) => r.applies_to === "all");

  return match || {
    rule_type: "percentage_margin",
    margin_value: 25,
    margin_unit: "percent",
    tax_rate_pct: 19,
    currency: "EUR",
  };
}

function computeProviderCost({ inputTokens, outputTokens, model }) {
  const inputPrice = Number(model?.inputPricePer1m || model?.input_price_per_1m || 0);
  const outputPrice = Number(model?.outputPricePer1m || model?.output_price_per_1m || 0);
  const cost = (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
  return Number(cost.toFixed(6));
}

function applyMargin(providerCost, rule, providerDefaultMargin) {
  const type = rule.rule_type || "percentage_margin";
  const value = Number(rule.margin_value ?? providerDefaultMargin ?? 25);

  switch (type) {
    case "fixed_margin":
      return Number((providerCost + value).toFixed(6));
    case "custom_margin":
      return Number((providerCost * (1 + value / 100)).toFixed(6));
    case "enterprise_margin":
    case "percentage_margin":
    default:
      return Number((providerCost * (1 + value / 100)).toFixed(6));
  }
}

function computeTax(amount, taxRatePct) {
  const rate = Number(taxRatePct || 0) / 100;
  return Number((amount * rate).toFixed(6));
}

/**
 * @returns {Promise<PricingResult>}
 */
async function calculateRequestPricing({
  inputTokens = 0,
  outputTokens = 0,
  model,
  provider,
  organizationId,
  planId,
}) {
  const rule = await resolvePricingRule({
    organizationId,
    providerId: provider?.id || model?.providerId,
    modelId: model?.id,
    planId,
  });

  const providerCost = computeProviderCost({ inputTokens, outputTokens, model });
  const customerPrice = applyMargin(providerCost, rule, provider?.profitMarginPct);
  const grossMargin = Number((customerPrice - providerCost).toFixed(6));
  const marginPct = providerCost > 0 ? Number(((grossMargin / providerCost) * 100).toFixed(4)) : 0;
  const tax = computeTax(customerPrice, rule.tax_rate_pct);
  const finalPrice = Number((customerPrice + tax).toFixed(6));

  return {
    providerCost,
    customerPrice,
    grossMargin,
    marginPct,
    tax,
    finalPrice,
    currency: rule.currency || "EUR",
    ruleType: rule.rule_type,
    ruleName: rule.name || "default",
  };
}

module.exports = {
  resolvePricingRule,
  computeProviderCost,
  applyMargin,
  computeTax,
  calculateRequestPricing,
};
