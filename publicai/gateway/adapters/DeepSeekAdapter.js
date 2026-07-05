(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaDeepSeekAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  return Base.createProviderAdapter({
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    mockLatency: [190, 260],
    inputPer1M: 0.5,
    outputPer1M: 1.5,
    models: [
      { id: "deepseek-r1", name: "DeepSeek R1", context: "128K", inputPer1M: 0.5, outputPer1M: 1.5 },
      { id: "deepseek-v3", name: "DeepSeek V3", context: "128K", inputPer1M: 0.4, outputPer1M: 1.2 },
    ],
    mockTemplate:
      "DeepSeek analysis:\n\nCost-efficient reasoning output focused on coding accuracy and structured technical guidance.",
  });
});
