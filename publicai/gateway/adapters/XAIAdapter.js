(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaXAIAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  return Base.createProviderAdapter({
    id: "xai",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    chatPath: "/chat/completions",
    healthPath: "/models",
    mockLatency: [320, 420],
    inputPer1M: 2,
    outputPer1M: 10,
    models: [
      { id: "grok-2-latest", name: "Grok 2", context: "128K", inputPer1M: 2, outputPer1M: 10, capabilities: ["chat", "vision"] },
      { id: "grok-beta", name: "Grok Beta", context: "128K", inputPer1M: 2, outputPer1M: 10, capabilities: ["chat"] },
    ],
    mockTemplate:
      "Grok response:\n\nI've analyzed your request with xAI's reasoning engine and prepared a direct, insightful answer.",
  });
});
