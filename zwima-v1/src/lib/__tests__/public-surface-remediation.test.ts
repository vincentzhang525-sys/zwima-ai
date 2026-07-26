import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const LEGAL_REVIEW_BANNER = ["LEGAL", "REVIEW", "REQUIRED", "BEFORE", "PRODUCTION"].join(" ");

const LEGAL_PAGE_PATHS = [
  "src/app/imprint/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/cookies/page.tsx",
  "src/app/legal/dpa/page.tsx",
  "src/app/legal/sub-processors/page.tsx",
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("public legal surface remediation", () => {
  it("site header exposes legal footer links for all public legal pages", () => {
    const headerSrc = readRepoFile("src/components/site-header.tsx");
    const legalLinksSrc = readRepoFile("src/components/legal-draft-notice.tsx");
    const linkSurface = headerSrc.includes("LegalFooterLinks") ? legalLinksSrc : headerSrc;

    expect(headerSrc).toMatch(/LegalFooterLinks/);
    expect(linkSurface).toMatch(/\/privacy/);
    expect(linkSurface).toMatch(/\/terms/);
    expect(linkSurface).toMatch(/\/imprint/);
    expect(linkSurface).toMatch(/\/cookies/);
    expect(linkSurface).toMatch(/\/legal\/dpa/);
    expect(linkSurface).toMatch(/\/legal\/sub-processors/);
  });

  it("does not expose the production legal-review banner on public legal pages", () => {
    for (const relativePath of LEGAL_PAGE_PATHS) {
      const src = readRepoFile(relativePath);
      expect(src, relativePath).not.toContain(LEGAL_REVIEW_BANNER);
    }
  });
});
