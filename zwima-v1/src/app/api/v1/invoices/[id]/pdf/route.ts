import { renderInvoiceHtml } from "@/lib/billing";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({ where: { id, userId: user.id } });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const html = renderInvoiceHtml(invoice);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
