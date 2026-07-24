import type { AdapterChatRequest, AdapterEmbeddingsRequest } from "@/core/adapters/types";
import { calculateTokenCost } from "@/core/cost";
import { recordMonthlyUsage } from "@/core/cost/monthly-usage";
import {
  buildExecutionChain,
  resolveRoutingDecision,
  RoutingError,
} from "./model-router";
import {
  executeChatWithFailover,
  executeEmbeddingsWithFailover,
  streamWithFailover,
} from "./failover-manager";
import type { RoutingRequest } from "./types";

export type RoutedChatResult = {
  requestId: string;
  id: string;
  provider: string;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  finishReason: string;
  routing: {
    score: number;
    reasons: string[];
    failoverCount: number;
  };
  cost: {
    inputCostUsd: number;
    outputCostUsd: number;
    totalCostUsd: number;
  };
};

export type RoutedEmbeddingsResult = {
  requestId: string;
  id: string;
  provider: string;
  model: string;
  vectors: number[][];
  dimensions: number;
  inputTokens: number;
  routing: { score: number; reasons: string[]; failoverCount: number };
  cost: { totalCostUsd: number };
};

export class RoutingEngine {
  route(request: RoutingRequest, requestId?: string) {
    return resolveRoutingDecision(request, requestId);
  }

  async chat(
    routing: RoutingRequest,
    body: Omit<AdapterChatRequest, "model">,
    requestId?: string,
  ): Promise<RoutedChatResult> {
    const decision = resolveRoutingDecision(
      { ...routing, capability: "chat", streaming: false },
      requestId,
    );
    const chain = buildExecutionChain(decision);
    const { result, candidate, failoverCount } = await executeChatWithFailover(chain, body);

    const cost = calculateTokenCost({
      provider: candidate.provider,
      model: candidate.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    if (routing.organizationId) {
      recordMonthlyUsage({
        organizationId: routing.organizationId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalCostUsd: cost.totalCostUsd,
      });
    }

    return {
      requestId: decision.requestId,
      id: result.id,
      provider: result.provider,
      model: result.model,
      content: result.content,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      finishReason: result.finishReason,
      routing: {
        score: candidate.score,
        reasons: candidate.reasons,
        failoverCount,
      },
      cost: {
        inputCostUsd: cost.inputCostUsd,
        outputCostUsd: cost.outputCostUsd,
        totalCostUsd: cost.totalCostUsd,
      },
    };
  }

  async embeddings(
    routing: RoutingRequest,
    body: Omit<AdapterEmbeddingsRequest, "model">,
    requestId?: string,
  ): Promise<RoutedEmbeddingsResult> {
    const decision = resolveRoutingDecision(
      { ...routing, capability: "embeddings" },
      requestId,
    );
    const chain = buildExecutionChain(decision);
    const { result, candidate, failoverCount } = await executeEmbeddingsWithFailover(chain, body);

    const cost = calculateTokenCost({
      provider: candidate.provider,
      model: candidate.model,
      inputTokens: result.inputTokens,
      outputTokens: 0,
    });

    if (routing.organizationId) {
      recordMonthlyUsage({
        organizationId: routing.organizationId,
        inputTokens: result.inputTokens,
        outputTokens: 0,
        totalCostUsd: cost.totalCostUsd,
      });
    }

    return {
      requestId: decision.requestId,
      id: result.id,
      provider: result.provider,
      model: result.model,
      vectors: result.vectors,
      dimensions: result.dimensions,
      inputTokens: result.inputTokens,
      routing: {
        score: candidate.score,
        reasons: candidate.reasons,
        failoverCount,
      },
      cost: { totalCostUsd: cost.totalCostUsd },
    };
  }

  async *stream(
    routing: RoutingRequest,
    body: Omit<AdapterChatRequest, "model">,
    requestId?: string,
  ): AsyncGenerator<{
    requestId: string;
    chunk: import("@/core/adapters/types").AdapterStreamChunk;
    routing: { provider: string; model: string; score: number; failoverCount: number };
  }> {
    const decision = resolveRoutingDecision(
      { ...routing, capability: "stream", streaming: true },
      requestId,
    );
    const chain = buildExecutionChain(decision);

    for await (const { chunk, candidate, failoverCount } of streamWithFailover(chain, body)) {
      yield {
        requestId: decision.requestId,
        chunk,
        routing: {
          provider: candidate.provider,
          model: candidate.model,
          score: candidate.score,
          failoverCount,
        },
      };
    }
  }
}

export const routingEngine = new RoutingEngine();
export { RoutingError };
