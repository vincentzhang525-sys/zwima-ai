export * from "./credits-engine";
export * from "./pricing-engine";
export * from "./margin-engine";
export * from "./invoice-engine";
export * from "./subscription-engine";
export * from "./exchange-rate";

import {
  processRecharge,
  chargeForUsage,
  getWallet,
  getUserTransactions,
  validateCoupon,
} from "./credits-engine";
import { listAllPricing, upsertModelPricing, calculateUsageCredits } from "./pricing-engine";
import { listMarginRules, upsertMarginRule, getEffectiveMultiplier } from "./margin-engine";
import { createInvoice, getUserInvoices, renderInvoiceHtml } from "./invoice-engine";
import { createSubscriptionCheckout, listUserSubscriptions } from "./subscription-engine";

/** Unified Billing Engine — all monetary operations go through here. */
export const BillingEngine = {
  recharge: processRecharge,
  chargeUsage: chargeForUsage,
  getWallet,
  getTransactions: getUserTransactions,
  validateCoupon,
  pricing: { list: listAllPricing, upsert: upsertModelPricing, calculate: calculateUsageCredits },
  margin: { list: listMarginRules, upsert: upsertMarginRule, getMultiplier: getEffectiveMultiplier },
  invoice: { create: createInvoice, list: getUserInvoices, renderHtml: renderInvoiceHtml },
  subscription: { checkout: createSubscriptionCheckout, list: listUserSubscriptions },
};
