(function () {
  function currencySymbol() {
    return window.ZWIMA_CONFIG?.DEFAULT_CURRENCY === "USD" ? "$" : "€";
  }

  window.ZwimaFormat = {
    formatMoney(amount) {
      return `${currencySymbol()}${Number(amount).toFixed(2)}`;
    },
    formatNumber(value) {
      return Number(value).toLocaleString();
    },
    formatDate(date) {
      const d = date instanceof Date ? date : new Date(date);
      return d.toISOString().slice(0, 10);
    },
    formatTimestamp(date) {
      const d = date instanceof Date ? date : new Date(date);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    getInitials(name) {
      return String(name || "U")
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    },
    escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
    truncate(text, len) {
      const value = String(text || "").trim();
      if (value.length <= len) return value;
      return `${value.slice(0, len)}...`;
    },
    slugify(name) {
      return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    },
    randomKeySuffix(length) {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < (length || 12); i += 1) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    },
    generateApiKeyPrefix() {
      return `zwima_live_${window.ZwimaFormat.randomKeySuffix()}`;
    },
    displayPrefix(fullKey) {
      return String(fullKey).slice(0, 18);
    },
  };
})();
