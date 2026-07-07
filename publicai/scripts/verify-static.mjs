import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredPages = [
  "index.html",
  "about.html",
  "pricing.html",
  "contact.html",
  "impressum.html",
  "privacy.html",
  "terms.html",
  "login.html",
  "signup.html",
  "forgot-password.html",
  "verify-email.html",
  "auth.html",
  "cookie-policy.html",
  "dpa.html",
  "gdpr-export.html",
  "delete-account.html",
  "api-terms.html",
  "rate-limit-policy.html",
  "refund-policy.html",
  "status.html",
  "404.html",
  "500.html",
  "dashboard.html",
  "models.html",
  "apikeys.html",
  "credits.html",
  "provider.html",
  "routing.html",
  "gateway.html",
  "playground.html",
  "billing.html",
  "workspace.html",
  "profile.html",
  "notifications.html",
  "support.html",
  "help.html",
  "incidents.html",
  "changelog.html",
  "documentation.html",
  "admin.html",
];

const missing = requiredPages.filter((page) => !fs.existsSync(path.join(root, page)));

if (missing.length) {
  console.error("Missing static pages:", missing.join(", "));
  process.exit(1);
}

console.log(`Static build OK — ${requiredPages.length} pages verified.`);
