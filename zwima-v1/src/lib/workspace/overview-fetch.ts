export type OverviewResponse = Record<string, unknown> & {
  organization?: { name: string };
  creditBalance?: number;
  monthCostEur?: number;
};

export type OverviewFetchKind =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "timeout"
  | "server_error"
  | "network_error"
  | "client_error";

export type OverviewFetchResult = {
  ok: boolean;
  kind: OverviewFetchKind;
  data: OverviewResponse | null;
  status: number;
  errorCode: string | null;
  message: string;
  requestId: string;
};

type InflightEntry = {
  requestId: string;
  promise: Promise<OverviewFetchResult>;
  controller: AbortController;
};

let cached: { at: number; data: OverviewResponse } | null = null;
let inflight: InflightEntry | null = null;

const TTL_MS = 30_000;
/** Hard wall-clock budget — must settle even if AbortSignal is ignored by the runtime. */
export const DEFAULT_TIMEOUT_MS = 15_000;

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ov-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function kindFromStatus(status: number): OverviewFetchKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status >= 500) return "server_error";
  if (status >= 400) return "client_error";
  return "client_error";
}

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

function timeoutResult(requestId: string): OverviewFetchResult {
  return {
    ok: false,
    kind: "timeout",
    data: null,
    status: 0,
    errorCode: "TIMEOUT",
    message: "Request timed out. Check your connection and retry.",
    requestId,
  };
}

function networkResult(requestId: string): OverviewFetchResult {
  return {
    ok: false,
    kind: "network_error",
    data: null,
    status: 0,
    errorCode: "NETWORK",
    message: "Network error while loading dashboard data.",
    requestId,
  };
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

/**
 * Fetch /api/workspace/overview with hard wall-clock timeout.
 * AbortController is best-effort; Promise.race ALWAYS settles within timeoutMs.
 */
export async function fetchWorkspaceOverview(options?: {
  force?: boolean;
  timeoutMs?: number;
}): Promise<OverviewFetchResult> {
  const force = options?.force ?? false;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return {
      ok: true,
      kind: "success",
      data: cached.data,
      status: 200,
      errorCode: null,
      message: "",
      requestId: newRequestId(),
    };
  }

  if (!force && inflight) return inflight.promise;

  if (force) {
    const previous = inflight;
    cached = null;
    inflight = null;
    previous?.controller.abort();
  }

  const requestId = newRequestId();
  const controller = new AbortController();
  const startedAt = Date.now();

  const promise = (async (): Promise<OverviewFetchResult> => {
    let winner: OverviewFetchResult | null = null;
    const mark = (result: OverviewFetchResult): OverviewFetchResult => {
      if (!winner) winner = result;
      return winner;
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<OverviewFetchResult>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(mark(timeoutResult(requestId)));
      }, timeoutMs);
    });

    const fetchPromise = (async (): Promise<OverviewFetchResult> => {
      try {
        const res = await fetch("/api/workspace/overview", {
          signal: controller.signal,
          credentials: "same-origin",
          headers: {
            "x-zwima-request-id": requestId,
          },
          cache: "no-store",
        });

        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }

        if (winner) return winner;

        if (!res.ok) {
          const { errorCode, message } = parseApiError(body, res.status);
          return mark({
            ok: false,
            kind: kindFromStatus(res.status),
            data: null,
            status: res.status,
            errorCode,
            message,
            requestId,
          });
        }

        const data = (body ?? {}) as OverviewResponse;
        cached = { at: Date.now(), data };
        return mark({
          ok: true,
          kind: "success",
          data,
          status: res.status,
          errorCode: null,
          message: "",
          requestId,
        });
      } catch (err) {
        if (winner) return winner;
        if (controller.signal.aborted || isAbortError(err)) {
          return mark(timeoutResult(requestId));
        }
        return mark(networkResult(requestId));
      }
    })();

    try {
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      return result;
    } finally {
      if (timer) clearTimeout(timer);
      if (inflight?.requestId === requestId) {
        inflight = null;
      }
      // Touch startedAt so tree-shakers keep the timing variable for future logs if needed
      void startedAt;
    }
  })();

  inflight = { requestId, promise, controller };
  return promise;
}

export function clearWorkspaceOverviewCache() {
  const previous = inflight;
  cached = null;
  inflight = null;
  previous?.controller.abort();
}
