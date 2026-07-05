(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaQwenAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  return Base.createProviderAdapter({
    id: "qwen",
    name: "Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    mockLatency: [260, 340],
    inputPer1M: 0.6,
    outputPer1M: 2,
    models: [
      { id: "qwen-max", name: "Qwen Max", context: "128K", inputPer1M: 0.6, outputPer1M: 2 },
      { id: "qwen-plus", name: "Qwen Plus", context: "128K", inputPer1M: 0.4, outputPer1M: 1.2 },
    ],
    mockTemplate:
      "Qwen enterprise response:\n\nStructured answer optimized for translation, coding, and multilingual enterprise scenarios.",
  });
});
