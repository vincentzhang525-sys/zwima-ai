(function () {
  function authHeaders() {
    const token = window.ZwimaJwtManager?.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function request(path, options) {
    const url = (window.ZWIMA_CONFIG?.MOCK_API_BASE || "/api").startsWith("/") && path.startsWith("/api")
      ? path
      : path;
    const method = (options?.method || "GET").toUpperCase();
    const body = options?.body;
    const headers = { "Content-Type": "application/json", ...authHeaders(), ...(options?.headers || {}) };

    try {
      const res = await fetch(url.startsWith("/api") ? url : `${window.ZWIMA_CONFIG?.MOCK_API_BASE || "/api"}${url}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (res.status === 401 && window.ZwimaAuthService && !path.includes("/auth/refresh")) {
        await window.ZwimaAuthService.refreshToken();
        return request(path, options);
      }
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || `API ${res.status}`);
      }
      return json;
    } catch (networkErr) {
      if (!window.ZwimaDatabase) throw networkErr;
      await window.ZwimaDatabase.init();
      const result = await window.ZwimaDatabase.queryApi(
        path.startsWith("/api") ? path : `/api${path}`,
        method,
        typeof body === "string" ? JSON.parse(body) : body,
        { authorization: headers.Authorization, query: options?.query }
      );
      const total = result.total ?? null;
      const pagination = total != null
        ? { page: 1, limit: total, total, totalPages: Math.max(1, Math.ceil(total / (total || 1))) }
        : null;
      return {
        success: true,
        data: result.data,
        error: null,
        pagination,
        timestamp: new Date().toISOString(),
      };
    }
  }

  window.ZwimaApiClient = {
    get(path) {
      return request(path, { method: "GET" }).then((res) => res.data);
    },
    post(path, body) {
      return request(path, { method: "POST", body }).then((res) => res.data);
    },
    put(path, body) {
      return request(path, { method: "PUT", body }).then((res) => res.data);
    },
    request,
  };
})();
