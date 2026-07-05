const tableBody = document.getElementById("apiKeysTableBody");
const createModal = document.getElementById("createKeyModal");
const createForm = document.getElementById("createKeyForm");
const visibleKeys = new Set();

function escapeHtml(text) {
  return window.ZwimaFormat?.escapeHtml?.(text) ?? String(text);
}

function statusClass(status) {
  return status === "Active" ? "active" : "disabled";
}

function maskKey(key) {
  if (!key) return "";
  return `${window.ZwimaApiKeyService.KEY_PREFIX}${"•".repeat(32)}`;
}

function renderKeys() {
  if (!tableBody) return;
  const keys = window.ZwimaApiKeyService.getKeys();

  if (!keys.length) {
    tableBody.innerHTML = '<tr><td colspan="6" class="muted">No API keys yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = keys
    .map((item) => {
      const isActive = item.status === "Active";
      const isVisible = visibleKeys.has(item.id);
      const displayKey = isVisible ? item.key : maskKey(item.key);
      return `
        <tr data-key-id="${escapeHtml(item.id)}">
          <td>${escapeHtml(item.name)}</td>
          <td class="muted key-value-cell">
            <code>${escapeHtml(displayKey)}</code>
            <button class="key-action-btn" type="button" data-action="toggle" data-id="${escapeHtml(item.id)}">
              ${isVisible ? "Hide" : "Show"}
            </button>
          </td>
          <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
          <td class="muted">${escapeHtml(item.createdAt)}</td>
          <td class="muted">${escapeHtml(item.lastUsed)}</td>
          <td class="actions-cell">
            <div class="key-actions">
              <button class="key-action-btn" type="button" data-action="copy" data-id="${escapeHtml(item.id)}">Copy</button>
              <button class="key-action-btn" type="button" data-action="rename" data-id="${escapeHtml(item.id)}">Rename</button>
              ${
                isActive
                  ? `<button class="key-action-btn" type="button" data-action="disable" data-id="${escapeHtml(item.id)}">Disable</button>`
                  : `<button class="key-action-btn" type="button" data-action="enable" data-id="${escapeHtml(item.id)}">Enable</button>`
              }
              <button class="key-action-btn danger" type="button" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function openCreateModal() {
  if (createModal) createModal.hidden = false;
}

function closeCreateModal() {
  if (createModal) createModal.hidden = true;
  createForm?.reset();
}

async function copyKey(id, button) {
  const item = window.ZwimaApiKeyService.getKeys().find((key) => key.id === id);
  if (!item) return;
  try {
    await navigator.clipboard.writeText(item.key);
    if (button) {
      const original = button.textContent;
      button.textContent = "Copied!";
      setTimeout(() => {
        button.textContent = original;
      }, 1500);
    }
  } catch {
    window.prompt("Copy your API key:", item.key);
  }
}

function handleAction(action, id, button) {
  const service = window.ZwimaApiKeyService;

  try {
    if (action === "toggle") {
      if (visibleKeys.has(id)) visibleKeys.delete(id);
      else visibleKeys.add(id);
      renderKeys();
      return;
    }

    if (action === "copy") {
      copyKey(id, button);
      return;
    }

    if (action === "rename") {
      const current = service.getKeys().find((key) => key.id === id);
      const newName = window.prompt("Enter new key name:", current?.name || "");
      if (!newName || newName.trim() === current?.name) return;
      service.renameKey(id, newName.trim());
    }

    if (action === "disable") service.disableKey(id);
    if (action === "enable") service.enableKey(id);

    if (action === "delete") {
      const current = service.getKeys().find((key) => key.id === id);
      if (!window.confirm(`Delete "${current?.name || "this key"}"? This cannot be undone.`)) return;
      visibleKeys.delete(id);
      service.deleteKey(id);
    }

    renderKeys();
  } catch (err) {
    window.alert(err.message || "Action failed.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderKeys();

  document.getElementById("openCreateKeyModal")?.addEventListener("click", openCreateModal);
  document.getElementById("cancelCreateKey")?.addEventListener("click", closeCreateModal);

  createModal?.addEventListener("click", (event) => {
    if (event.target === createModal) closeCreateModal();
  });

  createForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("keyName")?.value || "";
    try {
      window.ZwimaApiKeyService.createKey(name);
      closeCreateModal();
      renderKeys();
    } catch (err) {
      window.alert(err.message || "Could not create API key.");
    }
  });

  tableBody?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    handleAction(button.dataset.action, button.dataset.id, button);
  });

  if (new URLSearchParams(window.location.search).get("create") === "1") {
    openCreateModal();
  }
});
