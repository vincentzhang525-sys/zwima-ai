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
  "dashboard.html",
  "models.html",
  "apikeys.html",
  "credits.html",
  "provider.html",
  "routing.html",
  "gateway.html",
  "playground.html",
  "billing.html",
  "profile.html",
  "notifications.html",
  "documentation.html",
  "admin.html",
];

const missing = requiredPages.filter((page) => !fs.existsSync(path.join(root, page)));

if (missing.length) {
  console.error("Missing static pages:", missing.join(", "));
  process.exit(1);
}

console.log(`Static build OK — ${requiredPages.length} pages verified.`);
