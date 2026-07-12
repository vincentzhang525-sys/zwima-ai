async function billingFetch(path, options = {}) {
  return window.ZwimaSupabaseApi.apiFetch(path, options);
}

function showMessage(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
}

function handleCheckoutResult(result, successLabel) {
  if (result?.checkoutUrl) {
    window.location.href = result.checkoutUrl;
    return true;
  }
  if (result?.pending) {
    showMessage("billingError", "Checkout session could not be created. Verify Stripe configuration.");
    return true;
  }
  showMessage("billingSuccess", successLabel);
  return false;
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
  set("referralCode", billing.referral?.code || "—");
  set("referralInvites", Number(billing.referral?.successfulInvitations || 0).toLocaleString());
  set("referralCredits", Number(billing.referral?.creditsEarned || 0).toLocaleString());

  const packagesEl = document.getElementById("creditPackagesActions");
  if (packagesEl) {
    const pkgs = billing.creditPackages || [];
    packagesEl.innerHTML = pkgs.length
      ? pkgs
          .map(
            (p) =>
              `<button class="button button-secondary" type="button" data-package="${p.id}">Buy ${p.name} — €${Number(p.price).toFixed(2)}</button>`
          )
          .join("")
      : '<span class="muted">No packages available.</span>';
  }

  const ordersBody = document.getElementById("ordersBody");
  if (ordersBody) {
    const rows = billing.orders || [];
    ordersBody.innerHTML = rows.length
      ? rows
          .map(
            (row) => `<tr>
          <td>${row.orderNumber}</td>
          <td>${row.type}</td>
          <td>€${Number(row.total || 0).toFixed(2)}</td>
          <td>${row.status}</td>
          <td class="muted">${new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="5" class="muted">No orders yet.</td></tr>';
  }

  const txBody = document.getElementById("transactionsBody");
  if (txBody) {
    const rows = billing.transactions || [];
    txBody.innerHTML = rows.length
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
      : '<tr><td colspan="4" class="muted">No transactions yet.</td></tr>';
  }

  const methodsBody = document.getElementById("paymentMethodsBody");
  if (methodsBody) {
    const rows = billing.paymentMethods || [];
    methodsBody.innerHTML = rows.length
      ? rows
          .map(
            (row) => `<tr>
          <td>${row.provider}</td>
          <td>${row.type}</td>
          <td>${row.label}</td>
          <td>${row.isDefault ? "Yes" : "No"}</td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="4" class="muted">No payment methods yet.</td></tr>';
  }

  const invoicesBody = document.getElementById("invoicesBody");
  if (invoicesBody) {
    const rows = billing.invoices || [];
    invoicesBody.innerHTML = rows.length
      ? rows
          .map(
            (row) => `<tr>
          <td class="muted">${new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
          <td>${row.invoiceNumber || row.id}</td>
          <td>€${Number(row.amount || 0).toFixed(2)}</td>
          <td>${row.status}</td>
          <td>${row.downloadUrl ? `<a href="${row.downloadUrl}" target="_blank" rel="noreferrer">Download</a>` : "—"}</td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="5" class="muted">No invoices yet.</td></tr>';
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
    const couponCode = document.getElementById("couponInput")?.value?.trim() || "";
    const result = await billingFetch("/api/billing", {
      method: "POST",
      body: JSON.stringify({ action: "upgrade", plan, provider: "stripe", couponCode: couponCode || undefined }),
    });
    if (handleCheckoutResult(result, `Plan ${String(result.plan).toUpperCase()} checkout started.`)) return;
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

async function purchasePackage(packageId) {
  showMessage("billingError", "");
  showMessage("billingSuccess", "");
  try {
    const couponCode = document.getElementById("couponInput")?.value?.trim() || "";
    const result = await billingFetch("/api/billing", {
      method: "POST",
      body: JSON.stringify({ action: "purchase_package", packageId, provider: "stripe", couponCode: couponCode || undefined }),
    });
    if (handleCheckoutResult(result, "Redirecting to secure checkout…")) return;
    await Promise.all([window.ZwimaCreditsService?.refreshWallet?.(), refreshBilling()]);
  } catch (err) {
    showMessage("billingError", err.message || "Purchase failed.");
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

async function applyCoupon() {
  const code = document.getElementById("couponInput")?.value?.trim();
  if (!code) return;
  try {
    const result = await billingFetch("/api/billing", {
      method: "POST",
      body: JSON.stringify({ action: "apply_coupon", code }),
    });
    showMessage("billingSuccess", `Coupon ${result.coupon.code} valid: ${result.coupon.discountValue}${result.coupon.discountType === "percentage" ? "%" : " EUR"} off.`);
  } catch (err) {
    showMessage("billingError", err.message || "Invalid coupon.");
  }
}

async function applyReferral() {
  const referralCode = document.getElementById("referralInput")?.value?.trim();
  if (!referralCode) return;
  try {
    await billingFetch("/api/billing", {
      method: "POST",
      body: JSON.stringify({ action: "refer", referralCode }),
    });
    showMessage("billingSuccess", "Referral applied successfully.");
    await refreshBilling();
  } catch (err) {
    showMessage("billingError", err.message || "Referral failed.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("payment") === "success") {
    showMessage("billingSuccess", "Payment received. Credits will appear after webhook confirmation (usually within a minute).");
  }
  await refreshBilling();
  document.querySelectorAll("[data-plan]").forEach((button) => {
    button.addEventListener("click", () => upgradePlan(button.dataset.plan));
  });
  document.getElementById("creditPackagesActions")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-package]");
    if (btn) purchasePackage(btn.dataset.package);
  });
  document.getElementById("cancelSubscriptionBtn")?.addEventListener("click", cancelSubscription);
  document.getElementById("applyCouponBtn")?.addEventListener("click", applyCoupon);
  document.getElementById("applyReferralBtn")?.addEventListener("click", applyReferral);
});
