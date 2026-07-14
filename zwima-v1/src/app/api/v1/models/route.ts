import { NextResponse } from "next/server";
import { getAllAdapters } from "@/lib/providers/registry";
import { listVerifiedModels } from "@/lib/pricing/pricing-service";
import { hashApiKey } from "@/lib/credits";
import { resolveApiKey, validateApiKeyState } from "@/lib/api-keys/governance";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

  let allowedModels: string[] | null = null;
  if (apiKey) {
    const key = await resolveApiKey(hashApiKey(apiKey));
    if (key) {
      try {
        validateApiKeyState(key);
        if (key.allowedModels.length > 0) allowedModels = key.allowedModels;
      } catch {
        return NextResponse.json({ error: { code: "INVALID_API_KEY", message: "Invalid API key" } }, { status: 401 });
      }
    }
  }

  const verified = await listVerifiedModels();
  if (verified.length > 0) {
    const models = verified
      .filter((m) => !allowedModels || allowedModels.includes(m.modelCode))
      .map((m) => ({
        id: m.modelCode,
        name: m.displayName,
        provider: m.provider.slug,
        capabilities: {
          streaming: m.supportsStreaming,
          tools: m.supportsTools,
          vision: m.supportsVision,
          json: m.supportsJson,
          reasoning: m.supportsReasoning,
        },
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
        status: m.status,
      }));
    const providers = [...new Set(models.map((m) => m.provider))].map((slug) => ({
      slug,
      name: slug,
    }));
    return NextResponse.json({ providers, models });
  }

  // Legacy adapter catalog
  const adapters = getAllAdapters();
  const providers = adapters.map((a) => ({ slug: a.slug, name: a.name }));
  let models = adapters.flatMap((a) =>
    a.models().map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      status: "ACTIVE",
    }))
  );
  if (allowedModels) models = models.filter((m) => allowedModels!.includes(m.id));

  return NextResponse.json({ providers, models });
}
