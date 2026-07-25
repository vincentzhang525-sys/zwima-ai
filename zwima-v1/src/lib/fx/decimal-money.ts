/**
 * M4 FX — Decimal money helpers.
 * Never use JavaScript number floats for money arithmetic.
 */
import { Decimal } from "@prisma/client/runtime/library";

export type DecimalInput = Decimal | string | number;

export function D(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(String(value));
}

export function dAdd(a: DecimalInput, b: DecimalInput): Decimal {
  return D(a).add(D(b));
}

export function dSub(a: DecimalInput, b: DecimalInput): Decimal {
  return D(a).sub(D(b));
}

export function dMul(a: DecimalInput, b: DecimalInput): Decimal {
  return D(a).mul(D(b));
}

export function dDiv(a: DecimalInput, b: DecimalInput): Decimal {
  const denom = D(b);
  if (denom.isZero()) {
    throw new Error("DECIMAL_DIVIDE_BY_ZERO");
  }
  return D(a).div(denom);
}

export function dCmp(a: DecimalInput, b: DecimalInput): number {
  return D(a).comparedTo(D(b));
}

export function dAbs(a: DecimalInput): Decimal {
  return D(a).abs();
}

export function dIsZero(a: DecimalInput): boolean {
  return D(a).isZero();
}

/** Safe rate: null when revenue is zero (never divide by zero). */
export function safeMarginRate(margin: DecimalInput, revenue: DecimalInput): Decimal | null {
  if (dIsZero(revenue)) return null;
  return dDiv(margin, revenue);
}

export function toMoneyString(value: Decimal, places = 8): string {
  return value.toFixed(places);
}

export function pctChange(from: DecimalInput, to: DecimalInput): Decimal | null {
  if (dIsZero(from)) return null;
  return dDiv(dSub(to, from), from).abs();
}
