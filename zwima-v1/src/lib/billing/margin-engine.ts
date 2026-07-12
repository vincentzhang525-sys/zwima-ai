import { prisma } from "../prisma";
import type { MarginScope, UserTier } from "@prisma/client";

export type MarginContext = {
  providerSlug?: string;
  modelId?: string;
  userId?: string;
  userTier?: UserTier;
};

const DEFAULT_MULTIPLIER = 1.3;

export async function getEffectiveMultiplier(ctx: MarginContext = {}): Promise<number> {
  const rules = await prisma.marginRule.findMany({ where: { enabled: true } });
  let multiplier = DEFAULT_MULTIPLIER;

  const global = rules.find((r) => r.scope === "GLOBAL");
  if (global) multiplier = Number(global.multiplier);

  if (ctx.providerSlug) {
    const provider = rules.find((r) => r.scope === "PROVIDER" && r.targetId === ctx.providerSlug);
    if (provider) multiplier = Number(provider.multiplier);
  }

  if (ctx.modelId) {
    const model = rules.find(
      (r) => r.scope === "MODEL" && r.targetId === `${ctx.providerSlug}:${ctx.modelId}`
    );
    if (model) multiplier = Number(model.multiplier);
  }

  if (ctx.userTier === "ENTERPRISE") {
    const ent = rules.find((r) => r.scope === "ENTERPRISE");
    if (ent) multiplier = Number(ent.multiplier);
  } else if (ctx.userTier === "VIP") {
    const vip = rules.find((r) => r.scope === "VIP");
    if (vip) multiplier = Number(vip.multiplier);
  }

  if (ctx.userId) {
    const custom = rules.find((r) => r.scope === "CUSTOM" && r.targetId === ctx.userId);
    if (custom) multiplier = Number(custom.multiplier);
  }

  return multiplier;
}

export function applyMargin(providerCost: number, multiplier: number): number {
  return providerCost * multiplier;
}

export async function listMarginRules() {
  return prisma.marginRule.findMany({ orderBy: [{ scope: "asc" }, { updatedAt: "desc" }] });
}

export async function upsertMarginRule(data: {
  scope: MarginScope;
  targetId?: string | null;
  multiplier: number;
  label?: string;
}) {
  const existing = await prisma.marginRule.findFirst({
    where: { scope: data.scope, targetId: data.targetId ?? null },
  });
  if (existing) {
    return prisma.marginRule.update({
      where: { id: existing.id },
      data: { multiplier: data.multiplier, label: data.label, enabled: true },
    });
  }
  return prisma.marginRule.create({
    data: {
      scope: data.scope,
      targetId: data.targetId ?? null,
      multiplier: data.multiplier,
      label: data.label,
    },
  });
}
