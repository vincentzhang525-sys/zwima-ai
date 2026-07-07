const VAT_RATE = 0.19;

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calcTax(subtotal, taxRate = VAT_RATE) {
  return roundMoney(subtotal * taxRate);
}

function calcTotal(subtotal, taxRate = VAT_RATE) {
  const tax = calcTax(subtotal, taxRate);
  return { subtotal: roundMoney(subtotal), tax, total: roundMoney(subtotal + tax) };
}

function applyCoupon(subtotal, coupon) {
  if (!coupon || coupon.status !== "active") return { subtotal, discount: 0 };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { subtotal, discount: 0, error: "Coupon expired" };
  }
  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
    return { subtotal, discount: 0, error: "Coupon usage limit reached" };
  }
  let discount = 0;
  if (coupon.discount_type === "percentage") {
    discount = roundMoney(subtotal * (Number(coupon.discount_value) / 100));
  } else {
    discount = roundMoney(Math.min(subtotal, Number(coupon.discount_value)));
  }
  return { subtotal: roundMoney(Math.max(0, subtotal - discount)), discount };
}

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ZW-${ts}-${rand}`;
}

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-8);
  return `INV-${year}-${seq}`;
}

function generateReferralCode(userId) {
  const base = String(userId || "").replace(/-/g, "").slice(0, 6).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ZW${base}${rand}`;
}

function buildInvoiceRecord({ userId, orderId, company, vat, country, currency, subtotal, tax, total }) {
  const invoiceNumber = generateInvoiceNumber();
  return {
    user_id: userId,
    order_id: orderId,
    invoice_number: invoiceNumber,
    company: company || null,
    vat: vat || null,
    country: country || "DE",
    currency: currency || "EUR",
    subtotal: roundMoney(subtotal),
    tax: roundMoney(tax),
    total: roundMoney(total),
    status: "issued",
    download_url: `/api/billing/invoice?id=${invoiceNumber}`,
  };
}

const PLAN_ORDER = ["free", "starter", "professional", "business", "enterprise"];

function comparePlans(a, b) {
  return PLAN_ORDER.indexOf(a) - PLAN_ORDER.indexOf(b);
}

module.exports = {
  VAT_RATE,
  roundMoney,
  calcTax,
  calcTotal,
  applyCoupon,
  generateOrderNumber,
  generateInvoiceNumber,
  generateReferralCode,
  buildInvoiceRecord,
  comparePlans,
  PLAN_ORDER,
};
