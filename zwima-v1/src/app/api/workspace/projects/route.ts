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
    const enriched = await Promise.all(
      projects.map(async (project) => {
        const projectKeyIds = keys
          .filter((k) => parseApiKeyMetadata(k.metadata).projectId === project.id)
          .map((k) => k.id);
        const usage = projectKeyIds.length
          ? await prisma.usageLog.aggregate({
              where: { ...usageWhere, apiKeyId: { in: projectKeyIds } },
              _sum: { costCredits: true },
              _count: { id: true },
            })
          : { _sum: { costCredits: 0 }, _count: { id: 0 } };

        return {
          ...project,
          apiKeyCount: projectKeyIds.length,
          usageRequests: usage._count.id,
          usageCostCredits: usage._sum.costCredits ?? 0,
          usageCostEur: creditsToEur(usage._sum.costCredits ?? 0),
        };
      })
    );

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
