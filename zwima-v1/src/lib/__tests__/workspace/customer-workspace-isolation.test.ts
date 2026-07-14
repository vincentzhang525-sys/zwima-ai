import { describe, it, expect } from "vitest";
import { parseApiKeyMetadata } from "@/lib/workspace/project-repository";
import { paginate, creditsToEur } from "@/lib/workspace/http";

describe("customer-workspace-isolation", () => {
  it("parseApiKeyMetadata never exposes secrets from metadata", () => {
    const meta = parseApiKeyMetadata({ projectId: "p1", routingMode: "BALANCED", secret: "sk_live_abc" });
    expect(meta.projectId).toBe("p1");
    expect(meta).not.toHaveProperty("secret");
  });

  it("pagination helper slices items correctly", () => {
    const items = Array.from({ length: 30 }, (_, i) => i + 1);
    const page1 = paginate(items, 1, 10);
    expect(page1.items).toHaveLength(10);
    expect(page1.pagination.total).toBe(30);
    expect(page1.pagination.totalPages).toBe(3);
  });

  it("customer cost view uses credits not provider secrets", () => {
    expect(creditsToEur(1000)).toBe(1);
    expect(String(creditsToEur(500))).not.toContain("sk_live");
  });
});
