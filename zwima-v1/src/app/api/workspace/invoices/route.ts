import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { getWorkspaceInvoices, getWorkspaceInvoiceDetail } from "@/lib/workspace/billing-service";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const invoiceId = new URL(req.url).searchParams.get("id");
    if (invoiceId) {
      const invoice = await getWorkspaceInvoiceDetail(ctx.user.id, invoiceId);
      if (!invoice) {
        return NextResponse.json({ error: { code: "FORBIDDEN", message: "Not found" } }, { status: 404 });
      }
      return NextResponse.json({ invoice });
    }
    const invoices = await getWorkspaceInvoices(ctx.user.id);
    return NextResponse.json({ invoices });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
