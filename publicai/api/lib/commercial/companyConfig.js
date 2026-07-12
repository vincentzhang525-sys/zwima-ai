/**
 * Centralized legal / company configuration for Zwima Technologie GmbH.
 * Missing fields are null — do not invent legal data.
 */
const COMPANY = {
  legalName: "Zwima Technologie GmbH",
  brandName: "ZWIMA AI",
  street: "Dormagener Str. 2e",
  city: "Neuss",
  postalCode: "41468",
  country: "Germany",
  countryCode: "DE",
  email: "info@zwima-group.com",
  supportEmail: "info@zwima-group.com",
  website: "https://zwima-group.com",
  platformUrl: "https://zwima-group.info",
  /** Founder input required */
  managingDirector: null,
  registerCourt: null,
  hrbNumber: null,
  vatId: null,
  taxNumber: null,
};

function getCompanyConfig() {
  return { ...COMPANY };
}

function getMissingLegalFields() {
  const missing = [];
  if (!COMPANY.managingDirector) missing.push({ field: "managingDirector", label: "Geschäftsführer" });
  if (!COMPANY.registerCourt) missing.push({ field: "registerCourt", label: "Handelsregister court" });
  if (!COMPANY.hrbNumber) missing.push({ field: "hrbNumber", label: "HRB number" });
  if (!COMPANY.vatId) missing.push({ field: "vatId", label: "VAT ID (USt-IdNr.)" });
  return missing;
}

function formatAddress() {
  return `${COMPANY.street}, ${COMPANY.postalCode} ${COMPANY.city}, ${COMPANY.country}`;
}

function invoiceCompanyBlock() {
  return {
    company: COMPANY.legalName,
    address: formatAddress(),
    email: COMPANY.email,
    vat: COMPANY.vatId,
    country: COMPANY.countryCode,
  };
}

module.exports = {
  COMPANY,
  getCompanyConfig,
  getMissingLegalFields,
  formatAddress,
  invoiceCompanyBlock,
};
