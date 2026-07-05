(function () {
  window.ZwimaConstants = {
    STORAGE_KEYS: {
      SESSION: "zwima_session",
      ACCESS_TOKEN: "zwima_access_token",
      REFRESH_TOKEN: "zwima_refresh_token",
      TOKEN_EXPIRES_AT: "zwima_token_expires_at",
      REMEMBER_LOGIN: "zwima_remember_login",
      AUTH_SESSIONS: "zwima_auth_sessions",
      CURRENT_SESSION_ID: "zwima_current_session_id",
      API_KEYS: "zwima_api_keys_v2",
      API_KEY_ACTIVITY: "zwima_api_keys_activity",
      PLAYGROUND_HISTORY: "zwima_playground_history",
      PLAYGROUND_MODE: "zwima_playground_mode",
    },
    STATUS: {
      ACTIVE: "Active",
      DISABLED: "Disabled",
      CONNECTED: "Connected",
      MOCK: "Mock",
    },
    NAV_PAGES: {
      dashboard: { href: "dashboard.html", label: "Overview", section: "#overview" },
      models: { href: "models.html", label: "Models" },
      apikeys: { href: "apikeys.html", label: "API Keys" },
      playground: { href: "playground.html", label: "Playground" },
      routing: { href: "routing.html", label: "Intelligent Routing" },
      gateway: { href: "gateway.html", label: "API Gateway" },
      credits: { href: "credits.html", label: "Credits" },
      usage: { href: "dashboard.html#usage", label: "Usage" },
      billing: { href: "dashboard.html#billing", label: "Billing" },
      settings: { href: "dashboard.html#settings", label: "Settings" },
      documentation: { href: "documentation.html", label: "Documentation" },
    },
  };
})();
