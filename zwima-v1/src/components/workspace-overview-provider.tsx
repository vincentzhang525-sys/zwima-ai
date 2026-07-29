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
