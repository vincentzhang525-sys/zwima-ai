import { requireUnifiedAdapter } from "@/core/adapters";
import type { AdapterChatRequest, AdapterEmbeddingsRequest } from "@/core/adapters/types";
import { recordFailure, recordSuccess } from "@/core/health";
import type { RoutingCandidate } from "./types";
import { withRetry, DEFAULT_RETRY_POLICY } from "./retry-policy";

export type FailoverResult<T> = {
  result: T;
  candidate: RoutingCandidate;
  attempt: number;
  failoverCount: number;
};

export async function executeChatWithFailover(
  chain: RoutingCandidate[],
  request: Omit<AdapterChatRequest, "model">,
): Promise<FailoverResult<Awaited<ReturnType<ReturnType<typeof requireUnifiedAdapter>["chat"]>>>> {
  return executeWithFailover(chain, async (candidate) => {
    const adapter = requireUnifiedAdapter(candidate.provider);
    const started = Date.now();
    try {
      const result = await withRetry(
        () => adapter.chat({ ...request, model: candidate.model }),
        DEFAULT_RETRY_POLICY,
      );
      recordSuccess(candidate.provider, result.latencyMs ?? Date.now() - started);
      return result;
    } catch (err) {
      recordFailure(candidate.provider);
      throw err;
    }
  });
}

export async function executeEmbeddingsWithFailover(
  chain: RoutingCandidate[],
  request: Omit<AdapterEmbeddingsRequest, "model">,
): Promise<FailoverResult<Awaited<ReturnType<ReturnType<typeof requireUnifiedAdapter>["embeddings"]>>>> {
  return executeWithFailover(chain, async (candidate) => {
    const adapter = requireUnifiedAdapter(candidate.provider);
    try {
      const result = await adapter.embeddings({ ...request, model: candidate.model });
      recordSuccess(candidate.provider, 0);
      return result;
    } catch (err) {
      recordFailure(candidate.provider);
      throw err;
    }
  });
}

export async function* streamWithFailover(
  chain: RoutingCandidate[],
  request: Omit<AdapterChatRequest, "model">,
): AsyncGenerator<
  { chunk: import("@/core/adapters/types").AdapterStreamChunk; candidate: RoutingCandidate; failoverCount: number },
  void,
  unknown
> {
  let failoverCount = 0;
  for (let i = 0; i < chain.length; i++) {
    const candidate = chain[i]!;
    const adapter = requireUnifiedAdapter(candidate.provider);
    try {
      for await (const chunk of adapter.stream({ ...request, model: candidate.model })) {
        yield { chunk, candidate, failoverCount };
        if (chunk.done) {
          recordSuccess(candidate.provider, 0);
          return;
        }
      }
      return;
    } catch {
      recordFailure(candidate.provider);
      failoverCount += 1;
      if (i === chain.length - 1) throw new Error("All providers failed during streaming");
    }
  }
}

async function executeWithFailover<T>(
  chain: RoutingCandidate[],
  fn: (candidate: RoutingCandidate) => Promise<T>,
): Promise<FailoverResult<T>> {
  let failoverCount = 0;
  let lastError: unknown;

  for (let i = 0; i < chain.length; i++) {
    const candidate = chain[i]!;
    try {
      const result = await fn(candidate);
      return { result, candidate, attempt: i + 1, failoverCount };
    } catch (err) {
      lastError = err;
      failoverCount += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Routing failover exhausted");
}
