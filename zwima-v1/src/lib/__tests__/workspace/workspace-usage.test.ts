import { describe, it, expect } from "vitest";
import { usageQuerySchema, parseQuery } from "@/lib/workspace/schemas";
import { paginate } from "@/lib/workspace/http";

describe("workspace-usage", () => {
  it("parses usage query filters", () => {
    const q = parseQuery(usageQuerySchema, { range: "7d", page: "2", pageSize: "50", status: "success" });
    expect(q.range).toBe("7d");
    expect(q.page).toBe(2);
    expect(q.status).toBe("success");
  });

  it("paginates usage rows", () => {
    const rows = Array.from({ length: 55 }, (_, i) => ({ id: String(i) }));
    const p = paginate(rows, 2, 25);
    expect(p.items).toHaveLength(25);
    expect(p.pagination.page).toBe(2);
  });

  it("empty usage returns zero summary semantics", () => {
    const empty = paginate([], 1, 25);
    expect(empty.pagination.total).toBe(0);
    expect(empty.items).toEqual([]);
  });
});
