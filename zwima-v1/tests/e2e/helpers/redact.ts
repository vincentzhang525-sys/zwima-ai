const SECRET_PATTERNS = [
  /sk_live_[A-Za-z0-9_-]{20,}/gi,
  /sk_test_[A-Za-z0-9_-]{20,}/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /"cookie"\s*:\s*"[^"]+"/gi,
  /__session=[^;\s]+/gi,
];

export function redactText(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

export function assertNoSecrets(text: string, label: string): void {
  if (/sk_live_[A-Za-z0-9_-]{20,}/i.test(text)) {
    throw new Error(`${label}: full API key pattern detected`);
  }
  if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text)) {
    throw new Error(`${label}: JWT/session token pattern detected`);
  }
  if (/__session=/.test(text)) {
    throw new Error(`${label}: session cookie detected`);
  }
}

export function apiKeyShapeOk(value: string): boolean {
  return /^sk_live_[A-Za-z0-9_-]{20,}$/.test(value);
}
