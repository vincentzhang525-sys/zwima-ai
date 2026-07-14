import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "../api-errors";
import { requireWorkspaceContext, type WorkspaceContext } from "./workspace-context";

export { errorResponse };

export function validationError(message: string) {
  return NextResponse.json(
    { error: { code: "VALIDATION_ERROR", message } },
    { status: 400 }
  );
}

export async function withWorkspace(
  handler: (ctx: WorkspaceContext, req: Request) => Promise<Response>
): Promise<(req: Request) => Promise<Response>> {
  return async (req: Request) => {
    try {
      const ctx = await requireWorkspaceContext();
      return await handler(ctx, req);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      if (err instanceof Error) {
        if (err.message === "Unauthorized") {
          return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
        }
        if (err.message === "FORBIDDEN" || err.message.includes("Cross-organization")) {
          return NextResponse.json({ error: { code: "FORBIDDEN", message: "Access denied." } }, { status: 403 });
        }
        if (err.message === "Not found" || err.message === "Project not found") {
          return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: err.message } }, { status: 404 });
        }
        if (err.message.includes("Validation") || err.message.includes("required")) {
          return validationError(err.message);
        }
      }
      return errorResponse(err instanceof Error ? err : new Error("Request failed"));
    }
  };
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export function creditsToEur(credits: number): number {
  return Math.round((credits / 1000) * 10000) / 10000;
}

export function formatEur(credits: number): string {
  return `€${creditsToEur(credits).toFixed(4)}`;
}
