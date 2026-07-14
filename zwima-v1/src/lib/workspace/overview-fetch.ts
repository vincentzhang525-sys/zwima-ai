type OverviewResponse = Record<string, unknown> & {
  organization?: { name: string };
  creditBalance?: number;
  monthCostEur?: number;
};

let cached: { at: number; data: OverviewResponse } | null = null;
let inflight: Promise<OverviewResponse | null> | null = null;

const TTL_MS = 30_000;

/** Dedupe concurrent /api/workspace/overview fetches in dashboard UI. */
export async function fetchWorkspaceOverview(): Promise<OverviewResponse | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
  if (inflight) return inflight;

  inflight = fetch("/api/workspace/overview")
    .then(async (r) => {
      if (!r.ok) return null;
      const json = (await r.json()) as OverviewResponse;
      cached = { at: Date.now(), data: json };
      return json;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearWorkspaceOverviewCache() {
  cached = null;
  inflight = null;
}
