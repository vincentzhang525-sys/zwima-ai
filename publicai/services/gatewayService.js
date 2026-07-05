(function () {
  window.ZwimaGatewayService = {
    chat(payload) {
      return window.ZwimaDatabase.queryApi("/api/gateway/chat", "POST", payload).then((r) => r.data);
    },
    embeddings(payload) {
      return window.ZwimaDatabase.queryApi("/api/gateway/embeddings", "POST", payload).then((r) => r.data);
    },
    image(payload) {
      return window.ZwimaDatabase.queryApi("/api/gateway/image", "POST", payload).then((r) => r.data);
    },
    audio(payload) {
      return window.ZwimaDatabase.queryApi("/api/gateway/audio", "POST", payload).then((r) => r.data);
    },
    listModels(providerId) {
      const path = providerId ? `/api/gateway/models?provider=${encodeURIComponent(providerId)}` : "/api/gateway/models";
      return window.ZwimaDatabase.queryApi(path, "GET").then((r) => r.data);
    },
    route(payload) {
      return window.ZwimaDatabase.queryApi("/api/gateway/route", "POST", payload).then((r) => r.data);
    },
    getHealth() {
      return window.ZwimaDatabase.queryApi("/api/gateway/health", "GET").then((r) => r.data);
    },
    getProviders() {
      return window.ZwimaDatabase.queryApi("/api/gateway/providers", "GET").then((r) => r.data);
    },
    getMode() {
      return window.ZWIMA_CONFIG?.GATEWAY_MODE || "mock";
    },
    getPlaygroundMode() {
      const stored = window.ZwimaStorage?.getRaw("PLAYGROUND_MODE");
      return stored === "real" ? "real" : "mock";
    },
  };
})();
