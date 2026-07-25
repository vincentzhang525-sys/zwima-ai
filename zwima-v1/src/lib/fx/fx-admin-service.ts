/**
 * M4 FX — admin read models (no secrets). Works with or without DB rows.
 */
import { prisma } from "@/lib/prisma";
import { DEFAULT_FX_BUFFER_RATES } from "./types";
import { systemDefaultBufferRate } from "./fx-buffer-policy";

function serializeDecimal(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

export async function listFxRatesAdmin(params: {
  page?: number;
  pageSize?: number;
  currency?: string;
  status?: string;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const where: Record<string, unknown> = {};
  if (params.currency) {
    where.baseCurrency = params.currency.toUpperCase();
  }
  if (params.status) {
    where.status = params.status;
  }

  try {
    const [total, rows] = await Promise.all([
      prisma.fxRateSnapshot.count({ where }),
      prisma.fxRateSnapshot.findMany({
        where,
        orderBy: { effectiveAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      page,
      pageSize,
      total,
      items: rows.map((r) => ({
        id: r.id,
        baseCurrency: r.baseCurrency,
        quoteCurrency: r.quoteCurrency,
        rate: serializeDecimal(r.rate),
        source: r.source,
        effectiveAt: r.effectiveAt.toISOString(),
        rateDate: r.rateDate.toISOString(),
        fetchedAt: r.fetchedAt.toISOString(),
        status: r.status,
        isFallback: r.isFallback,
        pair: `${r.baseCurrency}/${r.quoteCurrency}`,
      })),
    };
  } catch {
    return { page, pageSize, total: 0, items: [], note: "FX tables not migrated yet" };
  }
}

export async function listFxPoliciesAdmin() {
  try {
    const rows = await prisma.fxBufferPolicy.findMany({
      where: { enabled: true },
      orderBy: { updatedAt: "desc" },
      include: { provider: { select: { id: true, slug: true, name: true, providerCurrency: true } } },
    });
    return {
      defaults: DEFAULT_FX_BUFFER_RATES,
      items: rows.map((r) => ({
        id: r.id,
        providerId: r.providerId,
        providerSlug: r.provider?.slug ?? null,
        currency: r.currency,
        bufferRate: serializeDecimal(r.bufferRate),
        minimumBufferRate: serializeDecimal(r.minimumBufferRate),
        maximumBufferRate: serializeDecimal(r.maximumBufferRate),
        lookbackDays: r.lookbackDays,
        volatilityBased: r.volatilityBased,
        enabled: r.enabled,
        effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
        effectiveTo: r.effectiveTo?.toISOString() ?? null,
        label: r.label,
      })),
    };
  } catch {
    return {
      defaults: DEFAULT_FX_BUFFER_RATES,
      items: Object.entries(DEFAULT_FX_BUFFER_RATES).map(([currency, bufferRate]) => ({
        id: `default-${currency}`,
        providerId: null,
        providerSlug: null,
        currency: currency === "DEFAULT" ? null : currency,
        bufferRate,
        minimumBufferRate: null,
        maximumBufferRate: null,
        lookbackDays: null,
        volatilityBased: false,
        enabled: true,
        effectiveFrom: null,
        effectiveTo: null,
        label: "system_default",
      })),
      note: "FX tables not migrated yet — showing system defaults",
    };
  }
}

export async function listMarginsAdmin(params: {
  page?: number;
  pageSize?: number;
  providerId?: string;
  currency?: string;
  organizationId?: string;
  fxStatus?: string;
  marginStatus?: string;
  from?: string;
  to?: string;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const where: Record<string, unknown> = {};
  if (params.providerId) where.providerId = params.providerId;
  if (params.currency) where.providerCurrency = params.currency.toUpperCase();
  if (params.organizationId) where.organizationId = params.organizationId;
  if (params.fxStatus) where.fxRateStatus = params.fxStatus;
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: new Date(params.from) } : {}),
      ...(params.to ? { lte: new Date(params.to) } : {}),
    };
  }

  try {
    const [total, rows] = await Promise.all([
      prisma.usageLog.count({ where }),
      prisma.usageLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          providerId: true,
          model: true,
          organizationId: true,
          providerCurrency: true,
          fxRateAtUsage: true,
          costInProviderCurrency: true,
          costInEur: true,
          fxBuffer: true,
          fxBufferRate: true,
          bufferedCostEur: true,
          revenueEur: true,
          grossMarginEur: true,
          grossMarginRate: true,
          fxRateStatus: true,
          fxRatePair: true,
          fxRateSource: true,
          createdAt: true,
          provider: { select: { slug: true, name: true, providerCurrency: true } },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: rows.map((r) => ({
        id: r.id,
        providerId: r.providerId,
        providerSlug: r.provider.slug,
        model: r.model,
        organizationId: r.organizationId,
        providerCurrency: r.providerCurrency ?? r.provider.providerCurrency,
        fxRateAtUsage: serializeDecimal(r.fxRateAtUsage),
        costInProviderCurrency: serializeDecimal(r.costInProviderCurrency),
        costInEur: serializeDecimal(r.costInEur),
        fxBufferRate: serializeDecimal(r.fxBufferRate),
        fxBuffer: serializeDecimal(r.fxBuffer),
        bufferedCostEur: serializeDecimal(r.bufferedCostEur),
        revenueEur: serializeDecimal(r.revenueEur),
        grossMarginEur: serializeDecimal(r.grossMarginEur),
        grossMarginRate: serializeDecimal(r.grossMarginRate),
        fxRateStatus: r.fxRateStatus,
        fxRatePair: r.fxRatePair,
        fxRateSource: r.fxRateSource,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch {
    return { page, pageSize, total: 0, items: [], note: "FX columns/tables not migrated yet" };
  }
}

export async function listRepricingAlertsAdmin(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  acknowledged?: boolean;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.acknowledged != null) where.acknowledged = params.acknowledged;

  try {
    const [total, rows] = await Promise.all([
      prisma.fxRepricingAlert.count({ where }),
      prisma.fxRepricingAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { package: { select: { id: true, label: true, amountEur: true } } },
      }),
    ]);
    return {
      page,
      pageSize,
      total,
      autoPriceChange: false,
      items: rows.map((r) => ({
        id: r.id,
        packageId: r.packageId,
        packageLabel: r.package?.label ?? null,
        packageAmountEur: serializeDecimal(r.package?.amountEur),
        providerId: r.providerId,
        status: r.status,
        alertCode: r.alertCode,
        message: r.message,
        fxChangePct: serializeDecimal(r.fxChangePct),
        currentMarginRate: serializeDecimal(r.currentMarginRate),
        pricingFxRate: serializeDecimal(r.pricingFxRate),
        currentFxRate: serializeDecimal(r.currentFxRate),
        suggestedAction: r.suggestedAction,
        acknowledged: r.acknowledged,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch {
    return {
      page,
      pageSize,
      total: 0,
      autoPriceChange: false,
      items: [],
      note: "FX tables not migrated yet",
    };
  }
}

export async function listProviderCurrencyOverview() {
  try {
    const providers = await prisma.provider.findMany({
      where: { enabled: true },
      select: { id: true, slug: true, name: true, providerCurrency: true },
      orderBy: { slug: "asc" },
    });
    return providers.map((p) => ({
      providerId: p.id,
      slug: p.slug,
      name: p.name,
      providerCurrency: p.providerCurrency,
      defaultBufferRate: systemDefaultBufferRate(p.providerCurrency).toFixed(6),
    }));
  } catch {
    return [];
  }
}

export async function auditAdminFxAccess(userEmail: string | null | undefined, action: string, detail?: object) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        category: "ADMIN",
        detail: {
          module: "m4_fx_cost_control",
          actorEmail: userEmail ?? null,
          ...detail,
        },
      },
    });
  } catch {
    // audit best-effort
  }
}
