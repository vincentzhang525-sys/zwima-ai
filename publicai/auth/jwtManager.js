(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaJwtManager = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const cfg = () => (typeof window !== "undefined" ? window.ZWIMA_CONFIG || {} : global.ZWIMA_CONFIG || {});

  function b64(obj) {
    const json = JSON.stringify(obj);
    if (typeof btoa !== "undefined") return btoa(json);
    return Buffer.from(json).toString("base64");
  }

  function unb64(str) {
    try {
      const json = typeof atob !== "undefined" ? atob(str) : Buffer.from(str, "base64").toString("utf8");
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function sign(payload) {
    return `zwima.${b64(payload)}.${b64({ sig: "mock" })}`;
  }

  function decode(token) {
    if (!token || !token.startsWith("zwima.")) return null;
    const parts = token.split(".");
    if (parts.length < 3) return null;
    return unb64(parts[1]);
  }

  function isExpired(token) {
    const payload = decode(token);
    if (!payload?.exp) return true;
    return Date.now() >= payload.exp * 1000;
  }

  function storage() {
    return typeof window !== "undefined" ? window.ZwimaStorage : null;
  }

  function createTokenPair(user, type) {
    const now = Math.floor(Date.now() / 1000);
    const accessTtl = cfg().JWT_ACCESS_TTL_SEC || 900;
    const refreshTtl = cfg().JWT_REFRESH_TTL_SEC || 604800;
    const base = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      name: user.name,
    };
    return {
      accessToken: sign({ ...base, type: "access", iat: now, exp: now + accessTtl }),
      refreshToken: sign({ ...base, type: "refresh", iat: now, exp: now + refreshTtl }),
      expiresIn: accessTtl,
      expiresAt: (now + accessTtl) * 1000,
      tokenType: "Bearer",
    };
  }

  function setTokens(pair) {
    const s = storage();
    if (!s) return pair;
    s.setRaw("ACCESS_TOKEN", pair.accessToken);
    s.setRaw("REFRESH_TOKEN", pair.refreshToken);
    s.setRaw("TOKEN_EXPIRES_AT", String(pair.expiresAt));
    return pair;
  }

  function clearTokens() {
    const s = storage();
    if (!s) return;
    s.remove("ACCESS_TOKEN");
    s.remove("REFRESH_TOKEN");
    s.remove("TOKEN_EXPIRES_AT");
  }

  function getAccessToken() {
    const s = storage();
    return s?.getRaw("ACCESS_TOKEN") || null;
  }

  function getRefreshToken() {
    const s = storage();
    return s?.getRaw("REFRESH_TOKEN") || null;
  }

  function getExpiresAt() {
    const s = storage();
    const raw = s?.getRaw("TOKEN_EXPIRES_AT");
    return raw ? Number(raw) : 0;
  }

  function getUserFromAccessToken() {
    const token = getAccessToken();
    if (!token || isExpired(token)) return null;
    return decode(token);
  }

  let refreshTimer = null;

  function scheduleAutoRefresh(refreshFn) {
    if (typeof window === "undefined") return;
    if (refreshTimer) clearTimeout(refreshTimer);
    const expiresAt = getExpiresAt();
    if (!expiresAt) return;
    const ms = Math.max(expiresAt - Date.now() - 60000, 5000);
    refreshTimer = setTimeout(() => {
      refreshFn?.().catch(() => {});
      scheduleAutoRefresh(refreshFn);
    }, ms);
  }

  return {
    createTokenPair,
    decode,
    isExpired,
    setTokens,
    clearTokens,
    getAccessToken,
    getRefreshToken,
    getExpiresAt,
    getUserFromAccessToken,
    scheduleAutoRefresh,
    verify(token) {
      const payload = decode(token);
      if (!payload) return null;
      if (isExpired(token)) return null;
      return payload;
    },
  };
});
