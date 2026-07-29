"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchWorkspaceOverview,
  type OverviewFetchResult,
  type OverviewResponse,
} from "@/lib/workspace/overview-fetch";

type WorkspaceOverviewContextValue = {
  data: OverviewResponse | null;
  loading: boolean;
  error: string;
  kind: OverviewFetchResult["kind"] | null;
  requestId: string | null;
  refresh: () => Promise<void>;
};

const WorkspaceOverviewContext = createContext<WorkspaceOverviewContextValue | null>(null);

async function loadOverviewDetails(
  generation: number,
  generationRef: { current: number },
  base: OverviewResponse,
  setData: (data: OverviewResponse) => void,
) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch("/api/workspace/overview/details", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return;
    const details = (await res.json()) as Record<string, unknown>;
    if (generation !== generationRef.current) return;
    setData({ ...base, ...details, detailsDeferred: false });
  } catch {
    // Optional details — keep first-screen data
  }
}

export function WorkspaceOverviewProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<OverviewFetchResult["kind"] | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const generationRef = useRef(0);

  const refresh = useCallback(async (force = true) => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetchWorkspaceOverview({ force });
      if (generation !== generationRef.current) return;
      setKind(result.kind);
      setRequestId(result.requestId);
      if (!result.ok || !result.data) {
        setData(null);
        setError(result.message || "Failed to load dashboard data.");
        return;
      }
      setData(result.data);
      setError("");
      void loadOverviewDetails(generation, generationRef, result.data, setData);
    } catch (err) {
      if (generation !== generationRef.current) return;
      setData(null);
      setKind("network_error");
      setRequestId(null);
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      kind,
      requestId,
      refresh: () => refresh(true),
    }),
    [data, loading, error, kind, requestId, refresh],
  );

  return (
    <WorkspaceOverviewContext.Provider value={value}>{children}</WorkspaceOverviewContext.Provider>
  );
}

export function useWorkspaceOverview(): WorkspaceOverviewContextValue {
  const ctx = useContext(WorkspaceOverviewContext);
  if (!ctx) {
    throw new Error("useWorkspaceOverview must be used within WorkspaceOverviewProvider");
  }
  return ctx;
}
