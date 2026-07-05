let selectedAmountEur = 10;
let activeCustomInput = null;
let topUpOptions = [];

const modal = document.getElementById("topUpModal");
const openModalBtn = document.getElementById("openTopUpModal");
const cancelBtn = document.getElementById("cancelTopUp");
const confirmModalBtn = document.getElementById("confirmTopUp");
const confirmInlineBtn = document.getElementById("confirmTopUpInline");

function getAmountEur() {
  if (selectedAmountEur === "custom") {
    const input = activeCustomInput || document.getElementById("customCredits");
    const value = Number(input?.value || 0);
    return value > 0 ? value : 0;
  }
  return Number(selectedAmountEur);
}

function updateSummary(prefix = "") {
  const amountEur = getAmountEur() || 10;
  const { price, vat, total, credits } = window.ZwimaBillingService.calculateTopUpPricing(amountEur);
  const fmt = window.ZwimaFormat;
  const ids = {
    price: document.getElementById(`${prefix}summaryPrice`),
    vat: document.getElementById(`${prefix}summaryVat`),
    total: document.getElementById(`${prefix}summaryTotal`),
  };

  if (ids.price) ids.price.textContent = fmt.formatMoney(price);
  if (ids.vat) ids.vat.textContent = fmt.formatMoney(vat);
  if (ids.total) ids.total.textContent = `${fmt.formatMoney(total)} · ${Math.round(credits)} credits`;
}

function renderTopUpButtons(container, groupName) {
  if (!container) return;
  container.innerHTML = topUpOptions
    .map((amount) => {
      const label = amount === "custom" ? "Custom Amount" : `€${amount}`;
      const selected = amount === String(selectedAmountEur) ? " selected" : "";
      return `<button class="topup-option${selected}" type="button" data-credits="${amount}" data-group="${groupName}">${label}</button>`;
    })
    .join("");
}

function selectAmount(amount, group) {
  selectedAmountEur = amount;
  activeCustomInput =
    group === "modal"
      ? document.getElementById("customCreditsModal")
      : document.getElementById("customCredits");

  const customWrapInline = document.getElementById("customCreditsWrap");
  const customWrapModal = document.getElementById("customCreditsWrapModal");

  if (amount === "custom") {
    customWrapInline?.removeAttribute("hidden");
    customWrapModal?.removeAttribute("hidden");
  } else {
    customWrapInline?.setAttribute("hidden", "");
    customWrapModal?.setAttribute("hidden", "");
  }

  renderTopUpButtons(document.getElementById("topUpOptions"), "inline");
  renderTopUpButtons(document.getElementById("topUpOptionsModal"), "modal");
  updateSummary("");
  updateSummary("modal");
}

function renderCostBreakdown(items) {
  const list = document.getElementById("costBreakdown");
  if (!list) return;

  list.innerHTML = items
    .map(
      (item) => `
      <li class="breakdown-item">
        <div class="breakdown-row">
          <span>${item.label}</span>
          <span>${item.percent}%</span>
        </div>
        <div class="breakdown-bar"><span style="width:${item.percent}%"></span></div>
      </li>
    `
    )
    .join("");
}

function renderProviderUsage(items) {
  const list = document.getElementById("providerUsage");
  if (!list) return;

  list.innerHTML = items
    .map(
      (item) => `
      <li class="usage-provider-item">
        <div class="usage-provider-row">
          <span>${item.name}</span>
          <span>${item.percent}%</span>
        </div>
        <div class="usage-provider-bar"><span style="width:${item.percent}%"></span></div>
      </li>
    `
    )
    .join("");
}

function renderSpendingChart(monthlySpending) {
  const chart = document.getElementById("spendingChart");
  if (!chart) return;

  const max = Math.max(...monthlySpending.map((m) => m.amount));

  chart.innerHTML = monthlySpending
    .map((item) => {
      const height = Math.round((item.amount / max) * 100);
      return `
      <div class="spending-bar-col">
        <span class="spending-bar-value">€${item.amount}</span>
        <div class="spending-bar" style="height:${height}%"></div>
        <span class="spending-bar-label">${item.month}</span>
      </div>
    `;
    })
    .join("");
}

function statusClass(status) {
  const map = {
    Completed: "active",
    completed: "active",
    succeeded: "active",
    paid: "active",
    Pending: "pending",
    pending: "pending",
    Failed: "failed",
    failed: "failed",
    Refunded: "refunded",
    refunded: "refunded",
  };
  return map[status] || "planned";
}

function renderTransactions(rows) {
  const body = document.getElementById("transactionTableBody");
  if (!body) return;

  body.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td class="muted">${row.date}</td>
        <td>${row.amount}</td>
        <td>${row.credits}</td>
        <td>${row.provider}</td>
        <td><span class="status-pill ${statusClass(row.status)}">${row.status}</span></td>
        <td>
          ${
            row.invoice === "—"
              ? '<span class="muted">—</span>'
              : `<button class="invoice-btn" type="button" data-invoice="${row.invoice}">Download PDF</button>`
          }
        </td>
      </tr>
    `
    )
    .join("");
}

function renderPaymentHistory(rows) {
  const body = document.getElementById("paymentHistoryBody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="muted">No payments yet.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td class="muted">${(row.createdAt || row.date || "").slice(0, 10)}</td>
        <td>€${Number(row.amountEur || 0).toFixed(2)}</td>
        <td>${row.credits}</td>
        <td><span class="status-pill ${statusClass(row.status)}">${row.status}</span></td>
        <td class="muted">${row.sessionId || "—"}</td>
      </tr>
    `
    )
    .join("");
}

function renderInvoices(rows) {
  const body = document.getElementById("invoicesTableBody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="muted">No invoices yet.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.id}</td>
        <td class="muted">${row.date}</td>
        <td>€${Number(row.amountEur || 0).toFixed(2)}</td>
        <td>${row.credits}</td>
        <td><span class="status-pill ${statusClass(row.status)}">${row.status}</span></td>
        <td><button class="invoice-btn" type="button" data-invoice="${row.id}">Download PDF</button></td>
      </tr>
    `
    )
    .join("");
}

function renderPaymentMethods(methods) {
  const list = document.getElementById("paymentMethods");
  if (!list) return;

  list.innerHTML = methods
    .map(
      (method) => `
      <li class="payment-method-item${method.default ? " default" : ""}">
        <div>
          <div class="payment-method-name">${method.name}</div>
          <div class="payment-method-meta">${method.meta}</div>
        </div>
        ${method.default ? '<span class="payment-method-badge">Default</span>' : '<span class="payment-method-badge">Available</span>'}
      </li>
    `
    )
    .join("");
}

function openModal() {
  if (!modal) return;
  selectAmount(selectedAmountEur, "modal");
  modal.hidden = false;
}

function closeModal() {
  if (!modal) return;
  modal.hidden = true;
}

async function refreshBillingData() {
  const billing = window.ZwimaBillingService;
  const [overview, dashboard, payments, invoices, transactions] = await Promise.all([
    billing.getCreditsOverview(),
    billing.getBillingDashboard(),
    billing.getPaymentHistory(),
    billing.getInvoices(),
    billing.getTransactions(),
  ]);

  const heroBalance = document.getElementById("heroBalance");
  if (heroBalance) heroBalance.textContent = overview.balanceLabel;

  const autoRecharge = document.getElementById("autoRecharge");
  const monthlyLimit = document.getElementById("monthlyLimit");
  const alertThreshold = document.getElementById("alertThreshold");
  if (autoRecharge) autoRecharge.checked = !!dashboard.autoRecharge;
  if (monthlyLimit) monthlyLimit.value = dashboard.monthlyLimit;
  if (alertThreshold) alertThreshold.value = dashboard.alertThreshold;

  renderPaymentHistory(payments);
  renderInvoices(invoices);
  renderTransactions(transactions);
}

async function confirmTopUp() {
  const amountEur = getAmountEur();
  if (!amountEur) {
    window.alert("Please select or enter a valid amount.");
    return;
  }

  const result = await window.ZwimaBillingService.createCheckout(amountEur);
  closeModal();

  if (result.checkoutUrl) {
    window.location.href = result.checkoutUrl;
    return;
  }

  await refreshBillingData();
  window.alert(result.message || "Credits added successfully via Stripe.");
}

function downloadInvoice(invoiceId) {
  const content = `ZWIMA AI Invoice\n\nInvoice ID: ${invoiceId}\nCompany: Zwima Technologie GmbH\nCurrency: EUR\nProvider: Stripe\n\nThank you for your purchase.`;
  const blob = new Blob([content], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoiceId}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", async () => {
  const billing = window.ZwimaBillingService;
  const [overview, breakdown, providerUsage, monthlySpending, transactions, paymentMethods, options, payments, invoices] =
    await Promise.all([
      billing.getCreditsOverview(),
      billing.getCostBreakdown(),
      billing.getProviderUsage(),
      billing.getMonthlySpending(),
      billing.getTransactions(),
      billing.getPaymentMethods(),
      billing.getTopUpOptions(),
      billing.getPaymentHistory(),
      billing.getInvoices(),
    ]);

  topUpOptions = options;
  const heroBalance = document.getElementById("heroBalance");
  if (heroBalance) heroBalance.textContent = overview.balanceLabel;

  renderTopUpButtons(document.getElementById("topUpOptions"), "inline");
  renderTopUpButtons(document.getElementById("topUpOptionsModal"), "modal");
  renderCostBreakdown(breakdown);
  renderProviderUsage(providerUsage);
  renderSpendingChart(monthlySpending);
  renderTransactions(transactions);
  renderPaymentHistory(payments);
  renderInvoices(invoices);
  renderPaymentMethods(paymentMethods);
  selectAmount(10, "inline");

  const params = new URLSearchParams(window.location.search);
  if (params.get("payment") === "success" && params.get("session_id")) {
    await window.ZwimaStripeClient.completeCheckout(params.get("session_id"));
    await refreshBillingData();
    window.history.replaceState({}, "", "credits.html");
  }

  document.getElementById("topUpOptions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-credits]");
    if (!button || button.dataset.group !== "inline") return;
    selectAmount(button.dataset.credits, "inline");
  });

  document.getElementById("topUpOptionsModal")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-credits]");
    if (!button || button.dataset.group !== "modal") return;
    selectAmount(button.dataset.credits, "modal");
  });

  document.getElementById("customCredits")?.addEventListener("input", () => {
    activeCustomInput = document.getElementById("customCredits");
    updateSummary("");
    updateSummary("modal");
  });

  document.getElementById("customCreditsModal")?.addEventListener("input", () => {
    activeCustomInput = document.getElementById("customCreditsModal");
    updateSummary("");
    updateSummary("modal");
  });

  openModalBtn?.addEventListener("click", openModal);
  cancelBtn?.addEventListener("click", closeModal);
  confirmModalBtn?.addEventListener("click", confirmTopUp);
  confirmInlineBtn?.addEventListener("click", confirmTopUp);

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.getElementById("transactionTableBody")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-invoice]");
    if (!button) return;
    downloadInvoice(button.dataset.invoice);
  });

  document.getElementById("invoicesTableBody")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-invoice]");
    if (!button) return;
    downloadInvoice(button.dataset.invoice);
  });

  document.getElementById("billingCurrency")?.addEventListener("change", (event) => {
    const currency = event.target.value;
    if (currency === "USD") {
      window.alert("USD billing is available on request. Display remains in EUR for this demo.");
      event.target.value = "EUR";
    }
  });

  document.getElementById("billingSettingsForm")?.addEventListener("change", async () => {
    await billing.saveBillingSettings({
      autoRecharge: document.getElementById("autoRecharge")?.checked,
      monthlyLimit: Number(document.getElementById("monthlyLimit")?.value || 0),
      alertThreshold: Number(document.getElementById("alertThreshold")?.value || 0),
    });
  });
});
