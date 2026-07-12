import { prisma } from "../prisma";
import type { User } from "@prisma/client";

const VAT_RATES: Record<string, number> = {
  DE: 0.19,
  AT: 0.2,
  FR: 0.2,
  NL: 0.21,
  DEFAULT: 0.19,
};

function vatRate(country?: string | null): number {
  if (!country) return VAT_RATES.DEFAULT;
  return VAT_RATES[country.toUpperCase()] ?? VAT_RATES.DEFAULT;
}

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ZW-${year}-`;
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
  });
  const seq = last ? Number(last.invoiceNumber.replace(prefix, "")) + 1 : 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPriceEur: number;
  totalEur: number;
};

export async function createInvoice(params: {
  user: Pick<User, "id" | "companyName" | "country" | "vatId" | "email">;
  lineItems: InvoiceLineItem[];
  paid?: boolean;
}) {
  const subtotalEur = params.lineItems.reduce((s, i) => s + i.totalEur, 0);
  const taxEur = subtotalEur * vatRate(params.user.country);
  const totalEur = subtotalEur + taxEur;

  return prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      userId: params.user.id,
      companyName: params.user.companyName ?? params.user.email,
      country: params.user.country,
      vatId: params.user.vatId,
      subtotalEur,
      taxEur,
      totalEur,
      paid: params.paid ?? false,
      lineItems: params.lineItems,
    },
  });
}

export async function markInvoicePaid(invoiceId: string) {
  return prisma.invoice.update({ where: { id: invoiceId }, data: { paid: true } });
}

export async function getUserInvoices(userId: string, limit = 50) {
  return prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function renderInvoiceHtml(invoice: {
  invoiceNumber: string;
  companyName: string | null;
  country: string | null;
  vatId: string | null;
  subtotalEur: unknown;
  taxEur: unknown;
  totalEur: unknown;
  paid: boolean;
  lineItems: unknown;
  createdAt: Date;
}): string {
  const items = (invoice.lineItems as InvoiceLineItem[] | null) ?? [];
  const rows = items
    .map(
      (i) =>
        `<tr><td>${i.description}</td><td>${i.quantity}</td><td>€${i.unitPriceEur.toFixed(2)}</td><td>€${i.totalEur.toFixed(2)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${invoice.invoiceNumber}</title>
<style>body{font-family:sans-serif;max-width:720px;margin:40px auto;color:#0f172a}
table{width:100%;border-collapse:collapse;margin:24px 0}td,th{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}
.total{font-size:1.25rem;font-weight:bold}</style></head>
<body>
<h1>ZWIMA AI Invoice</h1>
<p><strong>${invoice.invoiceNumber}</strong> · ${invoice.createdAt.toISOString().slice(0, 10)}</p>
<p>${invoice.companyName ?? ""}<br>${invoice.country ?? ""}<br>VAT: ${invoice.vatId ?? "—"}</p>
<table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
<tbody>${rows}</tbody></table>
<p>Subtotal: €${Number(invoice.subtotalEur).toFixed(2)}</p>
<p>Tax: €${Number(invoice.taxEur).toFixed(2)}</p>
<p class="total">Total: €${Number(invoice.totalEur).toFixed(2)} · ${invoice.paid ? "PAID" : "UNPAID"}</p>
<p style="color:#64748b;font-size:12px">Zwima Technologie GmbH · zwima-group.info</p>
</body></html>`;
}

/** Minimal PDF bytes via HTML content-type fallback — full PDF lib optional. */
export function renderInvoicePdfBuffer(html: string): Buffer {
  return Buffer.from(html, "utf-8");
}
