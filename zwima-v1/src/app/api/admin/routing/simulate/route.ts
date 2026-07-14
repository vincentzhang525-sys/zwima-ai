import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { simulateRouting } from "@/lib/routing/policy-engine";
import { simulateSmartRouting } from "@/lib/routing/smart-router";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const useSmart = body.engine === "smart" || process.env.ROUTING_ENGINE === "smart";

    if (useSmart) {
      const decision = await simulateSmartRouting({
        requestId: `sim_${Date.now()}`,
        organizationId: body.organizationId ?? null,
        apiKeyId: "simulator",
        requestedModel: String(body.model || "gemini-2.5-flash"),
        capability: body.capability,
        region: body.region,
        euOnly: Boolean(body.euOnly),
        estimatedInputTokens: Number(body.inputTokens ?? 500),
        estimatedOutputTokens: Number(body.outputTokens ?? 1024),
        optimizationMode: body.optimizationMode ?? body.strategy,
        streamingRequired: Boolean(body.streaming),
        preferredProvider: body.preferredProvider,
        metadata: body.metadata,
      });

      return NextResponse.json({
        simulate: true,
        engine: "smart",
        selected: {
          provider: decision.selectedProviderSlug,
          model: decision.selectedModelId,
          score: decision.totalScore,
          cost: decision.estimatedCostEur,
          latency: decision.estimatedLatencyMs,
        },
        reasons: decision.decisionReasons,
        fallbackChain: decision.fallbackChain,
        candidates: decision.candidates.map((c) => ({
          provider: c.providerSlug,
          model: c.modelId,
          score: c.totalScore,
          excluded: c.excluded,
          reasons: c.exclusionReasons,
          breakdown: c.scoreBreakdown,
        })),
        rejected: decision.rejectedCandidates.map((c) => ({
          provider: c.providerSlug,
          model: c.modelId,
          reasons: c.exclusionReasons,
        })),
        policy: decision.policySnapshot,
        compliance: decision.complianceFlags,
      });
    }

    const decision = await simulateRouting({
      organizationId: body.organizationId ?? null,
      apiKeyId: "simulator",
      requestedModel: String(body.model || "gemini-2.5-flash"),
      estimatedInputTokens: Number(body.inputTokens ?? 500),
      estimatedOutputTokens: Number(body.outputTokens ?? 1024),
      requiredRegion: body.region,
      strategy: body.strategy,
      maximumCost: body.budget ? Number(body.budget) : null,
    });

    return NextResponse.json({
      simulate: true,
      engine: "policy",
      selected: decision.selected,
      candidates: decision.candidates.map((c) => ({
        provider: c.providerSlug,
        model: c.modelCode,
        excluded: c.excluded,
        reason: c.exclusionReason,
        scores: c.scores,
        estimatedCost: c.estimatedProviderCostEur,
        customerCharge: c.estimatedCustomerCharge,
        marginPercent: c.estimatedMarginPercent,
      })),
      excluded: decision.excluded,
      strategy: decision.strategy,
      routingReason: decision.routingReason,
      estimatedMarginPercent: decision.estimatedMarginPercent,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
