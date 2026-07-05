(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaSeedData = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
    user: {
      id: "user-demo-1",
      name: "Alex Weber",
      company: "Zwima Technologie GmbH",
      email: "alex.weber@company.eu",
      plan: "Early Access",
      contactName: "Alex Weber",
      country: "Germany",
      language: "English",
      timezone: "Europe/Berlin",
      vatNumber: "DE321456789",
      apiKeyCount: 4,
      creditsBalance: "12,450",
    },
    auth: {
      accounts: [
        {
          id: "user-admin-1",
          email: "admin@zwima-group.info",
          password: "password123",
          role: "Admin",
          name: "Admin User",
          company: "Zwima Technologie GmbH",
          contactName: "Admin User",
          country: "Germany",
          language: "English",
          timezone: "Europe/Berlin",
          billingEmail: "hello@zwima-group.info",
          vatNumber: "DE321456789",
          plan: "Early Access",
          apiKeyCount: 4,
          creditsBalance: "12,450",
          avatar: "AU",
        },
      ],
      sessions: [],
      resetTokens: [],
    },
    settings: {
      id: "settings-1",
      gatewayEndpoint: "https://api.zwima.ai/v1/chat/completions",
      defaultProvider: "openai",
      defaultLanguage: "en",
      defaultCurrency: "EUR",
      vatRate: 0.19,
      creditRateEur: 0.1,
      providerOptions: ["OpenAI", "Claude", "Gemini", "DeepSeek", "Qwen", "Mistral", "OpenRouter"],
      topUpOptions: ["100", "500", "1000", "5000", "10000", "custom"],
    },
    credits: {
      id: "credits-1",
      overview: {
        balance: 12450,
        balanceLabel: "12,450 Credits",
        consumption: "3,550 credits this month",
        monthlyUsage: "3.2M model tokens",
        providerCost: "€1,840 estimated",
        currency: "EUR (€)",
      },
      topUpConfirmMessage: "Payment integration coming soon.",
    },
    apikeys: {
      keys: [
        { id: "key-1", name: "Production Key", prefix: "zwima_live_8f29a1b2c3d4", provider: "OpenAI", environment: "Production", scopes: ["Read", "Write", "Admin"], expiration: "Never", created: "2026-06-14", lastUsed: "Today", status: "Active", quota: "100,000 / mo", usage: "38,420" },
        { id: "key-2", name: "Testing Key", prefix: "zwima_live_3c91e5f6a7b8", provider: "Claude", environment: "Testing", scopes: ["Read", "Write"], expiration: "90 Days", created: "2026-06-13", lastUsed: "Yesterday", status: "Active", quota: "50,000 / mo", usage: "12,104" },
        { id: "key-3", name: "Legacy Key", prefix: "zwima_live_7b42c9d0e1f2", provider: "Gemini", environment: "Production", scopes: ["Read"], expiration: "30 Days", created: "2026-06-01", lastUsed: "7 days ago", status: "Disabled", quota: "25,000 / mo", usage: "4,892" },
        { id: "key-4", name: "Development Key", prefix: "zwima_live_a4d8e2f1b9c0", provider: "DeepSeek", environment: "Development", scopes: ["Read", "Write"], expiration: "180 Days", created: "2026-06-10", lastUsed: "2 days ago", status: "Active", quota: "10,000 / mo", usage: "1,240" },
      ],
      activity: [
        { id: "act-1", type: "Created Key", detail: "Development Key created for DeepSeek (Development)", time: "2026-06-10 11:20" },
        { id: "act-2", type: "Rotated Key", detail: "Testing Key rotated — previous key invalidated", time: "2026-06-13 09:05" },
        { id: "act-3", type: "Created Key", detail: "Testing Key created for Claude (Testing)", time: "2026-06-13 08:42" },
        { id: "act-4", type: "Disabled Key", detail: "Legacy Key disabled by account admin", time: "2026-06-05 14:18" },
        { id: "act-5", type: "Created Key", detail: "Production Key created for OpenAI (Production)", time: "2026-06-14 10:30" },
      ],
    },
    billing: {
      id: "billing-1",
      usageStatistics: { todayRequests: "1,248", monthlyRequests: "38,420", inputTokens: "1.2M", outputTokens: "890K", estimatedCost: "€1,840" },
      transactions: [
        { id: "tx-1", date: "2026-06-13", amount: "€595.00", credits: "500", provider: "Stripe", status: "Completed", invoice: "INV-2026-0613" },
        { id: "tx-2", date: "2026-06-01", amount: "€1,190.00", credits: "1,000", provider: "Bank Transfer", status: "Completed", invoice: "INV-2026-0601" },
        { id: "tx-3", date: "2026-05-22", amount: "€119.00", credits: "100", provider: "PayPal", status: "Completed", invoice: "INV-2026-0522" },
      ],
      costBreakdown: [
        { id: "cb-1", label: "Input Tokens", percent: 62 },
        { id: "cb-2", label: "Output Tokens", percent: 28 },
        { id: "cb-3", label: "Embedding", percent: 6 },
        { id: "cb-4", label: "Image", percent: 3 },
        { id: "cb-5", label: "Audio", percent: 1 },
      ],
      providerUsage: [
        { id: "pu-1", name: "OpenAI", percent: 42 },
        { id: "pu-2", name: "Claude", percent: 22 },
        { id: "pu-3", name: "Gemini", percent: 15 },
        { id: "pu-4", name: "DeepSeek", percent: 8 },
        { id: "pu-5", name: "Qwen", percent: 5 },
        { id: "pu-6", name: "Mistral", percent: 4 },
        { id: "pu-7", name: "OpenRouter", percent: 4 },
      ],
      monthlySpending: [
        { id: "ms-1", month: "Jul", amount: 1240 }, { id: "ms-2", month: "Aug", amount: 1380 },
        { id: "ms-3", month: "Sep", amount: 1520 }, { id: "ms-4", month: "Oct", amount: 1410 },
        { id: "ms-5", month: "Nov", amount: 1650 }, { id: "ms-6", month: "Dec", amount: 1780 },
        { id: "ms-7", month: "Jan", amount: 1590 }, { id: "ms-8", month: "Feb", amount: 1720 },
        { id: "ms-9", month: "Mar", amount: 1840 }, { id: "ms-10", month: "Apr", amount: 1760 },
        { id: "ms-11", month: "May", amount: 1920 }, { id: "ms-12", month: "Jun", amount: 1840 },
      ],
      paymentMethods: [
        { id: "pm-1", name: "Visa", meta: "•••• 4242", default: true },
        { id: "pm-2", name: "Mastercard", meta: "•••• 8210", default: false },
        { id: "pm-3", name: "PayPal", meta: "hello@zwima-group.info", default: false },
      ],
    },
    routing: {
      id: "routing-1",
      rules: [
        { id: "rule-1", condition: "If Prompt > 5000 tokens", target: "Claude" },
        { id: "rule-2", condition: "If Image", target: "OpenAI" },
        { id: "rule-3", condition: "If Coding", target: "DeepSeek" },
        { id: "rule-4", condition: "If Translation", target: "Qwen" },
        { id: "rule-5", condition: "If Creative Writing", target: "Claude" },
        { id: "rule-6", condition: "If Cheap Mode", target: "OpenRouter" },
      ],
      providerPriority: ["OpenAI", "Claude", "Gemini", "DeepSeek", "Qwen", "Mistral", "OpenRouter"],
      routingLog: [
        { id: "rl-1", time: "14:32:08", request: "Summarize quarterly report...", provider: "Claude", latency: "312 ms", status: "Routed" },
        { id: "rl-2", time: "14:31:54", request: "Generate Python API client...", provider: "DeepSeek", latency: "198 ms", status: "Routed" },
        { id: "rl-3", time: "14:31:41", request: "Translate contract to German...", provider: "Qwen", latency: "276 ms", status: "Routed" },
      ],
      statusBase: {
        OpenAI: { latency: [280, 360], availability: [99.6, 99.9], cost: ["€0.12", "€0.14"] },
        Claude: { latency: [300, 380], availability: [99.4, 99.8], cost: ["€0.14", "€0.16"] },
        Gemini: { latency: [240, 320], availability: [99.5, 99.8], cost: ["€0.09", "€0.11"] },
        DeepSeek: { latency: [190, 260], availability: [99.2, 99.6], cost: ["€0.05", "€0.07"] },
        Qwen: { latency: [260, 340], availability: [98.8, 99.4], cost: ["€0.06", "€0.08"] },
        Mistral: { latency: [250, 330], availability: [99.0, 99.5], cost: ["€0.08", "€0.10"] },
        OpenRouter: { latency: [350, 450], availability: [98.5, 99.2], cost: ["€0.04", "€0.06"] },
      },
    },
    logs: {
      id: "logs-1",
      requestLogs: [
        { id: "log-1", time: "14:38:12", endpoint: "/v1/chat/completions", provider: "OpenAI", latency: "241 ms", status: "200", tokens: "842" },
        { id: "log-2", time: "14:37:58", endpoint: "/v1/chat/completions", provider: "Claude", latency: "312 ms", status: "200", tokens: "1,204" },
        { id: "log-3", time: "14:37:44", endpoint: "/v1/chat/completions", provider: "Gemini", latency: "198 ms", status: "200", tokens: "560" },
      ],
      gatewayProviders: [
        { id: "gp-1", name: "OpenAI", status: "Connected", statusClass: "active" },
        { id: "gp-2", name: "Claude", status: "Connected", statusClass: "active" },
        { id: "gp-3", name: "Gemini", status: "Connected", statusClass: "active" },
        { id: "gp-4", name: "DeepSeek", status: "Connected", statusClass: "active" },
        { id: "gp-5", name: "Qwen", status: "Mock", statusClass: "mock" },
        { id: "gp-6", name: "Mistral", status: "Mock", statusClass: "mock" },
        { id: "gp-7", name: "OpenRouter", status: "Connected", statusClass: "active" },
      ],
      health: [
        { id: "h-1", name: "Gateway Status", status: "Operational", statusClass: "active" },
        { id: "h-2", name: "Provider Status", status: "Operational", statusClass: "active" },
        { id: "h-3", name: "Billing", status: "Operational", statusClass: "active" },
      ],
      rateLimits: [
        { id: "rlim-1", plan: "Free", rpm: "10", tpd: "50K", concurrent: "2" },
        { id: "rlim-2", plan: "Starter", rpm: "60", tpd: "500K", concurrent: "5" },
        { id: "rlim-3", plan: "Business", rpm: "300", tpd: "5M", concurrent: "20" },
        { id: "rlim-4", plan: "Enterprise", rpm: "Custom", tpd: "Custom", concurrent: "Custom" },
      ],
      gatewayStatistics: { tokenUsage: "3.2M" },
      sdkMessage: "SDK package coming soon.",
    },
  };
});
