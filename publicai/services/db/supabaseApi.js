(function () {
  function getAccessToken() {
    return window.ZwimaStorage?.getRaw?.("ACCESS_TOKEN") || "";
  }

  async function apiFetch(path, options = {}) {
    const token = getAccessToken();
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.error || `Request failed (${response.status})`);
      err.status = response.status;
      err.details = data.details;
      throw err;
    }
    return data;
  }

  window.ZwimaSupabaseApi = {
    getAccessToken,
    apiFetch,
  };
})();
