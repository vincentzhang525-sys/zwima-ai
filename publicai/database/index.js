(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaDatabase = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DatabaseAdapter = typeof ZwimaDatabaseAdapter !== "undefined" ? ZwimaDatabaseAdapter : require("./DatabaseAdapter");
  const ProviderRepository = typeof ZwimaProviderRepository !== "undefined" ? ZwimaProviderRepository : require("./repositories/ProviderRepository");
  const ModelRepository = typeof ZwimaModelRepository !== "undefined" ? ZwimaModelRepository : require("./repositories/ModelRepository");
  const ApiKeyRepository = typeof ZwimaApiKeyRepository !== "undefined" ? ZwimaApiKeyRepository : require("./repositories/ApiKeyRepository");
  const CreditRepository = typeof ZwimaCreditRepository !== "undefined" ? ZwimaCreditRepository : require("./repositories/CreditRepository");
  const BillingRepository = typeof ZwimaBillingRepository !== "undefined" ? ZwimaBillingRepository : require("./repositories/BillingRepository");
  const UserRepository = typeof ZwimaUserRepository !== "undefined" ? ZwimaUserRepository : require("./repositories/UserRepository");
  const AuthRepository = typeof ZwimaAuthRepository !== "undefined" ? ZwimaAuthRepository : require("./repositories/AuthRepository");
  const RoutingRepository = typeof ZwimaRoutingRepository !== "undefined" ? ZwimaRoutingRepository : require("./repositories/RoutingRepository");
  const LogRepository = typeof ZwimaLogRepository !== "undefined" ? ZwimaLogRepository : require("./repositories/LogRepository");
  const SettingsRepository = typeof ZwimaSettingsRepository !== "undefined" ? ZwimaSettingsRepository : require("./repositories/SettingsRepository");
  const GatewayRepository = typeof ZwimaGatewayRepository !== "undefined" ? ZwimaGatewayRepository : require("./repositories/GatewayRepository");
  const PaymentRepository = typeof ZwimaPaymentRepository !== "undefined" ? ZwimaPaymentRepository : require("./repositories/PaymentRepository");
  const InvoiceRepository = typeof ZwimaInvoiceRepository !== "undefined" ? ZwimaInvoiceRepository : require("./repositories/InvoiceRepository");
  const TransactionRepository = typeof ZwimaTransactionRepository !== "undefined" ? ZwimaTransactionRepository : require("./repositories/TransactionRepository");
  const AdminUserRepository = typeof ZwimaAdminUserRepository !== "undefined" ? ZwimaAdminUserRepository : require("./repositories/AdminUserRepository");
  const AuditLogRepository = typeof ZwimaAuditLogRepository !== "undefined" ? ZwimaAuditLogRepository : require("./repositories/AuditLogRepository");
  const PricingRepository = typeof ZwimaPricingRepository !== "undefined" ? ZwimaPricingRepository : require("./repositories/PricingRepository");
  const AdminStatsRepository = typeof ZwimaAdminStatsRepository !== "undefined" ? ZwimaAdminStatsRepository : require("./repositories/AdminStatsRepository");
  const AdminRepository = typeof ZwimaAdminRepository !== "undefined" ? ZwimaAdminRepository : require("./repositories/AdminRepository");
  const StripeServiceMod = typeof ZwimaStripeService !== "undefined" ? ZwimaStripeService : require("../stripe/stripeService");
  const WebhookServiceMod = typeof ZwimaWebhookService !== "undefined" ? ZwimaWebhookService : require("../stripe/webhookService");
  const DatabaseHealth = typeof ZwimaDatabaseHealth !== "undefined" ? ZwimaDatabaseHealth : require("./health");

  const PUBLIC_PATHS = new Set([
    "/api/auth/signin",
    "/api/auth/signup",
    "/api/auth/register",
    "/api/auth/forgot",
    "/api/auth/reset",
    "/api/auth/refresh",
    "/api/billing/webhook",
  ]);

  let adapter = null;
  let repositories = null;
  let initPromise = null;
  let stripeService = null;
  let webhookService = null;

  function getStripe(repos) {
    if (!stripeService) {
      stripeService = StripeServiceMod.createStripeService(repos);
      webhookService = WebhookServiceMod.createWebhookService(repos);
    }
    return { stripeService, webhookService };
  }

  function buildRepositories(adpt) {
    const repos = {
      providers: ProviderRepository.create(adpt),
      models: ModelRepository.create(adpt),
      apiKeys: ApiKeyRepository.create(adpt),
      credits: CreditRepository.create(adpt),
      billing: BillingRepository.create(adpt),
      users: UserRepository.create(adpt),
      auth: AuthRepository.create(adpt),
      routing: RoutingRepository.create(adpt),
      logs: LogRepository.create(adpt),
      settings: SettingsRepository.create(adpt),
      gateway: GatewayRepository.create(adpt),
      payments: PaymentRepository.create(adpt),
      invoices: InvoiceRepository.create(adpt),
      transactions: TransactionRepository.create(adpt),
      adminUsers: AdminUserRepository.create(adpt),
      auditLog: AuditLogRepository.create(adpt),
      pricing: PricingRepository.create(adpt),
      adminStats: AdminStatsRepository.create(adpt),
    };
    repos.admin = AdminRepository.create(repos);
    return repos;
  }

  function requireAuth(repos, authorization) {
    return repos.auth.verifyRequest(authorization || "");
  }

  function requireAdmin(repos, authorization) {
    const user = requireAuth(repos, authorization);
    repos.admin.requireAdmin(user);
    return user;
  }

  async function init(options) {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      adapter = DatabaseAdapter.createAdapter(options?.driver, options);
      await adapter.init();
      repositories = buildRepositories(adapter);
      return { adapter, repositories };
    })();
    return initPromise;
  }

  if (typeof window !== "undefined") {
    init().catch(() => {});
  }

  return {
    init,
    async repos() {
      await init();
      return repositories;
    },
    getAdapter() {
      return adapter;
    },
    getRepositories() {
      return repositories;
    },
    async getHealth() {
      if (!adapter) await init();
      return DatabaseHealth.getHealth(adapter);
    },
    async queryApi(path, method, body, options) {
      if (!repositories) await init();
      const repos = repositories;
      const auth = options?.authorization || "";

      if (method === "GET") {
        if (path === "/api/auth/me") {
          return { data: repos.auth.getMe(auth.replace(/^Bearer\s+/i, "")) };
        }
        if (path === "/api/auth/sessions") {
          return { data: repos.auth.getSessions(auth.replace(/^Bearer\s+/i, "")) };
        }
        if (path === "/api/auth/role") {
          const role = new URLSearchParams(options?.query || "").get("role") || body?.role;
          return { data: repos.auth.checkRole(auth.replace(/^Bearer\s+/i, ""), role) };
        }
        if (path === "/api/auth/permissions") {
          const permission = new URLSearchParams(options?.query || "").get("permission") || body?.permission;
          return { data: repos.auth.checkPermission(auth.replace(/^Bearer\s+/i, ""), permission) };
        }

        if (!PUBLIC_PATHS.has(path)) requireAuth(repos, auth);

        if (path === "/api/providers") {
          const data = await repos.providers.findAll();
          return { data, total: data.list.length };
        }
        if (path === "/api/models") {
          const data = await repos.models.findAll();
          return { data, total: data.catalog.length };
        }
        if (path === "/api/apikeys") {
          const data = await repos.apiKeys.findAll();
          return { data, total: data.keys.length };
        }
        if (path === "/api/user") {
          const data = repos.auth.getMe(auth.replace(/^Bearer\s+/i, ""));
          await repos.users.saveSession(data);
          return { data };
        }
        if (path === "/api/billing") {
          const data = await repos.billing.findAll();
          return { data };
        }
        if (path === "/api/billing/dashboard") {
          const [dashboard, payments, invoices, transactions] = await Promise.all([
            repos.credits.getBillingDashboard(),
            repos.payments.getHistory(),
            repos.invoices.getList(),
            repos.transactions.getHistory(),
          ]);
          return { data: { ...dashboard, payments, invoices, transactions } };
        }
        if (path === "/api/billing/payments") {
          const data = await repos.payments.getHistory();
          return { data, total: data.length };
        }
        if (path === "/api/billing/invoices") {
          const data = await repos.invoices.getList();
          return { data, total: data.length };
        }
        if (path === "/api/billing/transactions") {
          const data = await repos.transactions.getHistory();
          return { data, total: data.length };
        }
        if (path === "/api/credits") {
          const data = await repos.credits.findAll();
          return { data };
        }
        if (path === "/api/routing") {
          const [data, liveStatus, optimizer] = await Promise.all([
            repos.routing.findAll(),
            repos.routing.getLiveStatus(),
            repos.routing.getOptimizerMetrics(),
          ]);
          return { data: { ...data, liveStatus, optimizer } };
        }
        if (path === "/api/logs") {
          const [data, gatewayStatistics] = await Promise.all([
            repos.logs.findAll(),
            repos.logs.getGatewayStatistics(),
          ]);
          return { data: { ...data, gatewayStatistics } };
        }
        if (path === "/api/settings") {
          const data = await repos.settings.findAll();
          return { data };
        }
        if (path === "/api/database/health") {
          const data = await DatabaseHealth.getHealth(adapter);
          return { data };
        }
        if (path === "/api/gateway/models") {
          const providerId = new URLSearchParams(options?.query || "").get("provider");
          const data = await repos.gateway.listModels(providerId || undefined);
          return { data };
        }
        if (path === "/api/gateway/health") {
          const data = await repos.gateway.health();
          return { data };
        }
        if (path === "/api/gateway/providers") {
          const data = repos.gateway.providerManager.getEnabledProviders();
          return { data };
        }
        if (path.startsWith("/api/admin/")) {
          const adminUser = requireAdmin(repos, auth);
          if (path === "/api/admin/users") {
            const q = new URLSearchParams(options?.query || "").get("q");
            const data = await repos.admin.getUsers(adminUser, q);
            return { data, total: data.length };
          }
          if (path === "/api/admin/providers") {
            const data = await repos.admin.getProviders(adminUser);
            return { data };
          }
          if (path === "/api/admin/pricing") {
            const data = await repos.admin.getPricing(adminUser);
            return { data };
          }
          if (path === "/api/admin/billing") {
            const data = await repos.admin.getBilling(adminUser);
            return { data };
          }
          if (path === "/api/admin/apikeys") {
            const data = await repos.admin.getApiKeys(adminUser);
            return { data };
          }
          if (path === "/api/admin/statistics") {
            const data = await repos.admin.getStatistics(adminUser);
            return { data };
          }
          if (path === "/api/admin/audit") {
            const data = await repos.admin.getAuditLog(adminUser);
            return { data };
          }
        }
      }

      if (method === "POST") {
        if (path === "/api/auth/signin") {
          const result = repos.auth.signIn(body || {});
          await repos.users.saveSession(result.user);
          return { data: result };
        }
        if (path === "/api/auth/signup" || path === "/api/auth/register") {
          const result = repos.auth.signUp(body || {});
          await repos.users.saveSession(result.user);
          return { data: result };
        }
        if (path === "/api/auth/signout") {
          repos.auth.signOut(body?.refreshToken);
          await repos.users.clearSession();
          return { data: { signedOut: true } };
        }
        if (path === "/api/auth/forgot") {
          return { data: repos.auth.forgotPassword(body || {}) };
        }
        if (path === "/api/auth/reset") {
          return { data: repos.auth.resetPassword(body || {}) };
        }
        if (path === "/api/auth/refresh") {
          const result = repos.auth.refreshToken(body?.refreshToken);
          await repos.users.saveSession(result.user);
          return { data: result };
        }
        if (path === "/api/auth/sessions/revoke") {
          return { data: repos.auth.revokeSession(auth.replace(/^Bearer\s+/i, ""), body?.sessionId) };
        }
        if (path === "/api/auth/sessions/revoke-others") {
          return { data: repos.auth.revokeOtherSessions(auth.replace(/^Bearer\s+/i, ""), body?.currentSessionId) };
        }
        if (path === "/api/auth/profile") {
          const user = repos.auth.updateProfile(auth.replace(/^Bearer\s+/i, ""), body || {});
          await repos.users.saveSession(user);
          return { data: user };
        }

        if (!PUBLIC_PATHS.has(path)) requireAuth(repos, auth);

        if (path === "/api/apikey/create") {
          const fullKey = typeof window !== "undefined" && window.ZwimaFormat
            ? window.ZwimaFormat.generateApiKeyPrefix()
            : `zwima_live_${Date.now().toString(36)}`;
          const env = body?.environment || "Production";
          const quotaMap = { Production: "100,000 / mo", Testing: "50,000 / mo", Development: "10,000 / mo" };
          const record = {
            id: `key-${Date.now()}`,
            name: body?.name || body?.keyName || "New Key",
            prefix: fullKey.slice(0, 18),
            provider: body?.provider || body?.keyProvider || "OpenAI",
            environment: env,
            scopes: body?.scopes?.length ? body.scopes : ["Read"],
            expiration: body?.expiration || "Never",
            created: new Date().toISOString().slice(0, 10),
            lastUsed: "Today",
            status: "Active",
            quota: quotaMap[env] || "50,000 / mo",
            usage: "0",
          };
          await repos.apiKeys.createKey(record);
          await repos.apiKeys.addActivity({
            id: `act-${Date.now()}`,
            type: "Created Key",
            detail: `${record.name} created for ${record.provider} (${record.environment})`,
            time: new Date().toISOString().replace("T", " ").slice(0, 16),
          });
          return { data: { key: record, fullKey } };
        }
        if (path === "/api/credits/topup") {
          const amountEur = body?.amountEur ?? (body?.credits ? body.credits * (global.ZWIMA_CONFIG?.CREDIT_RATE_EUR || 0.1) : 10);
          const { stripeService: stripe } = getStripe(repos);
          const session = await stripe.createCheckoutSession({
            amountEur,
            userId: body?.userId,
            email: body?.email,
            successUrl: body?.successUrl,
            cancelUrl: body?.cancelUrl,
          });
          if (session.mode === "mock") {
            const completed = await stripe.completePayment({ sessionId: session.sessionId, status: "succeeded" });
            return {
              data: {
                status: "completed",
                mode: "mock",
                message: "Credits added successfully via Stripe (Mock Mode).",
                session,
                ...completed,
              },
            };
          }
          return { data: { status: "redirect", mode: "test", ...session } };
        }
        if (path === "/api/billing/checkout") {
          const { stripeService: stripe } = getStripe(repos);
          const data = await stripe.createCheckoutSession({
            amountEur: body?.amountEur || 10,
            userId: body?.userId,
            email: body?.email,
            successUrl: body?.successUrl,
            cancelUrl: body?.cancelUrl,
          });
          return { data };
        }
        if (path === "/api/billing/complete") {
          const { stripeService: stripe } = getStripe(repos);
          const data = await stripe.completePayment({
            sessionId: body?.sessionId,
            paymentIntentId: body?.paymentIntentId,
            status: body?.status || "succeeded",
          });
          return { data };
        }
        if (path === "/api/billing/webhook") {
          const { webhookService: webhook } = getStripe(repos);
          const data = await webhook.handleEvent(body || {});
          return { data };
        }
        if (path === "/api/billing/refund") {
          const { stripeService: stripe } = getStripe(repos);
          const data = await stripe.processRefund({ paymentId: body?.paymentId, paymentIntentId: body?.paymentIntentId });
          return { data };
        }
        if (path === "/api/billing/settings") {
          const data = await repos.credits.updateBillingSettings(body || {});
          return { data };
        }
        if (path === "/api/playground/run") {
          const provider = body?.providerId || body?.provider;
          const result = await repos.gateway.chat({
            providerId: provider === "glm" ? "qwen" : provider,
            mode: body?.mode,
            prompt: body?.prompt,
            messages: body?.messages,
            model: body?.model,
            temperature: body?.temperature,
            maxTokens: body?.maxTokens,
            system: body?.system,
            strategy: body?.strategy,
          });
          return {
            data: {
              content: result.content,
              provider: result.provider,
              model: result.model,
              latency: result.latency,
              mode: result.mode,
              fallback: result.fallback,
              usage: {
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
                totalTokens: result.usage.totalTokens,
                estimatedCost: result.usage.estimatedCost,
                responseTimeMs: result.latency,
              },
            },
          };
        }
        if (path === "/api/gateway/chat") {
          const provider = body?.providerId || body?.provider;
          const data = await repos.gateway.chat({
            ...body,
            providerId: provider === "glm" ? "qwen" : provider,
          });
          return { data };
        }
        if (path === "/api/gateway/embeddings") {
          const data = await repos.gateway.embeddings(body || {});
          return { data };
        }
        if (path === "/api/gateway/image") {
          const data = await repos.gateway.image(body || {});
          return { data };
        }
        if (path === "/api/gateway/audio") {
          const data = await repos.gateway.audio(body || {});
          return { data };
        }
        if (path === "/api/gateway/route") {
          const data = repos.gateway.route(body || {});
          return { data };
        }
        if (path === "/api/routing/simulate") {
          const result = repos.gateway.routingEngine.simulateRouting(
            body?.prompt,
            body?.strategy,
            body?.priorityOrder,
            repos.gateway.providerManager
          );
          await repos.routing.appendLog({
            id: `rl-${Date.now()}`,
            time: new Date().toTimeString().slice(0, 8),
            request: String(body?.prompt || "").slice(0, 36),
            provider: result.provider,
            latency: result.estimatedLatency,
            status: "Routed",
          });
          return { data: result };
        }
        if (path.startsWith("/api/admin/")) {
          const adminUser = requireAdmin(repos, auth);
          if (path === "/api/admin/users/toggle") {
            const data = await repos.admin.toggleUser(adminUser, body?.userId, !!body?.enabled);
            return { data };
          }
          if (path === "/api/admin/users/credits") {
            const data = await repos.admin.adjustUserCredits(adminUser, body?.userId, body?.delta);
            return { data };
          }
          if (path === "/api/admin/providers/update") {
            const data = await repos.admin.updateProvider(adminUser, body?.providerId, body);
            return { data };
          }
          if (path === "/api/admin/pricing/update") {
            const data = await repos.admin.updatePricing(adminUser, body?.id, body);
            return { data };
          }
          if (path === "/api/admin/apikeys/create") {
            const data = await repos.admin.createApiKey(adminUser, body || {});
            return { data };
          }
          if (path === "/api/admin/apikeys/toggle") {
            const data = await repos.admin.toggleApiKey(adminUser, body?.keyId, !!body?.enabled);
            return { data };
          }
          if (path === "/api/admin/apikeys/delete") {
            const data = await repos.admin.deleteApiKey(adminUser, body?.keyId);
            return { data };
          }
          if (path === "/api/admin/apikeys/quota") {
            const data = await repos.admin.setApiKeyQuota(adminUser, body?.keyId, body?.quota);
            return { data };
          }
        }
      }

      throw new Error(`Unknown API route: ${path}`);
    },
  };
});
