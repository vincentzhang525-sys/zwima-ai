(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaModelCards = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const registry =
    typeof ZwimaModelRegistry !== "undefined" ? ZwimaModelRegistry : null;

  const CARD_META = {
    "gpt-4o": { speed: "Fast", quality: "Excellent", priceLevel: "Medium", recommendedUse: "General chat, vision, agents" },
    "gpt-4.1": { speed: "Fast", quality: "Excellent", priceLevel: "Medium", recommendedUse: "Coding, analysis, automation" },
    "gemini-2-flash": { speed: "Very Fast", quality: "Good", priceLevel: "Low", recommendedUse: "High-volume, fast responses" },
    "gemini-2-pro": { speed: "Medium", quality: "Excellent", priceLevel: "Medium", recommendedUse: "Long context, reasoning" },
    "claude-4-sonnet": { speed: "Medium", quality: "Excellent", priceLevel: "High", recommendedUse: "Writing, enterprise tasks" },
    "deepseek-chat": { speed: "Fast", quality: "Good", priceLevel: "Low", recommendedUse: "Coding, cost-efficient chat" },
    "qwen-turbo": { speed: "Very Fast", quality: "Good", priceLevel: "Low", recommendedUse: "Translation, multilingual" },
  };

  const PROVIDER_STATUS = {
    openai: { label: "OpenAI", status: "live", statusLabel: "Live" },
    google: { label: "Google Gemini", status: "live", statusLabel: "Live" },
    anthropic: { label: "Claude", status: "waiting_api_key", statusLabel: "Waiting API Key" },
    deepseek: { label: "DeepSeek", status: "waiting_balance", statusLabel: "Waiting Balance / API Key" },
    qwen: { label: "Qwen", status: "waiting_api_key", statusLabel: "Waiting API Key" },
    mistral: { label: "Mistral", status: "coming_soon", statusLabel: "Coming Soon" },
    openrouter: { label: "OpenRouter", status: "coming_soon", statusLabel: "Coming Soon" },
  };

  function formatContext(n) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${Math.round(n / 1000)}K`;
    return String(n);
  }

  function getShowcaseCards() {
    const ids = ["gpt-4o", "gemini-2-flash", "gemini-2-pro", "claude-4-sonnet", "deepseek-chat", "qwen-turbo"];
    return ids.map((id) => {
      const model = registry?.getById(id) || { id, displayName: id, provider: "openai", contextLength: 128000, status: "inactive" };
      const meta = CARD_META[id] || { speed: "—", quality: "—", priceLevel: "—", recommendedUse: "—" };
      const prov = PROVIDER_STATUS[model.provider] || { label: model.provider, status: "inactive", statusLabel: "Inactive" };
      return {
        id: model.id,
        displayName: model.displayName,
        provider: model.provider,
        providerName: prov.label,
        speed: meta.speed,
        quality: meta.quality,
        contextLength: formatContext(model.contextLength || 128000),
        priceLevel: meta.priceLevel,
        recommendedUse: meta.recommendedUse,
        status: model.status === "active" ? "active" : prov.status,
        statusLabel: model.status === "active" ? "Active" : prov.statusLabel,
      };
    });
  }

  function getLandingModels() {
    return [
      { name: "GPT-4o", provider: "OpenAI", status: "Live" },
      { name: "Gemini 2.5 Flash", provider: "Google Gemini", status: "Live" },
      { name: "Claude 4 Sonnet", provider: "Anthropic", status: "Waiting API Key" },
      { name: "DeepSeek Chat", provider: "DeepSeek", status: "Waiting Balance / API Key" },
      { name: "Qwen Turbo", provider: "Qwen", status: "Waiting API Key" },
      { name: "Mistral Large", provider: "Mistral", status: "Coming Soon" },
      { name: "OpenRouter", provider: "OpenRouter", status: "Coming Soon" },
    ];
  }

  return { getShowcaseCards, getLandingModels, PROVIDER_STATUS, formatContext };
});
