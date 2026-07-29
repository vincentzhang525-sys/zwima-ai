export type OverviewResponse = Record<string, unknown> & {
  organization?: { name: string };
  creditBalance?: number;
  monthCostEur?: number;
};

export type OverviewFetchResult = {
  ok: boolean;
  data: OverviewResponse | null;
  status: number;
  errorCode: string | null;
  message: string;
};

let cached: { at: number; data: OverviewResponse } | null = null;
let inflight: Promise<OverviewFetchResult> | null = null;
let abortController: AbortController | null = null;

const TTL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 20_000;

function friendlyHttpMessage(status: number): string {
  if (status === 401) return "Session expired. Sign in again.";
  if (status === 403) return "You do not have access to this workspace.";
  if (status === 404) return "Workspace data was not found.";
  if (status >= 500) return "Server error while loading dashboard data.";
  if (status >= 400) return "Unable to load dashboard data.";
  return "Failed to load dashboard data.";
}

function parseApiError(body: unknown, status: number): { errorCode: string; message: string } {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const err = record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : {};
  const errorCode =
    typeof err.code === "string" ? err.code : status > 0 ? `HTTP_${status}` : "UNKNOWN";
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message
      : friendlyHttpMessage(status);
  return { errorCode, message };
}

/** Dedupe concurrent /api/workspace/overview fetches in dashboard UI. */
export async function fetchWorkspaceOverview(options?: {
  force?: boolean;
  timeoutMs?: number;
}): Promise<OverviewFetchResult> {
  const force = options?.force ?? false;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return { ok: true, data: cached.data, status: 200, errorCode: null, message: "" };
  }

  if (!force && inflight) return inflight;

  if (force) clearWorkspaceOverviewCache();

  abortController?.abort();
  const controller = new AbortController();
  abortController = controller;

  inflight = (async (): Promise<OverviewFetchResult> => {
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("/api/workspace/overview", {
        signal: controller.signal,
        credentials: "same-origin",
      });

      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok) {
        const { errorCode, message } = parseApiError(body, res.status);
        return { ok: false, data: null, status: res.status, errorCode, message };
      }

      const data = (body ?? {}) as OverviewResponse;
      cached = { at: Date.now(), data };
      return { ok: true, data, status: res.status, errorCode: null, message: "" };
    } catch (err) {
      const aborted =
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");

      if (aborted) {
        return {
          ok: false,
          data: null,
          status: 0,
          errorCode: "TIMEOUT",
          message: "Request timed out. Check your connection and retry.",
        };
      }

      return {
        ok: false,
        data: null,
        status: 0,
        errorCode: "NETWORK",
        message: "Network error while loading dashboard data.",
      };
    } finally {
      clearTimeout(timer);
      inflight = null;
      if (abortController === controller) abortController = null;
    }
  })();

  return inflight;
}

export function clearWorkspaceOverviewCache() {
  cached = null;
  inflight = null;
  abortController?.abort();
  abortController = null;
}
