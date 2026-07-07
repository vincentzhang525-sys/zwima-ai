const StripePaymentProvider = require("./StripePaymentProvider");
const GenericMockPaymentProvider = require("./GenericMockPaymentProvider");

function resolvePaymentProvider(providerId = "stripe") {
  const key = String(providerId || "stripe").toLowerCase();
  if (key === "stripe") return new StripePaymentProvider();
  if (key === "paypal") return new GenericMockPaymentProvider("paypal");
  if (key === "mollie") return new GenericMockPaymentProvider("mollie");
  if (key === "lemonsqueezy") return new GenericMockPaymentProvider("lemonsqueezy");
  return new StripePaymentProvider();
}

module.exports = {
  resolvePaymentProvider,
};
