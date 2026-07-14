import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getCurrentDbUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ROUTING_POLICY, validateRoutingPolicy } from "@/lib/routing/policy-config";

export async function GET() {
  try {
    await requireAdmin();
    const row = await prisma.platformConfig.findUnique({ where: { key: "smart_routing_default" } });
    let policy = DEFAULT_ROUTING_POLICY;
    if (row?.value) {
      try {
        policy = validateRoutingPolicy(JSON.parse(row.value)).policy;
      } catch {
        /* use default */
      }
    }
    const policies = await prisma.routingPolicy.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ systemPolicy: policy, policies });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const body = await req.json();
    const { policy, organizationId, policyId } = body;

    if (policy) {
      const validated = validateRoutingPolicy(policy);
      await prisma.platformConfig.upsert({
        where: { key: "smart_routing_default" },
        create: { key: "smart_routing_default", value: JSON.stringify(validated.policy) },
        update: { value: JSON.stringify(validated.policy) },
      });
      await writeAudit({
        userId: user?.id,
        action: "Updated smart routing system policy",
        category: "ADMIN",
        detail: { valid: validated.valid, errors: validated.errors },
      });
    }

    if (policyId && body.dbPolicy) {
      await prisma.routingPolicy.update({
        where: { id: policyId },
        data: {
          strategy: body.dbPolicy.strategy,
          allowedProviders: body.dbPolicy.allowedProviders ?? [],
          blockedProviders: body.dbPolicy.blockedProviders ?? [],
          requiredRegion: body.dbPolicy.requiredRegion,
          maximumLatencyMs: body.dbPolicy.maximumLatencyMs,
          maximumCostPerRequest: body.dbPolicy.maximumCostPerRequest,
          fallbackEnabled: body.dbPolicy.fallbackEnabled,
          maxRetries: body.dbPolicy.maxFallbackAttempts ?? body.dbPolicy.maxRetries,
        },
      });
    }

    if (organizationId && body.apiKeyPolicy && body.apiKeyId) {
      const key = await prisma.apiKey.findUnique({ where: { id: body.apiKeyId } });
      if (key) {
        const meta = (key.metadata && typeof key.metadata === "object" ? key.metadata : {}) as Record<string, unknown>;
        await prisma.apiKey.update({
          where: { id: body.apiKeyId },
          data: {
            metadata: { ...meta, routingPolicy: validateRoutingPolicy(body.apiKeyPolicy).policy },
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
