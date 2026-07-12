/**
 * Sprint 47A — Commercial Core Architecture
 * Unified registry, pricing, routing V2, and request audit modules.
 *
 * Integration flag: set COMMERCIAL_CORE_V2=true to enable in gateway (future sprint).
 */
const providerRegistry = require("./providerRegistry");
const modelRegistry = require("./modelRegistry");
const pricingEngine = require("./pricingEngine");
const routingEngineV2 = require("./routingEngineV2");
const requestAudit = require("./requestAudit");

function isEnabled() {
  return String(process.env.COMMERCIAL_CORE_V2 || "").toLowerCase() === "true";
}

module.exports = {
  isEnabled,
  providerRegistry,
  modelRegistry,
  pricingEngine,
  routingEngineV2,
  requestAudit,
};
