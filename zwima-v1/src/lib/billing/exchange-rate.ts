import { prisma } from "../prisma";

const DEFAULT_RATE = 1.08;

export async function getExchangeRate(from = "EUR", to = "USD"): Promise<number> {
  if (from === to) return 1;
  const row = await prisma.exchangeRate.findUnique({
    where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
  });
  if (row) return Number(row.rate);
  return DEFAULT_RATE;
}

export async function convertAmount(amount: number, from = "EUR", to = "USD"): Promise<number> {
  const rate = await getExchangeRate(from, to);
  return amount * rate;
}

export async function upsertExchangeRate(from: string, to: string, rate: number) {
  return prisma.exchangeRate.upsert({
    where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
    create: { fromCurrency: from, toCurrency: to, rate },
    update: { rate },
  });
}

export function eurToCredits(amountEur: number, creditsPerEuro = 1000): number {
  return Math.round(amountEur * creditsPerEuro);
}

export function creditsToEur(credits: number, creditsPerEuro = 1000): number {
  return credits / creditsPerEuro;
}
