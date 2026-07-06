let pendingTopUpEur = null;

const modal = document.getElementById("topUpModal");
const errorEl = document.getElementById("walletError");

function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message || "";
  errorEl.hidden = !message;
}

function formatCredits(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatEur(value) {
  return `€${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function typeLabel(type) {
  const map = { topup: "Top-up", usage: "Usage", adjustment: "Adjustment" };
  return map[type] || type;
}

function renderWallet() {
  const service = window.ZwimaCreditsService;
  if (!service) return;

  const wallet = service.getWallet();
  const balanceEl = document.getElementById("walletBalance");
  const eurEl = document.getElementById("walletEurValue");
  const monthlyEl = document.getElementById("walletMonthlyUsage");

  if (balanceEl) balanceEl.textContent = formatCredits(wallet.balance);
  if (eurEl) eurEl.textContent = formatEur(service.getEstimatedEurValue(wallet.balance));
  if (monthlyEl) monthlyEl.textContent = `${formatCredits(service.getMonthlyUsage())} credits`;

  renderTransactions(service.getTransactions());
}

function renderTransactions(rows) {
  const body = document.getElementById("walletTransactionsBody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="muted">No transactions yet.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((row) => {
      const amount = Number(row.amount) || 0;
      const sign = amount >= 0 ? "+" : "";
      return `
        <tr>
          <td class="muted">${row.date}</td>
          <td>${typeLabel(row.type)}</td>
          <td>${sign}${formatCredits(Math.abs(amount))}</td>
          <td>${row.description}</td>
          <td><span class="status-pill active">${row.status}</span></td>
        </tr>
      `;
    })
    .join("");
}

function openTopUpModal(eur) {
  pendingTopUpEur = Number(eur);
  const credits = pendingTopUpEur * window.ZwimaCreditsService.CREDITS_PER_EUR;
  const text = document.getElementById("topUpConfirmText");
  if (text) {
    text.textContent = `Add €${pendingTopUpEur} (${formatCredits(credits)} credits) to your wallet?`;
  }
  if (modal) modal.hidden = false;
}

function closeTopUpModal() {
  pendingTopUpEur = null;
  if (modal) modal.hidden = true;
}

async function confirmTopUp() {
  if (!pendingTopUpEur) return;
  try {
    showError("");
    await window.ZwimaCreditsService.topUp(pendingTopUpEur);
    closeTopUpModal();
    renderWallet();
  } catch (err) {
    showError(err.message || "Top-up failed.");
  }
}

async function simulateUsage() {
  try {
    showError("");
    await window.ZwimaCreditsService.spend(250, "Simulated API usage (Playground request)");
    renderWallet();
  } catch (err) {
    showError(err.message || "Usage simulation failed.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.ZwimaDbMode?.isSupabaseMode?.()) {
    await window.ZwimaCreditsService?.refreshWallet?.();
  }
  renderWallet();

  window.ZwimaAppEvents?.onUpdated?.((detail) => {
    if (detail.source !== "playground" && detail.source !== "credits") return;
    const refresh = window.ZwimaDbMode?.isSupabaseMode?.()
      ? window.ZwimaCreditsService.refreshWallet()
      : Promise.resolve();
    refresh.then(() => renderWallet());
  });

  document.querySelector(".wallet-topup-options")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-eur]");
    if (!button) return;
    openTopUpModal(button.dataset.eur);
  });

  document.getElementById("cancelTopUp")?.addEventListener("click", closeTopUpModal);
  document.getElementById("confirmTopUp")?.addEventListener("click", confirmTopUp);
  document.getElementById("simulateUsageBtn")?.addEventListener("click", simulateUsage);

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeTopUpModal();
  });
});
