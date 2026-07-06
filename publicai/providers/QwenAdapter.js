(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.ZwimaProviders = root.ZwimaProviders || {};
    root.ZwimaProviders.QwenAdapter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProvider !== "undefined" ? ZwimaBaseProvider : require("./BaseProvider");

  return Base.createPlaceholderAdapter({
    providerId: "qwen",
    name: "Qwen",
  });
});
