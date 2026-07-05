(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaSessionManager = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function storage() {
    return typeof window !== "undefined" ? window.ZwimaStorage : null;
  }

  function getSessions() {
    return storage()?.get("AUTH_SESSIONS", []) || [];
  }

  function saveSessions(sessions) {
    storage()?.set("AUTH_SESSIONS", sessions);
    return sessions;
  }

  function getCurrentSessionId() {
    return storage()?.getRaw("CURRENT_SESSION_ID") || null;
  }

  function setCurrentSessionId(id) {
    storage()?.setRaw("CURRENT_SESSION_ID", id);
  }

  function rememberLogin(enabled) {
    storage()?.setRaw("REMEMBER_LOGIN", enabled ? "1" : "0");
  }

  function isRememberLogin() {
    return storage()?.getRaw("REMEMBER_LOGIN") === "1";
  }

  function registerSession(session) {
    const sessions = getSessions();
    const next = [session, ...sessions.filter((s) => s.id !== session.id)].slice(0, 10);
    saveSessions(next);
    setCurrentSessionId(session.id);
    return session;
  }

  function revokeSession(sessionId) {
    const sessions = getSessions().filter((s) => s.id !== sessionId);
    saveSessions(sessions);
    if (getCurrentSessionId() === sessionId) setCurrentSessionId(sessions[0]?.id || null);
    return true;
  }

  function revokeOtherSessions() {
    const current = getCurrentSessionId();
    const sessions = getSessions().filter((s) => s.id === current);
    saveSessions(sessions);
    return sessions.length;
  }

  function clearAll() {
    saveSessions([]);
    setCurrentSessionId(null);
    rememberLogin(false);
  }

  return {
    getSessions,
    getCurrentSessionId,
    rememberLogin,
    isRememberLogin,
    registerSession,
    revokeSession,
    revokeOtherSessions,
    clearAll,
    buildSession(user, meta) {
      return {
        id: `sess-${Date.now()}`,
        userId: user.id,
        device: meta?.device || "Web Browser",
        location: meta?.location || "Berlin, DE",
        current: true,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
    },
  };
});
