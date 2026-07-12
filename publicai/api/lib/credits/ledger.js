const { invoiceCompanyBlock } = require("../commercial/companyConfig");

async function creditAtomic(admin, {
  userId,
  amount,
  type = "topup",
  description,
  referenceType,
  referenceId,
  idempotencyKey,
  actorId,
  actorType,
}) {
  const { data, error } = await admin.rpc("credit_credits_atomic", {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_description: description,
    p_reference_type: referenceType || null,
    p_reference_id: referenceId || null,
    p_idempotency_key: idempotencyKey || null,
    p_actor_id: actorId || null,
    p_actor_type: actorType || null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    balance: Number(row?.new_balance ?? row?.newBalance) || 0,
    txnId: row?.txn_id ?? row?.txnId,
    alreadyApplied: Boolean(row?.already_applied ?? row?.alreadyApplied),
  };
}

async function deductAtomic(admin, {
  userId,
  amount,
  description,
  referenceType,
  referenceId,
  idempotencyKey,
}) {
  const { data, error } = await admin.rpc("deduct_credits_atomic", {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_reference_type: referenceType || "usage",
    p_reference_id: referenceId || null,
    p_idempotency_key: idempotencyKey || null,
  });
  if (error) {
    if (String(error.message || "").includes("insufficient credits")) {
      const err = new Error("Insufficient credits.");
      err.status = 402;
      throw err;
    }
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    balance: Number(row?.new_balance ?? row?.newBalance) || 0,
    txnId: row?.txn_id ?? row?.txnId,
    alreadyApplied: Boolean(row?.already_applied ?? row?.alreadyApplied),
  };
}

async function reconcileWallet(admin, userId) {
  const { data: wallet, error: walletError } = await admin
    .from("credit_wallets")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (walletError) throw walletError;

  const { data: txns, error: txnError } = await admin
    .from("credit_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("status", "completed");
  if (txnError) throw txnError;

  const ledgerBalance = (txns || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const walletBalance = Number(wallet?.balance) || 0;
  return {
    userId,
    walletBalance,
    ledgerBalance,
    delta: walletBalance - ledgerBalance,
    reconciled: walletBalance === ledgerBalance,
  };
}

async function reconcileAllWallets(admin, limit = 100) {
  const { data: wallets, error } = await admin.from("credit_wallets").select("user_id, balance").limit(limit);
  if (error) throw error;
  const results = [];
  for (const w of wallets || []) {
    results.push(await reconcileWallet(admin, w.user_id));
  }
  const mismatches = results.filter((r) => !r.reconciled);
  return { checked: results.length, mismatches: mismatches.length, samples: mismatches.slice(0, 10), results };
}

function buildInvoiceRecordWithCompany({ userId, orderId, currency, subtotal, tax, total }) {
  const commerce = require("../commerce");
  const company = invoiceCompanyBlock();
  return commerce.buildInvoiceRecord({
    userId,
    orderId,
    company: company.company,
    vat: company.vat,
    country: company.country,
    currency,
    subtotal,
    tax,
    total,
  });
}

module.exports = {
  creditAtomic,
  deductAtomic,
  reconcileWallet,
  reconcileAllWallets,
  buildInvoiceRecordWithCompany,
};
