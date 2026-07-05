(function () {
  function getKey(key) {
    return window.ZwimaConstants?.STORAGE_KEYS?.[key] || key;
  }

  window.ZwimaStorage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(getKey(key));
        if (!raw) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(getKey(key), JSON.stringify(value));
      return value;
    },
    getRaw(key) {
      return localStorage.getItem(getKey(key));
    },
    setRaw(key, value) {
      localStorage.setItem(getKey(key), value);
      return value;
    },
    remove(key) {
      localStorage.removeItem(getKey(key));
    },
  };
})();
