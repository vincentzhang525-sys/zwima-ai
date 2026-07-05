(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaMistralAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  return Base.createProviderAdapter({
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    mockLatency: [250, 330],
    inputPer1M: 0.8,
    outputPer1M: 2.4,
    models: [
      { id: "mistral-large", name: "Mistral Large", context: "128K", inputPer1M: 0.8, outputPer1M: 2.4 },
      { id: "mistral-small", name: "Mistral Small", context: "128K", inputPer1M: 0.3, outputPer1M: 0.9 },
    ],
    mockTemplate:
      "Mistral (Europe routing):\n\nEnterprise-grade response optimized for European compliance and efficient coding workloads.",
  });
});
