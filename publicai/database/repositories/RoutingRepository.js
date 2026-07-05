(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaRoutingRepository = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomFloat(min, max) {
    return (Math.random() * (max - min) + min).toFixed(1);
  }

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "routing", { isArray: false, idField: "id" });

    return {
      ...base,
      findAll() {
        return adapter.findAll("routing");
      },
      getRules() {
        return this.findAll().then((data) => data.rules || []);
      },
      getProviderPriority() {
        return this.findAll().then((data) => data.providerPriority || []);
      },
      getRoutingLog() {
        return this.findAll().then((data) => data.routingLog || []);
      },
      getLiveStatus() {
        return this.findAll().then((data) => {
          const order = data.providerPriority || [];
          return order.map((name) => {
            const baseStatus = data.statusBase?.[name];
            if (!baseStatus) return { name, latency: "—", availability: "—", cost: "—" };
            return {
              name,
              latency: `${randomBetween(baseStatus.latency[0], baseStatus.latency[1])} ms`,
              availability: `${randomFloat(baseStatus.availability[0], baseStatus.availability[1])}%`,
              cost: `${baseStatus.cost[randomBetween(0, 1)]} / 1K`,
            };
          });
        });
      },
      getOptimizerMetrics() {
        return Promise.resolve({
          monthlySaving: `€${randomBetween(380, 480)}`,
          tokenCost: `€${(Math.random() * 0.04 + 0.07).toFixed(3)} / 1K`,
          avgLatency: `${randomBetween(220, 280)} ms`,
          avgQuality: `${(Math.random() * 0.6 + 8.4).toFixed(1)} / 10`,
        });
      },
      simulateRouting(prompt, strategy, priorityOrder) {
        return this.findAll().then((data) => {
          const text = String(prompt || "").toLowerCase();
          const order = priorityOrder || data.providerPriority;
          let provider = order?.[0] || "OpenAI";
          let reason = `Strategy "${strategy}" selected ${provider}`;

          if (text.includes("image")) { provider = "OpenAI"; reason = "Routing rule matched: If Image"; }
          else if (text.includes("code") || text.includes("python")) { provider = "DeepSeek"; reason = "Routing rule matched: If Coding"; }
          else if (text.includes("translate")) { provider = "Qwen"; reason = "Routing rule matched: If Translation"; }
          else if (text.includes("creative") || text.includes("write")) { provider = "Claude"; reason = "Routing rule matched: If Creative Writing"; }
          else if (text.includes("cheap")) { provider = "OpenRouter"; reason = "Routing rule matched: If Cheap Mode"; }
          else if (strategy === "Lowest Cost") { provider = "OpenRouter"; reason = 'Strategy "Lowest Cost" selected OpenRouter'; }
          else if (strategy === "Fastest Response") { provider = "Gemini"; reason = 'Strategy "Fastest Response" selected Gemini'; }
          else if (strategy === "Highest Quality") { provider = "Claude"; reason = 'Strategy "Highest Quality" selected Claude'; }

          const baseStatus = data.statusBase[provider];
          const latency = randomBetween(baseStatus.latency[0], baseStatus.latency[1]);
          return {
            provider,
            reason,
            estimatedCost: `${baseStatus.cost[0]} / 1K tokens`,
            estimatedLatency: `${latency} ms`,
          };
        });
      },
      appendLog(entry) {
        return this.findAll().then((doc) => {
          doc.routingLog = [entry, ...(doc.routingLog || [])].slice(0, 20);
          return adapter.setDocument("routing", doc);
        });
      },
      findById(id) {
        return this.getRules().then((rules) => rules.find((r) => r.id === id) || null);
      },
    };
  }

  return { create };
});
