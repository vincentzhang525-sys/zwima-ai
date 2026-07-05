(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaOpenRouterAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  return Base.createProviderAdapter({
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    mockLatency: [350, 450],
    inputPer1M: 0.4,
    outputPer1M: 1.2,
    models: [
      { id: "openrouter/auto", name: "OpenRouter Auto", context: "128K", inputPer1M: 0.4, outputPer1M: 1.2 },
    ],
    mockTemplate:
      "OpenRouter aggregated route:\n\nLowest-cost path selected across upstream providers with unified OpenAI-compatible formatting.",
  });
});
