import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { settingsService } from "@/lib/workspace/settings-service";
import { settingsPatchSchema, parseBody } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    const settings = await settingsService.get(ctx.organizationId, ctx.user.id);
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const body = parseBody(settingsPatchSchema, await req.json());
    const settings = await settingsService.update(ctx.organizationId, body as Partial<import("@/lib/workspace/settings-service").WorkspaceSettings>);
    await writeAudit({
      userId: ctx.user.id,
      action: "Updated workspace settings",
      category: "TEAM",
      detail: { organizationId: ctx.organizationId },
    });
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
