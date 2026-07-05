(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaRoutingEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ProviderAdapters =
    typeof ZwimaProviderAdapters !== "undefined" ? ZwimaProviderAdapters : require("./adapters");

  const KEYWORD_RULES = [
    { match: (t) => t.includes("image"), provider: "openai", reason: "Keyword rule: image generation" },
    { match: (t) => t.includes("code") || t.includes("python"), provider: "deepseek", reason: "Keyword rule: coding" },
    { match: (t) => t.includes("translate"), provider: "qwen", reason: "Keyword rule: translation" },
    { match: (t) => t.includes("creative") || t.includes("write"), provider: "anthropic", reason: "Keyword rule: creative writing" },
    { match: (t) => t.includes("cheap"), provider: "openrouter", reason: "Keyword rule: cost optimization" },
  ];

  function scoreProvider(id, { strategy, health, manager }) {
    const h = health[id] || {};
    const cfg = manager.getProvider(id);
    if (!cfg?.enabled) return -1;

    const latency = Number(h.latency) || 500;
    const availability = Number(h.availability) || 95;
    const costScore = id === "openrouter" || id === "deepseek" ? 100 : id === "google" ? 80 : 60;
    const latencyScore = Math.max(0, 1000 - latency);
    const priorityScore = (10 - (cfg.priority || 10)) * 10;
    const weightScore = cfg.weight || 50;
    const availabilityScore = availability * 10;

    if (strategy === "Lowest Cost" || strategy === "cost") {
      return costScore * 3 + availabilityScore + weightScore * 0.2;
    }
    if (strategy === "Fastest Response" || strategy === "latency") {
      return latencyScore * 3 + availabilityScore + priorityScore;
    }
    if (strategy === "Highest Quality" || strategy === "priority") {
      return priorityScore * 4 + weightScore + availabilityScore;
    }
    if (strategy === "availability") {
      return availabilityScore * 4 + latencyScore + priorityScore * 0.5;
    }

    return priorityScore * 2 + weightScore + availabilityScore * 0.5 + latencyScore * 0.3 + costScore * 0.2;
  }

  function createRoutingEngine(providerManager) {
    return {
      selectProvider({ providerId, prompt, strategy, priorityOrder }) {
        const manager = providerManager;
        const health = manager.getHealthSnapshot();
        const text = String(prompt || "").toLowerCase();

        if (providerId && manager.isEnabled(providerId)) {
          const adapter = ProviderAdapters.getAdapter(providerId);
          return {
            providerId,
            provider: adapter?.name || providerId,
            reason: "Explicit provider selected",
            strategy: strategy || "manual",
          };
        }

        for (const rule of KEYWORD_RULES) {
          if (rule.match(text) && manager.isEnabled(rule.provider)) {
            const adapter = ProviderAdapters.getAdapter(rule.provider);
            return {
              providerId: rule.provider,
              provider: adapter?.name || rule.provider,
              reason: rule.reason,
              strategy: strategy || "keyword",
            };
          }
        }

        const candidates = (priorityOrder || manager.getEnabledProviders().map((p) => p.id)).filter((id) =>
          manager.isEnabled(id)
        );

        let best = candidates[0] || "openai";
        let bestScore = -1;
        candidates.forEach((id) => {
          const score = scoreProvider(id, { strategy: strategy || "balanced", health, manager });
          if (score > bestScore) {
            bestScore = score;
            best = id;
          }
        });

        const adapter = ProviderAdapters.getAdapter(best);
        return {
          providerId: best,
          provider: adapter?.name || best,
          reason: `Routing engine selected by ${strategy || "balanced"} (score ${Math.round(bestScore)})`,
          strategy: strategy || "balanced",
          score: bestScore,
        };
      },

      simulateRouting(prompt, strategy, priorityOrder, providerManager) {
        const route = this.selectProvider({ prompt, strategy, priorityOrder });
        const health = providerManager.getHealthSnapshot();
        const h = health[route.providerId] || {};
        return {
          provider: route.provider,
          providerId: route.providerId,
          reason: route.reason,
          strategy: route.strategy,
          estimatedLatency: `${h.latency || 300} ms`,
          estimatedCost: route.providerId === "openrouter" ? "€0.04 / 1K tokens" : "€0.10 / 1K tokens",
          availability: h.availability ? `${h.availability}%` : "99.0%",
        };
      },
    };
  }

  return { createRoutingEngine, scoreProvider };
});
