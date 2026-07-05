(function () {
  const svc = window.ZwimaProviderService;
  if (!svc) return;

  window.PROVIDERS = {};
  window.PROVIDER_LIST = [];

  svc.getProviderMap().then((map) => {
    window.PROVIDERS = map;
    window.PROVIDER_LIST = Object.values(map);
  });

  window.getProviderFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get("provider") || "openai").toLowerCase();
    return window.PROVIDERS[id] || window.PROVIDERS.openai || { id, name: id };
  };
  window.randomKeySuffix = () => window.ZwimaFormat.randomKeySuffix();
  window.generateApiKeyPrefix = () => window.ZwimaFormat.generateApiKeyPrefix();
  window.formatDate = (date) => window.ZwimaFormat.formatDate(date);
  window.formatRelativeDay = (offset) => {
    if (offset === 0) return "Today";
    if (offset === 1) return "Yesterday";
    return `${offset} days ago`;
  };
})();
