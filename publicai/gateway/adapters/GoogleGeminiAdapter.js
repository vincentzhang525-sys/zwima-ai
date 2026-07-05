(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaGoogleGeminiAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  return Base.createProviderAdapter({
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    chatPath: "/models/gemini-2.5-pro:generateContent",
    healthPath: "/models",
    mockLatency: [240, 320],
    inputPer1M: 1.2,
    outputPer1M: 5,
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", context: "1M", inputPer1M: 1.2, outputPer1M: 5 },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", context: "1M", inputPer1M: 0.6, outputPer1M: 2.5 },
    ],
    mockTemplate:
      "I can help you with that.\n\nGemini has summarized your request and produced a concise, practical response with multimodal-ready formatting.",
  });
});
