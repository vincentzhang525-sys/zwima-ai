import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("middleware public auth routes", () => {
  it("allows unauthenticated /forgot-password without weakening dashboard protection", () => {
    const file = path.join(process.cwd(), "src/middleware.ts");
    const src = readFileSync(file, "utf8");
    const publicBlock = src.slice(src.indexOf("createRouteMatcher(["), src.indexOf("]);", src.indexOf("createRouteMatcher([")) + 3);

    expect(publicBlock).toMatch(/\/forgot-password\(\.\*\)/);
    expect(publicBlock).toMatch(/\/login\(\.\*\)/);
    expect(publicBlock).toMatch(/\/signup\(\.\*\)/);
    expect(publicBlock).toMatch(/\/privacy\(\.\*\)/);
    expect(publicBlock).toMatch(/\/api\/health\(\.\*\)/);

    // Protected app surfaces must not be listed as public matchers
    expect(publicBlock).not.toMatch(/\/dashboard/);
    expect(publicBlock).not.toMatch(/\/admin/);
  });
});
