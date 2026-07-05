(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAnthropicAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  return Base.createProviderAdapter({
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    chatPath: "/messages",
    healthPath: "/models",
    headers: { "anthropic-version": "2023-06-01" },
    mockLatency: [300, 380],
    inputPer1M: 3,
    outputPer1M: 15,
    models: [
      { id: "claude-4-opus", name: "Claude 4 Opus", context: "200K", inputPer1M: 3, outputPer1M: 15 },
      { id: "claude-4-sonnet", name: "Claude 4 Sonnet", context: "200K", inputPer1M: 1.8, outputPer1M: 9 },
    ],
    mockTemplate:
      "Certainly. Let's think through this carefully.\n\nRegarding your request, Claude provides a methodical, balanced answer optimized for enterprise writing and reasoning workloads.",
  });
});
