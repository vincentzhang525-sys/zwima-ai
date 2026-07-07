async function billingFetch(path, options = {}) {
  return window.ZwimaSupabaseApi.apiFetch(path, options);
}

function showMessage(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
}

function renderBilling(data) {
  const billing = data?.billing || {};
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "—";
  };
  set("billingPlan", String(billing.currentPlan || "free").toUpperCase());
  set("billingCredits", Number(billing.remainingCredits || 0).toLocaleString());
  set("billingRenewAt", billing.renewAt ? new Date(billing.renewAt).toLocaleDateString("en-GB") : "—");
  set("billingMethod", billing.paymentMethod || "—");

  const invoicesBody = document.getElementById("invoicesBody");
  if (invoicesBody) {
    const rows = billing.invoices || [];
    invoicesBody.innerHTML = rows.length
      ? rows
          .map(
            (row) => `<tr>
          <td class="muted">${new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
          <td>€${Number(row.amount || 0).toFixed(2)}</td>
          <td>${row.status}</td>
          <td>${row.invoiceUrl ? `<a href="${row.invoiceUrl}" target="_blank" rel="noreferrer">Open</a>` : "—"}</td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="4" class="muted">No invoices yet.</td></tr>';
  }

  const paymentsBody = document.getElementById("paymentsBody");
  if (paymentsBody) {
    const rows = billing.payments || [];
    paymentsBody.innerHTML = rows.length
      ? rows
          .map(
            (row) => `<tr>
          <td class="muted">${new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
          <td>${row.provider}</td>
          <td>€${Number(row.amount || 0).toFixed(2)}</td>
          <td>${row.status}</td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="4" class="muted">No payments yet.</td></tr>';
  }
}

async function refreshBilling() {
  const data = await billingFetch("/api/billing");
  renderBilling(data);
}

async function upgradePlan(plan) {
  showMessage("billingError", "");
  showMessage("billingSuccess", "");
  try {
    const result = await billingFetch("/api/billing", {
      method: "POST",
      body: JSON.stringify({ action: "upgrade", plan, provider: "stripe" }),
    });
    showMessage(
      "billingSuccess",
      `Plan ${String(result.plan).toUpperCase()} activated. +${Number(result.creditsAdded).toLocaleString()} credits provisioned.`
    );
    await Promise.all([
      window.ZwimaCreditsService?.refreshWallet?.(),
      window.ZwimaUsageService?.refreshRecords?.(),
      refreshBilling(),
    ]);
    window.ZwimaAppEvents?.emit?.("data-updated", { source: "billing", credits: true, usage: true });
  } catch (err) {
    showMessage("billingError", err.message || "Upgrade failed.");
  }
}

async function cancelSubscription() {
  showMessage("billingError", "");
  showMessage("billingSuccess", "");
  try {
    await billingFetch("/api/billing", {
      method: "POST",
      body: JSON.stringify({ action: "cancel", provider: "stripe" }),
    });
    showMessage("billingSuccess", "Subscription canceled.");
    await refreshBilling();
  } catch (err) {
    showMessage("billingError", err.message || "Cancel failed.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await refreshBilling();
  document.querySelectorAll("[data-plan]").forEach((button) => {
    button.addEventListener("click", () => upgradePlan(button.dataset.plan));
  });
  document.getElementById("cancelSubscriptionBtn")?.addEventListener("click", cancelSubscription);
});
