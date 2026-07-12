import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCredits(credits: number): string {
  return new Intl.NumberFormat("en-EU").format(credits);
}

export function formatCost(credits: number): string {
  return `€${(credits / 1000).toFixed(4)}`;
}
