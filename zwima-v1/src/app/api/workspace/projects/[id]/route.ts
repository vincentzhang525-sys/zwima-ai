import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { projectRepository } from "@/lib/workspace/project-repository";
import { updateProjectSchema, parseBody } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspaceContext();
    const { id } = await params;
    const body = parseBody(updateProjectSchema, await req.json());
    const project = await projectRepository.update(ctx.organizationId, id, body);
    await writeAudit({
      userId: ctx.user.id,
      action: "Updated workspace project",
      category: "TEAM",
      detail: { projectId: id, organizationId: ctx.organizationId },
    });
    return NextResponse.json({ project });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    if (err instanceof Error && err.message === "Project not found") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: err.message } }, { status: 404 });
    }
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
