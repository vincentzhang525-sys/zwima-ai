(function () {
  const PROVIDERS = {
    openai: {
      id: "openai",
      name: "OpenAI",
      models: ["GPT-4o", "GPT-4.1", "o1-mini"],
    },
    anthropic: {
      id: "anthropic",
      name: "Anthropic",
      models: ["Claude 4 Sonnet", "Claude 4 Opus", "Claude 3.5 Haiku"],
    },
    google: {
      id: "google",
      name: "Google",
      models: ["Gemini 2.0 Flash", "Gemini 2.0 Pro"],
    },
    deepseek: {
      id: "deepseek",
      name: "DeepSeek",
      models: ["DeepSeek V3", "DeepSeek R1"],
    },
    mistral: {
      id: "mistral",
      name: "Mistral",
      models: ["Mistral Large", "Mistral Small"],
    },
  };

  const RESPONSE_TEMPLATES = {
    openai: (prompt, model) =>
      `[Mock · ${model}] Here is a detailed response to: "${truncate(prompt, 80)}"\n\nI've analyzed your request and structured a step-by-step answer with actionable recommendations.`,
    anthropic: (prompt, model) =>
      `[Mock · ${model}] Let's think through this carefully.\n\nRegarding "${truncate(prompt, 80)}", here is a balanced, methodical answer tailored to your use case.`,
    google: (prompt, model) =>
      `[Mock · ${model}] I can help with that.\n\nFor "${truncate(prompt, 80)}", here is a concise summary with practical guidance you can apply immediately.`,
    deepseek: (prompt, model) =>
      `[Mock · ${model}] Analysis for "${truncate(prompt, 80)}":\n\nCost-efficient mock output focused on accuracy and clarity for production workloads.`,
    mistral: (prompt, model) =>
      `[Mock · ${model}] Enterprise response for "${truncate(prompt, 80)}" — optimized for European compliance and coding workloads.`,
  };

  function truncate(text, len) {
    const value = String(text || "");
    return value.length <= len ? value : `${value.slice(0, len)}…`;
  }

  function estimateTokens(text) {
    return Math.max(1, Math.ceil(String(text || "").length / 4));
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  window.ZwimaPlaygroundService = {
    getProviders() {
      return PROVIDERS;
    },

    getProviderList() {
      return Object.values(PROVIDERS);
    },

    getModels(providerId) {
      return PROVIDERS[providerId]?.models || PROVIDERS.openai.models;
    },

    getAllModelEntries() {
      return Object.values(PROVIDERS).flatMap((provider) =>
        provider.models.map((model) => ({
          providerId: provider.id,
          providerName: provider.name,
          model,
        }))
      );
    },

    async runMock({ providerId, model, prompt, temperature, maxTokens }) {
      const trimmed = String(prompt || "").trim();
      if (!trimmed) throw new Error("Prompt is required.");

      const provider = PROVIDERS[providerId] || PROVIDERS.openai;
      const modelName = model || provider.models[0];
      const template = RESPONSE_TEMPLATES[provider.id] || RESPONSE_TEMPLATES.openai;
      const latencyMs = 350 + Math.floor(Math.random() * 650);

      await delay(latencyMs);

      const content = template(trimmed, modelName);
      const inputTokens = estimateTokens(trimmed);
      const outputTokens = Math.min(estimateTokens(content), Number(maxTokens) || 2048);

      return {
        content,
        provider: provider.name,
        model: modelName,
        temperature: Number(temperature) || 0.7,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        latencyMs,
      };
    },
  };
})();
