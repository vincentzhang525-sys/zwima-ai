/**
 * Minimal in-memory fake for the subset of Prisma model-delegate methods
 * used by `src/lib/agents/registry-service.ts` and
 * `src/lib/agents/execution-engine.ts`. Used only by Phase 1 agent-platform
 * unit tests — no real database is ever touched.
 */

type Where = Record<string, unknown> | undefined;

function rowMatches(row: Record<string, unknown>, where: Where): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "OR" && Array.isArray(value)) {
      return (value as Where[]).some((clause) => rowMatches(row, clause));
    }
    return row[key] === value;
  });
}

export function makeFakeModel<T extends Record<string, unknown>>(prefix: string) {
  const rows: T[] = [];
  let counter = 0;

  function sortRows(list: T[], orderBy?: Record<string, "asc" | "desc">): T[] {
    if (!orderBy) return list;
    const [[field, dir]] = Object.entries(orderBy);
    return [...list].sort((a, b) => {
      const av = a[field] as unknown as number | string;
      const bv = b[field] as unknown as number | string;
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return dir === "desc" ? -cmp : cmp;
    });
  }

  return {
    _rows: rows,
    async create({ data }: { data: Record<string, unknown> }): Promise<T> {
      counter += 1;
      const row = { id: `${prefix}_${counter}`, ...data } as unknown as T;
      rows.push(row);
      return row;
    },
    async findUnique({ where }: { where: Record<string, unknown> }): Promise<T | null> {
      return rows.find((r) => rowMatches(r, where)) ?? null;
    },
    async findFirst({ where, orderBy }: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> } = {}): Promise<T | null> {
      const matched = rows.filter((r) => rowMatches(r, where));
      return sortRows(matched, orderBy)[0] ?? null;
    },
    async findMany({
      where,
      orderBy,
      take,
    }: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc">; take?: number } = {}): Promise<T[]> {
      const matched = rows.filter((r) => rowMatches(r, where));
      const sorted = sortRows(matched, orderBy);
      return typeof take === "number" ? sorted.slice(0, take) : sorted;
    },
    async update({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<T> {
      const row = rows.find((r) => rowMatches(r, where));
      if (!row) throw new Error(`${prefix}: row not found for update`);
      Object.assign(row, data);
      return row;
    },
    async upsert({
      where,
      create,
      update,
    }: {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<T> {
      const row = rows.find((r) => rowMatches(r, where));
      if (row) {
        Object.assign(row, update);
        return row;
      }
      counter += 1;
      const created = { id: `${prefix}_${counter}`, ...create } as unknown as T;
      rows.push(created);
      return created;
    },
    async delete({ where }: { where: Record<string, unknown> }): Promise<T> {
      const idx = rows.findIndex((r) => rowMatches(r, where));
      if (idx === -1) throw new Error(`${prefix}: row not found for delete`);
      const [removed] = rows.splice(idx, 1);
      return removed;
    },
    async deleteMany({ where }: { where?: Record<string, unknown> } = {}): Promise<{ count: number }> {
      const before = rows.length;
      const kept = rows.filter((r) => !rowMatches(r, where));
      rows.length = 0;
      rows.push(...kept);
      return { count: before - rows.length };
    },
    async count({ where }: { where?: Record<string, unknown> } = {}): Promise<number> {
      return rows.filter((r) => rowMatches(r, where)).length;
    },
  };
}

export function makeFakeAgentDb() {
  return {
    agentDefinition: makeFakeModel("agt"),
    agentVersion: makeFakeModel("agv"),
    agentRun: makeFakeModel("run"),
    agentRunStep: makeFakeModel("stp"),
    toolDefinition: makeFakeModel("tool"),
    toolExecution: makeFakeModel("exe"),
    agentMemory: makeFakeModel("mem"),
    agentTemplate: makeFakeModel("tpl"),
    agentMemoryPolicy: makeFakeModel("mpo"),
    agentExecutionLog: makeFakeModel("log"),
  };
}
