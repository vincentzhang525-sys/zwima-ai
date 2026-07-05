const tableBody = document.getElementById("apiKeysTableBody");
const activityLog = document.getElementById("activityLog");
const createModal = document.getElementById("createKeyModal");
const revealModal = document.getElementById("revealKeyModal");
const openBtn = document.getElementById("openCreateKeyModal");
const cancelBtn = document.getElementById("cancelCreateKey");
const form = document.getElementById("createKeyForm");
const providerSelect = document.getElementById("keyProvider");
const filterProvider = document.getElementById("filterProvider");
const filterStatus = document.getElementById("filterStatus");
const filterEnvironment = document.getElementById("filterEnvironment");
const searchInput = document.getElementById("searchKeys");
const revealedKeyValue = document.getElementById("revealedKeyValue");

let keys = [];
let activity = [];
let providerOptions = [];
let revealedFullKey = "";
let filters = { search: "", provider: "", status: "", environment: "" };

function statusClass(status) {
  return status === "Active" ? "active" : "disabled";
}

function escapeHtml(text) {
  return window.ZwimaFormat.escapeHtml(text);
}

function getFilteredKeys() {
  return keys.filter((key) => {
    if (filters.provider && key.provider !== filters.provider) return false;
    if (filters.status && key.status !== filters.status) return false;
    if (filters.environment && key.environment !== filters.environment) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = [key.name, key.prefix, key.provider, key.environment, key.scopes.join(" "), key.status]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function renderKeys() {
  if (!tableBody) return;
  const visible = getFilteredKeys();

  if (!visible.length) {
    tableBody.innerHTML = '<tr><td colspan="11" class="muted">No API keys match your filters.</td></tr>';
    return;
  }

  tableBody.innerHTML = visible
    .map((key) => {
      const isActive = key.status === "Active";
      return `
        <tr data-key-id="${key.id}">
          <td>${escapeHtml(key.name)}</td>
          <td class="muted">${escapeHtml(key.prefix)}...</td>
          <td>${escapeHtml(key.provider)}</td>
          <td>${escapeHtml(key.scopes.join(", "))}</td>
          <td>${escapeHtml(key.environment)}</td>
          <td class="muted">${escapeHtml(key.created)}</td>
          <td class="muted">${escapeHtml(key.lastUsed)}</td>
          <td><span class="status-pill ${statusClass(key.status)}">${escapeHtml(key.status)}</span></td>
          <td class="muted">${escapeHtml(key.quota)}</td>
          <td class="muted">${escapeHtml(key.usage)}</td>
          <td class="actions-cell">
            <div class="key-actions">
              ${
                isActive
                  ? `<button class="key-action-btn" type="button" data-action="disable" data-id="${key.id}">Disable</button>`
                  : `<button class="key-action-btn" type="button" data-action="enable" data-id="${key.id}">Enable</button>`
              }
              <button class="key-action-btn" type="button" data-action="rename" data-id="${key.id}">Rename</button>
              <button class="key-action-btn" type="button" data-action="rotate" data-id="${key.id}">Rotate Key</button>
              <button class="key-action-btn danger" type="button" data-action="delete" data-id="${key.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderActivity() {
  if (!activityLog) return;

  activityLog.innerHTML = activity
    .map(
      (item) => `
        <li class="activity-log-item">
          <span class="activity-log-type">${escapeHtml(item.type)}</span>
          <span class="activity-log-detail">${escapeHtml(item.detail)}</span>
          <time class="activity-log-time">${escapeHtml(item.time)}</time>
        </li>
      `
    )
    .join("");
}

function populateFilterProviders() {
  if (!filterProvider) return;
  const current = filterProvider.value;
  filterProvider.innerHTML =
    '<option value="">All Providers</option>' +
    providerOptions.map((p) => `<option value="${p}">${p}</option>`).join("");
  filterProvider.value = current;
}

function applyUrlProvider() {
  const params = new URLSearchParams(window.location.search);
  const providerId = params.get("provider");
  const map = {
    openai: "OpenAI",
    anthropic: "Claude",
    google: "Gemini",
    deepseek: "DeepSeek",
    qwen: "Qwen",
    mistral: "Mistral",
    glm: "OpenRouter",
  };
  if (providerId && map[providerId] && providerSelect) {
    providerSelect.value = map[providerId];
  }
}

function openCreateModal() {
  if (!createModal) return;
  createModal.hidden = false;
}

function closeCreateModal() {
  if (!createModal) return;
  createModal.hidden = true;
  form?.reset();
  const readCheck = form?.querySelector('input[value="Read"]');
  if (readCheck) readCheck.checked = true;
  applyUrlProvider();
}

function showRevealModal(fullKey) {
  revealedFullKey = fullKey;
  if (revealedKeyValue) revealedKeyValue.textContent = fullKey;
  if (revealModal) revealModal.hidden = false;
}

function closeRevealModal() {
  revealedFullKey = "";
  if (revealModal) revealModal.hidden = true;
}

function getScopesFromForm(formData) {
  const scopes = formData.getAll("scopes");
  return scopes.length ? scopes.map(String) : ["Read"];
}

function createKeyRecord(formData, fullKey) {
  const env = String(formData.get("environment") || "Production");
  const quotaMap = {
    Production: "100,000 / mo",
    Testing: "50,000 / mo",
    Development: "10,000 / mo",
  };

  return {
    id: `key-${Date.now()}`,
    name: String(formData.get("keyName") || "New Key"),
    prefix: window.ZwimaFormat.displayPrefix(fullKey),
    provider: String(formData.get("keyProvider") || "OpenAI"),
    environment: env,
    scopes: getScopesFromForm(formData),
    expiration: String(formData.get("expiration") || "Never"),
    created: window.ZwimaFormat.formatDate(new Date()),
    lastUsed: "Today",
    status: "Active",
    quota: quotaMap[env] || "50,000 / mo",
    usage: "0",
  };
}

function findKeyIndex(id) {
  return keys.findIndex((k) => k.id === id);
}

async function saveKeys() {
  await window.ZwimaBillingService.saveApiKeys(keys);
}

async function saveActivity() {
  await window.ZwimaBillingService.saveApiKeyActivity(activity);
}

function addActivity(type, detail) {
  activity.unshift({ type, detail, time: window.ZwimaFormat.formatTimestamp(new Date()) });
  activity = activity.slice(0, 20);
  saveActivity();
  renderActivity();
}

function handleKeyAction(action, id) {
  const index = findKeyIndex(id);
  if (index === -1) return;
  const key = keys[index];

  if (action === "disable") {
    keys[index].status = "Disabled";
    addActivity("Disabled Key", `${key.name} disabled`);
  }

  if (action === "enable") {
    keys[index].status = "Active";
    addActivity("Enabled Key", `${key.name} re-enabled`);
  }

  if (action === "rename") {
    const newName = window.prompt("Enter new key name:", key.name);
    if (!newName || newName.trim() === key.name) return;
    keys[index].name = newName.trim();
    addActivity("Renamed Key", `Key renamed to "${newName.trim()}"`);
  }

  if (action === "delete") {
    if (!window.confirm(`Delete "${key.name}"? This cannot be undone.`)) return;
    keys.splice(index, 1);
    addActivity("Deleted Key", `${key.name} permanently deleted`);
  }

  if (action === "rotate") {
    const fullKey = window.ZwimaFormat.generateApiKeyPrefix();
    keys[index].prefix = window.ZwimaFormat.displayPrefix(fullKey);
    keys[index].lastUsed = "Today";
    keys[index].status = "Active";
    addActivity("Rotated Key", `${key.name} rotated — previous key invalidated`);
    showRevealModal(fullKey);
  }

  saveKeys();
  renderKeys();
}

document.addEventListener("DOMContentLoaded", async () => {
  const billing = window.ZwimaBillingService;
  [keys, activity, providerOptions] = await Promise.all([
    billing.getApiKeys(),
    billing.getApiKeyActivity(),
    billing.getProviderOptions(),
  ]);

  populateFilterProviders();
  applyUrlProvider();
  renderKeys();
  renderActivity();

  openBtn?.addEventListener("click", openCreateModal);
  cancelBtn?.addEventListener("click", closeCreateModal);

  createModal?.addEventListener("click", (event) => {
    if (event.target === createModal) closeCreateModal();
  });

  revealModal?.addEventListener("click", (event) => {
    if (event.target === revealModal) closeRevealModal();
  });

  document.getElementById("closeRevealKey")?.addEventListener("click", closeRevealModal);

  document.getElementById("copyKeyBtn")?.addEventListener("click", async () => {
    if (!revealedFullKey) return;
    await navigator.clipboard.writeText(revealedFullKey);
  });

  document.getElementById("downloadKeyBtn")?.addEventListener("click", () => {
    if (!revealedFullKey) return;
    const blob = new Blob([`ZWIMA AI API Key\n\n${revealedFullKey}\n\nStore securely. Do not share.`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zwima-api-key.txt";
    link.click();
    URL.revokeObjectURL(url);
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const fullKey = window.ZwimaFormat.generateApiKeyPrefix();
    const record = createKeyRecord(formData, fullKey);

    keys = [record, ...keys];
    saveKeys();
    renderKeys();
    closeCreateModal();
    showRevealModal(fullKey);
    addActivity("Created Key", `${record.name} created for ${record.provider} (${record.environment})`);
  });

  searchInput?.addEventListener("input", () => {
    filters.search = searchInput.value.trim();
    renderKeys();
  });

  filterProvider?.addEventListener("change", () => {
    filters.provider = filterProvider.value;
    renderKeys();
  });

  filterStatus?.addEventListener("change", () => {
    filters.status = filterStatus.value;
    renderKeys();
  });

  filterEnvironment?.addEventListener("change", () => {
    filters.environment = filterEnvironment.value;
    renderKeys();
  });

  tableBody?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    handleKeyAction(button.dataset.action, button.dataset.id);
  });

  if (new URLSearchParams(window.location.search).get("create") === "1") {
    openCreateModal();
  }
});
