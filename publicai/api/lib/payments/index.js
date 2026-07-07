const StripePaymentProvider = require("./StripePaymentProvider");
const PayPalPaymentProvider = require("./PayPalPaymentProvider");
const SEPAPaymentProvider = require("./SEPAPaymentProvider");
const ManualInvoicePaymentProvider = require("./ManualInvoicePaymentProvider");
const GenericMockPaymentProvider = require("./GenericMockPaymentProvider");

const PROVIDERS = {
  stripe: StripePaymentProvider,
  paypal: PayPalPaymentProvider,
  sepa: SEPAPaymentProvider,
  manual_invoice: ManualInvoicePaymentProvider,
  mollie: () => new GenericMockPaymentProvider("mollie"),
  lemonsqueezy: () => new GenericMockPaymentProvider("lemonsqueezy"),
};

function resolvePaymentProvider(providerId = "stripe") {
  const key = String(providerId || "stripe").toLowerCase();
  const Factory = PROVIDERS[key];
  if (!Factory) return new StripePaymentProvider();
  return typeof Factory === "function" && Factory.prototype ? new Factory() : Factory();
}

function listProviders() {
  return [
    { id: "stripe", name: "Stripe", configured: Boolean(process.env.STRIPE_SECRET_KEY) },
    { id: "paypal", name: "PayPal", configured: Boolean(process.env.PAYPAL_CLIENT_ID) },
    { id: "sepa", name: "SEPA", configured: Boolean(process.env.SEPA_CREDITOR_ID || process.env.STRIPE_SECRET_KEY) },
    { id: "manual_invoice", name: "Manual Invoice", configured: true },
  ];
}

module.exports = {
  resolvePaymentProvider,
  listProviders,
  PROVIDERS,
};
