(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaOpenAICompatibleAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  return Base.createProviderAdapter({
    id: "openai_compatible",
    name: "OpenAI Compatible",
    baseUrl: "https://api.example.com/v1",
    mockLatency: [300, 500],
    inputPer1M: 1,
    outputPer1M: 2,
    models: [
      { id: "custom-model", name: "Custom Model", context: "32K", inputPer1M: 1, outputPer1M: 2 },
    ],
    mockTemplate:
      "OpenAI-compatible endpoint response:\n\nUnified chat completion format for self-hosted or third-party compatible gateways.",
  });
});
