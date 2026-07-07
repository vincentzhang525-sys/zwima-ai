const tableBody = document.getElementById("apiKeysTableBody");
const createModal = document.getElementById("createKeyModal");
const createForm = document.getElementById("createKeyForm");
const visibleKeys = new Set();
let page = 1;
const PAGE_SIZE = 10;

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
  const search = String(document.getElementById("apiKeySearch")?.value || "").toLowerCase();
  const keys = window.ZwimaApiKeyService
    .getKeys()
    .filter((item) => !search || String(item.name || "").toLowerCase().includes(search));
  const totalPages = Math.max(1, Math.ceil(keys.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  const paged = keys.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!paged.length) {
    tableBody.innerHTML = '<tr><td colspan="10" class="muted">No API keys yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = paged
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
          <td class="muted">${escapeHtml(item.createdTime ? new Date(item.createdTime).toLocaleString("en-GB") : item.createdAt)}</td>
          <td class="muted">${escapeHtml(item.expiresAt ? new Date(item.expiresAt).toLocaleDateString("en-GB") : "Never")}</td>
          <td class="muted">${escapeHtml(item.lastUsed)}</td>
          <td class="muted">${Number(item.totalRequests || 0).toLocaleString()}</td>
          <td class="muted">${Number(item.totalUsage || 0).toLocaleString()} credits</td>
          <td class="actions-cell">
            <div class="key-actions">
              <button class="key-action-btn" type="button" data-action="copy" data-id="${escapeHtml(item.id)}">Copy</button>
              <button class="key-action-btn" type="button" data-action="rename" data-id="${escapeHtml(item.id)}">Rename</button>
              ${
                isActive
                  ? `<button class="key-action-btn" type="button" data-action="disable" data-id="${escapeHtml(item.id)}">Revoke</button>`
                  : `<button class="key-action-btn" type="button" data-action="enable" data-id="${escapeHtml(item.id)}">Enable</button>`
              }
              <button class="key-action-btn danger" type="button" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
  const pageLabel = document.getElementById("keysPageLabel");
  if (pageLabel) pageLabel.textContent = `Page ${page} / ${totalPages}`;
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

async function handleAction(action, id, button) {
  const service = window.ZwimaApiKeyService;

  try {
    if (action === "toggle") {
      if (visibleKeys.has(id)) visibleKeys.delete(id);
      else visibleKeys.add(id);
      renderKeys();
      return;
    }

    if (action === "copy") {
      await copyKey(id, button);
      return;
    }

    if (action === "rename") {
      const current = service.getKeys().find((key) => key.id === id);
      const newName = window.prompt("Enter new key name:", current?.name || "");
      if (!newName || newName.trim() === current?.name) return;
      await service.renameKey(id, newName.trim());
      return renderKeys();
    }

    if (action === "disable") await service.disableKey(id);
    if (action === "enable") await service.enableKey(id);

    if (action === "delete") {
      const current = service.getKeys().find((key) => key.id === id);
      if (!window.confirm(`Delete "${current?.name || "this key"}"? This cannot be undone.`)) return;
      visibleKeys.delete(id);
      await service.deleteKey(id);
    }

    renderKeys();
  } catch (err) {
    window.alert(err.message || "Action failed.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.ZwimaDbMode?.isSupabaseMode?.()) {
    await window.ZwimaApiKeyService?.refreshKeys?.();
  }
  renderKeys();

  document.getElementById("openCreateKeyModal")?.addEventListener("click", openCreateModal);
  document.getElementById("cancelCreateKey")?.addEventListener("click", closeCreateModal);

  createModal?.addEventListener("click", (event) => {
    if (event.target === createModal) closeCreateModal();
  });

  createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("keyName")?.value || "";
    const expiresAt = document.getElementById("keyExpireAt")?.value || null;
    try {
      await window.ZwimaApiKeyService.createKey(name, expiresAt);
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
  document.getElementById("apiKeySearch")?.addEventListener("input", () => {
    page = 1;
    renderKeys();
  });
  document.getElementById("keysPrevPage")?.addEventListener("click", () => {
    if (page <= 1) return;
    page -= 1;
    renderKeys();
  });
  document.getElementById("keysNextPage")?.addEventListener("click", () => {
    page += 1;
    renderKeys();
  });
});
