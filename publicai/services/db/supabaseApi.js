(function () {
  const inFlight = new Map();
  const GET_CACHE_TTL_MS = 8000;
  const cache = new Map();

  function getAccessToken() {
    return window.ZwimaStorage?.getRaw?.("ACCESS_TOKEN") || "";
  }

  async function apiFetch(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const cacheKey = `${method}:${path}:${options.body || ""}`;
    if (method === "GET") {
      const hit = cache.get(cacheKey);
      if (hit && Date.now() - hit.ts < GET_CACHE_TTL_MS) return hit.data;
      if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
    }

    const token = getAccessToken();
    const req = fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = new Error(data.error || `Request failed (${response.status})`);
        err.status = response.status;
        err.details = data.details;
        throw err;
      }
      if (method === "GET") cache.set(cacheKey, { ts: Date.now(), data });
      return data;
    }).finally(() => {
      if (method === "GET") inFlight.delete(cacheKey);
    });

    if (method === "GET") inFlight.set(cacheKey, req);
    return req;
  }

  window.ZwimaSupabaseApi = {
    getAccessToken,
    apiFetch,
  };
})();
