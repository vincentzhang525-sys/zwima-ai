import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { projectRepository } from "@/lib/workspace/project-repository";
import { createProjectSchema, parseBody } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";
import { buildOrgUsageWhere } from "@/lib/workspace/isolation";
import { prisma } from "@/lib/prisma";
import { parseApiKeyMetadata } from "@/lib/workspace/project-repository";
import { creditsToEur } from "@/lib/workspace/http";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    await projectRepository.ensureDefault(ctx.organizationId);
    const projects = await projectRepository.list(ctx.organizationId);

    const keys = await prisma.apiKey.findMany({
      where: { organizationId: ctx.organizationId, name: { not: "__playground__" } },
      select: { id: true, metadata: true, usageCount: true, currentMonthUsage: true },
    });

    const usageWhere = await buildOrgUsageWhere(ctx.organizationId);
    const keyIds = keys.map((k) => k.id);
    const usageRows = keyIds.length
      ? await prisma.usageLog.groupBy({
          by: ["apiKeyId"],
          where: { ...usageWhere, apiKeyId: { in: keyIds } },
          _sum: { costCredits: true },
          _count: { id: true },
        })
      : [];
    const usageByKeyId = new Map(
      usageRows.map((row) => [
        row.apiKeyId,
        { costCredits: row._sum.costCredits ?? 0, requests: row._count.id },
      ]),
    );

    const enriched = projects.map((project) => {
      const projectKeyIds = keys
        .filter((k) => parseApiKeyMetadata(k.metadata).projectId === project.id)
        .map((k) => k.id);
      let usageRequests = 0;
      let usageCostCredits = 0;
      for (const keyId of projectKeyIds) {
        const usage = usageByKeyId.get(keyId);
        if (!usage) continue;
        usageRequests += usage.requests;
        usageCostCredits += usage.costCredits;
      }

      return {
        ...project,
        apiKeyCount: projectKeyIds.length,
        usageRequests,
        usageCostCredits,
        usageCostEur: creditsToEur(usageCostCredits),
      };
    });

    return NextResponse.json({ projects: enriched });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const body = parseBody(createProjectSchema, await req.json());
    const project = await projectRepository.create(ctx.organizationId, body);
    await writeAudit({
      userId: ctx.user.id,
      action: "Created workspace project",
      category: "TEAM",
      detail: { projectId: project.id, organizationId: ctx.organizationId },
    });
    return NextResponse.json({ project });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
