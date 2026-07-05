(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaBaseProviderAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GatewayConfig =
    typeof ZwimaGatewayConfig !== "undefined" ? ZwimaGatewayConfig : require("../gatewayConfig");

  function estimateTokens(text) {
    return Math.max(1, Math.ceil(String(text || "").length / 4));
  }

  function parseMessages(messages, prompt) {
    if (Array.isArray(messages) && messages.length) return messages;
    return [{ role: "user", content: String(prompt || "") }];
  }

  function buildMockContent(spec, prompt, model) {
    const snippet = String(prompt || "").slice(0, 80);
    return (
      spec.mockTemplate ||
      `[${spec.name}] Response from ${model}:\n\nI've processed your request — "${snippet}" — and generated a structured answer with provider-native formatting.`
    );
  }

  async function mockDelay(spec) {
    const range = spec.mockLatency || [300, 600];
    const ms = Math.floor(range[0] + Math.random() * (range[1] - range[0] + 1));
    await new Promise((r) => setTimeout(r, ms));
    return ms;
  }

  function calcCost(inputTokens, outputTokens, spec, modelName) {
    const model = spec.models?.find((m) => m.id === modelName || m.name === modelName) || spec.models?.[0];
    const inputRate = (model?.inputPer1M ?? spec.inputPer1M ?? 1) / 1_000_000;
    const outputRate = (model?.outputPer1M ?? spec.outputPer1M ?? 2) / 1_000_000;
    return Number((inputTokens * inputRate + outputTokens * outputRate).toFixed(6));
  }

  async function realFetch(spec, path, body, timeoutMs) {
    const apiKey = GatewayConfig.getApiKey(spec.id);
    if (!apiKey) {
      const err = new Error(`Missing API key for ${spec.name}`);
      err.code = 401;
      throw err;
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const start = Date.now();
    try {
      const res = await fetch(`${spec.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(spec.headers || {}),
        },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json?.error?.message || `${spec.name} API error ${res.status}`);
        err.code = res.status;
        throw err;
      }
      return { json, latency: Date.now() - start };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function createProviderAdapter(spec) {
    return {
      id: spec.id,
      name: spec.name,
      baseUrl: spec.baseUrl,

      async listModels() {
        return {
          provider: spec.name,
          models: (spec.models || []).map((m) => ({
            id: m.id,
            name: m.name,
            context: m.context,
            capabilities: m.capabilities || ["chat"],
          })),
        };
      },

      async chat({ prompt, messages, model, temperature, maxTokens, system }) {
        const msgs = parseMessages(messages, prompt);
        const modelId = model || spec.models?.[0]?.id || spec.models?.[0]?.name;
        const inputText = msgs.map((m) => m.content).join(" ") + (system || "");
        const inputTokens = estimateTokens(inputText);

        if (GatewayConfig.isMockMode()) {
          const latency = await mockDelay(spec);
          const content = buildMockContent(spec, msgs[msgs.length - 1]?.content || prompt, modelId);
          const outputTokens = estimateTokens(content);
          return {
            provider: spec.name,
            model: modelId,
            content,
            latency,
            usage: {
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              estimatedCost: calcCost(inputTokens, outputTokens, spec, modelId),
            },
          };
        }

        const timeout = GatewayConfig.getTimeout(GatewayConfig.getMode());
        const body = {
          model: modelId,
          messages: system ? [{ role: "system", content: system }, ...msgs] : msgs,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 2048,
        };
        const { json, latency } = await realFetch(spec, spec.chatPath || "/chat/completions", body, timeout);
        const content = json.choices?.[0]?.message?.content || json.content?.[0]?.text || "";
        const outputTokens = json.usage?.completion_tokens || estimateTokens(content);
        const inTok = json.usage?.prompt_tokens || inputTokens;
        return {
          provider: spec.name,
          model: modelId,
          content,
          latency,
          usage: {
            inputTokens: inTok,
            outputTokens,
            totalTokens: inTok + outputTokens,
            estimatedCost: calcCost(inTok, outputTokens, spec, modelId),
          },
        };
      },

      async embeddings({ input, model }) {
        const modelId = model || spec.embeddingModel || "text-embedding-3-small";
        const inputTokens = estimateTokens(Array.isArray(input) ? input.join(" ") : input);
        if (GatewayConfig.isMockMode()) {
          const latency = await mockDelay(spec);
          const dims = 8;
          const vector = Array.from({ length: dims }, (_, i) => Number((Math.sin(i + inputTokens) * 0.1).toFixed(4)));
          return {
            provider: spec.name,
            model: modelId,
            embeddings: [{ index: 0, embedding: vector }],
            latency,
            usage: { inputTokens, outputTokens: 0, totalTokens: inputTokens, estimatedCost: calcCost(inputTokens, 0, spec, modelId) },
          };
        }
        const timeout = GatewayConfig.getTimeout(GatewayConfig.getMode());
        const { json, latency } = await realFetch(
          spec,
          spec.embeddingsPath || "/embeddings",
          { model: modelId, input },
          timeout
        );
        return {
          provider: spec.name,
          model: modelId,
          embeddings: json.data || [],
          latency,
          usage: {
            inputTokens: json.usage?.prompt_tokens || inputTokens,
            outputTokens: 0,
            totalTokens: json.usage?.total_tokens || inputTokens,
            estimatedCost: calcCost(inputTokens, 0, spec, modelId),
          },
        };
      },

      async image({ prompt, model, size }) {
        const modelId = model || spec.imageModel || "dall-e-3";
        if (GatewayConfig.isMockMode()) {
          const latency = await mockDelay(spec);
          return {
            provider: spec.name,
            model: modelId,
            images: [{ url: `https://placehold.co/${size || "512x512"}/png?text=ZWIMA+Mock` }],
            latency,
            usage: { inputTokens: estimateTokens(prompt), outputTokens: 0, totalTokens: estimateTokens(prompt), estimatedCost: 0.04 },
          };
        }
        const timeout = GatewayConfig.getTimeout(GatewayConfig.getMode());
        const { json, latency } = await realFetch(
          spec,
          spec.imagePath || "/images/generations",
          { model: modelId, prompt, size: size || "1024x1024" },
          timeout
        );
        return {
          provider: spec.name,
          model: modelId,
          images: json.data || [],
          latency,
          usage: { inputTokens: estimateTokens(prompt), outputTokens: 0, totalTokens: estimateTokens(prompt), estimatedCost: 0.04 },
        };
      },

      async audio({ input, model, voice }) {
        const modelId = model || spec.audioModel || "tts-1";
        if (GatewayConfig.isMockMode()) {
          const latency = await mockDelay(spec);
          return {
            provider: spec.name,
            model: modelId,
            audio: { format: "mp3", mock: true, voice: voice || "alloy" },
            latency,
            usage: { inputTokens: estimateTokens(input), outputTokens: 0, totalTokens: estimateTokens(input), estimatedCost: 0.015 },
          };
        }
        const timeout = GatewayConfig.getTimeout(GatewayConfig.getMode());
        const { json, latency } = await realFetch(
          spec,
          spec.audioPath || "/audio/speech",
          { model: modelId, input, voice: voice || "alloy" },
          timeout
        );
        return { provider: spec.name, model: modelId, audio: json, latency, usage: { inputTokens: estimateTokens(input), outputTokens: 0, totalTokens: estimateTokens(input), estimatedCost: 0.015 } };
      },

      async health() {
        if (GatewayConfig.isMockMode()) {
          const latency = Math.floor((spec.mockLatency?.[0] || 200) + Math.random() * 80);
          const availability = 98 + Math.random() * 1.9;
          return {
            provider: spec.name,
            status: availability > 99 ? "healthy" : "degraded",
            latency,
            availability: Number(availability.toFixed(1)),
          };
        }
        const start = Date.now();
        try {
          const apiKey = GatewayConfig.getApiKey(spec.id);
          if (!apiKey) {
            return { provider: spec.name, status: "unconfigured", latency: 0, availability: 0 };
          }
          const res = await fetch(`${spec.baseUrl}${spec.healthPath || "/models"}`, {
            headers: { Authorization: `Bearer ${apiKey}`, ...(spec.headers || {}) },
          });
          const latency = Date.now() - start;
          return {
            provider: spec.name,
            status: res.ok ? "healthy" : "unhealthy",
            latency,
            availability: res.ok ? 99.9 : 0,
          };
        } catch {
          return { provider: spec.name, status: "unhealthy", latency: Date.now() - start, availability: 0 };
        }
      },
    };
  }

  return { createProviderAdapter, estimateTokens, calcCost };
});
