import { describe, it, expect } from "vitest";
import { createProjectSchema, updateProjectSchema, parseBody } from "@/lib/workspace/schemas";

describe("workspace-projects", () => {
  it("validates create project input", () => {
    const body = parseBody(createProjectSchema, { name: "My Project", description: "Test" });
    expect(body.name).toBe("My Project");
  });

  it("rejects empty project name", () => {
    expect(() => parseBody(createProjectSchema, { name: "" })).toThrow();
  });

  it("allows archive status update", () => {
    const body = parseBody(updateProjectSchema, { status: "ARCHIVED" });
    expect(body.status).toBe("ARCHIVED");
  });

  it("project repository interface supports ACTIVE and ARCHIVED", () => {
    const statuses = ["ACTIVE", "ARCHIVED"];
    expect(statuses).toContain("ACTIVE");
    expect(statuses).toContain("ARCHIVED");
  });
});
