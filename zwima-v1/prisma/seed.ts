import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROVIDERS = [
  { slug: "openai", name: "OpenAI" },
  { slug: "gemini", name: "Gemini" },
  { slug: "deepseek", name: "DeepSeek" },
  { slug: "qwen", name: "Qwen" },
  { slug: "claude", name: "Claude" },
];

const MODELS: { providerSlug: string; modelId: string; inCost: number; outCost: number }[] = [
  { providerSlug: "gemini", modelId: "gemini-2.5-pro", inCost: 2, outCost: 8 },
  { providerSlug: "gemini", modelId: "gemini-2.5-flash", inCost: 0.5, outCost: 1.5 },
  { providerSlug: "gemini", modelId: "gemini-2.5-flash-lite", inCost: 0.2, outCost: 0.6 },
  { providerSlug: "openai", modelId: "gpt-5", inCost: 5, outCost: 15 },
  { providerSlug: "openai", modelId: "gpt-5-mini", inCost: 1, outCost: 4 },
  { providerSlug: "openai", modelId: "gpt-5-nano", inCost: 0.3, outCost: 1 },
  { providerSlug: "deepseek", modelId: "deepseek-chat", inCost: 0.4, outCost: 1.2 },
  { providerSlug: "deepseek", modelId: "deepseek-reasoner", inCost: 1, outCost: 3 },
  { providerSlug: "qwen", modelId: "qwen-turbo", inCost: 0.3, outCost: 0.6 },
  { providerSlug: "qwen", modelId: "qwen-plus", inCost: 0.8, outCost: 2 },
  { providerSlug: "qwen", modelId: "qwen-max", inCost: 2, outCost: 6 },
  { providerSlug: "claude", modelId: "claude-sonnet", inCost: 1.5, outCost: 5 },
  { providerSlug: "claude", modelId: "claude-opus", inCost: 4, outCost: 12 },
];

const PACKAGES = [
  { label: "€10", amountEur: 10, credits: 10000, sortOrder: 1 },
  { label: "€25", amountEur: 25, credits: 26000, sortOrder: 2 },
  { label: "€50", amountEur: 50, credits: 55000, sortOrder: 3 },
  { label: "€100", amountEur: 100, credits: 115000, sortOrder: 4 },
  { label: "€250", amountEur: 250, credits: 300000, sortOrder: 5 },
  { label: "€500", amountEur: 500, credits: 620000, sortOrder: 6 },
  { label: "€1000", amountEur: 1000, credits: 1300000, sortOrder: 7 },
];

const MARGINS = [
  { scope: "GLOBAL" as const, multiplier: 1.3, label: "Global default" },
  { scope: "ENTERPRISE" as const, multiplier: 1.15, label: "Enterprise discount" },
  { scope: "VIP" as const, multiplier: 1.2, label: "VIP discount" },
];

async function main() {
  for (const p of PROVIDERS) {
    await prisma.provider.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, name: p.name, enabled: true },
      update: { name: p.name },
    });
  }

  for (const m of MODELS) {
    const marginPct = 30;
    const mult = 1 + marginPct / 100;
    await prisma.modelPricing.upsert({
      where: { providerSlug_modelId: { providerSlug: m.providerSlug, modelId: m.modelId } },
      create: {
        providerSlug: m.providerSlug,
        modelId: m.modelId,
        inputTokenCost: m.inCost,
        outputTokenCost: m.outCost,
        marginPercent: marginPct,
        customerPriceIn: m.inCost * mult,
        customerPriceOut: m.outCost * mult,
      },
      update: {
        inputTokenCost: m.inCost,
        outputTokenCost: m.outCost,
        customerPriceIn: m.inCost * mult,
        customerPriceOut: m.outCost * mult,
      },
    });
  }

  for (const pkg of PACKAGES) {
    const existing = await prisma.creditPackage.findFirst({ where: { label: pkg.label } });
    if (existing) {
      await prisma.creditPackage.update({
        where: { id: existing.id },
        data: { amountEur: pkg.amountEur, credits: pkg.credits, sortOrder: pkg.sortOrder, enabled: true },
      });
    } else {
      await prisma.creditPackage.create({ data: pkg });
    }
  }

  for (const m of MARGINS) {
    const existing = await prisma.marginRule.findFirst({ where: { scope: m.scope, targetId: null } });
    if (existing) {
      await prisma.marginRule.update({ where: { id: existing.id }, data: { multiplier: m.multiplier } });
    } else {
      await prisma.marginRule.create({ data: { scope: m.scope, multiplier: m.multiplier, label: m.label } });
    }
  }

  await prisma.exchangeRate.upsert({
    where: { fromCurrency_toCurrency: { fromCurrency: "EUR", toCurrency: "USD" } },
    create: { fromCurrency: "EUR", toCurrency: "USD", rate: 1.08 },
    update: { rate: 1.08 },
  });

  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    create: { code: "WELCOME10", discountPct: 10, maxUsage: 1000, enabled: true },
    update: { enabled: true },
  });

  console.log("Seeded providers, pricing, packages, margins, exchange rate, coupon");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
