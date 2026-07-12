import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { BillingEngine, renderInvoiceHtml } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireDbUser();
    const invoices = await BillingEngine.invoice.list(user.id);
    return NextResponse.json({ invoices });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const { invoiceId, format } = await req.json();
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId: user.id } });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const html = renderInvoiceHtml(invoice);
    if (format === "pdf") {
      return new NextResponse(html, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        },
      });
    }
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
