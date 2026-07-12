import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { searchAuditLogs } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const q = new URL(req.url).searchParams.get("q")?.trim() || "";
    const type = new URL(req.url).searchParams.get("type") || "all";

    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const results: { type: string; id: string; label: string; sub: string }[] = [];

    if (type === "all" || type === "customers") {
      const users = await prisma.user.findMany({
        where: { OR: [{ email: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }] },
        take: 20,
      });
      for (const u of users) results.push({ type: "customer", id: u.id, label: u.email, sub: u.companyName ?? "" });
    }

    if (type === "all" || type === "organizations") {
      const orgs = await prisma.organization.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 20,
      });
      for (const o of orgs) results.push({ type: "organization", id: o.id, label: o.name, sub: o.id });
    }

    if (type === "all" || type === "api-keys") {
      const keys = await prisma.apiKey.findMany({
        where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { prefix: { contains: q, mode: "insensitive" } }] },
        take: 20,
        include: { user: { select: { email: true } } },
      });
      for (const k of keys) results.push({ type: "api-key", id: k.id, label: k.name, sub: k.user.email });
    }

    if (type === "all" || type === "transactions") {
      const txs = await prisma.transaction.findMany({
        where: { description: { contains: q, mode: "insensitive" } },
        take: 20,
        include: { user: { select: { email: true } } },
      });
      for (const t of txs) results.push({ type: "transaction", id: t.id, label: t.type, sub: t.user.email });
    }

    if (type === "all" || type === "invoices") {
      const invs = await prisma.invoice.findMany({
        where: { invoiceNumber: { contains: q, mode: "insensitive" } },
        take: 20,
      });
      for (const i of invs) results.push({ type: "invoice", id: i.id, label: i.invoiceNumber, sub: `€${i.totalEur}` });
    }

    if (type === "all" || type === "subscriptions") {
      const subs = await prisma.subscription.findMany({
        where: { plan: { equals: q.toUpperCase() as "MONTHLY" } },
        take: 20,
        include: { user: { select: { email: true } } },
      });
      for (const s of subs) results.push({ type: "subscription", id: s.id, label: s.plan, sub: s.user.email });
    }

    if (type === "all" || type === "coupons") {
      const coupons = await prisma.coupon.findMany({
        where: { code: { contains: q, mode: "insensitive" } },
        take: 20,
      });
      for (const c of coupons) results.push({ type: "coupon", id: c.id, label: c.code, sub: `${c.discountPct}% off` });
    }

    if (type === "all" || type === "providers") {
      const providers = await prisma.provider.findMany({
        where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] },
        take: 20,
      });
      for (const p of providers) results.push({ type: "provider", id: p.id, label: p.name, sub: p.slug });
    }

    if (type === "all" || type === "pricing") {
      const pricing = await prisma.modelPricing.findMany({
        where: { OR: [{ modelId: { contains: q, mode: "insensitive" } }, { providerSlug: { contains: q, mode: "insensitive" } }] },
        take: 20,
      });
      for (const p of pricing) results.push({ type: "pricing", id: p.id, label: p.modelId, sub: p.providerSlug });
    }

    if (type === "all" || type === "margins") {
      const margins = await prisma.marginRule.findMany({
        where: { label: { contains: q, mode: "insensitive" } },
        take: 20,
      });
      for (const m of margins) results.push({ type: "margin", id: m.id, label: m.label ?? m.scope, sub: String(m.multiplier) });
    }

    if (type === "all" || type === "audit") {
      const logs = await searchAuditLogs(q, 20);
      for (const l of logs) results.push({ type: "audit", id: l.id, label: l.action, sub: l.user?.email ?? "system" });
    }

    return NextResponse.json({ results: results.slice(0, 50) });
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { section } = await req.json();

    const data: Record<string, unknown> = {};

    if (section === "customers" || section === "all") {
      data.customers = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { creditBalance: true, _count: { select: { apiKeys: true, usageLogs: true } } },
      });
    }
    if (section === "organizations" || section === "all") {
      data.organizations = await prisma.organization.findMany({
        take: 50,
        include: { owner: { select: { email: true } }, _count: { select: { members: true } } },
      });
    }
    if (section === "api-keys" || section === "all") {
      data.apiKeys = await prisma.apiKey.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true } } },
      });
    }
    if (section === "transactions" || section === "all") {
      data.transactions = await prisma.transaction.findMany({ take: 50, orderBy: { createdAt: "desc" }, include: { user: { select: { email: true } } } });
    }
    if (section === "invoices" || section === "all") {
      data.invoices = await prisma.invoice.findMany({ take: 50, orderBy: { createdAt: "desc" }, include: { user: { select: { email: true } } } });
    }
    if (section === "subscriptions" || section === "all") {
      data.subscriptions = await prisma.subscription.findMany({ take: 50, include: { user: { select: { email: true } } } });
    }
    if (section === "coupons" || section === "all") {
      data.coupons = await prisma.coupon.findMany({ take: 50 });
    }
    if (section === "providers" || section === "all") {
      data.providers = await prisma.provider.findMany();
    }
    if (section === "pricing" || section === "all") {
      data.pricing = await prisma.modelPricing.findMany({ take: 100 });
    }
    if (section === "margins" || section === "all") {
      data.margins = await prisma.marginRule.findMany();
    }
    if (section === "audit" || section === "all") {
      data.audit = await prisma.auditLog.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true } } },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }
}
