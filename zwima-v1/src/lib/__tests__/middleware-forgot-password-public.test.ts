import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("middleware public auth routes", () => {
  it("allows unauthenticated /forgot-password without weakening dashboard protection", () => {
    const file = path.join(process.cwd(), "src/middleware.ts");
    const src = readFileSync(file, "utf8");

    expect(src).toMatch(/\/forgot-password\(\.\*\)/);
    expect(src).toMatch(/\/login\(\.\*\)/);
    expect(src).toMatch(/\/signup\(\.\*\)/);

    // Protected app surfaces must not be listed as public
    expect(src).not.toMatch(/\/dashboard/);
    expect(src).not.toMatch(/\/admin/);
  });
});
