import { describe, expect, it } from "vitest";
import {
  maxSuccessfulDebits,
  simulateConcurrentAtomicDebits,
} from "@/lib/billing/atomic-debit";

describe("atomic debit concurrency model (GAP-004)", () => {
  it("never overdrafts when many attempts compete for limited credits", () => {
    const starting = 100;
    const cost = 7;
    const attempts = 500;
    const result = simulateConcurrentAtomicDebits({
      startingAvailable: starting,
      cost,
      attempts,
    });

    expect(result.overdraft).toBe(false);
    expect(result.finalBalance).toBeGreaterThanOrEqual(0);
    expect(result.successes).toBe(maxSuccessfulDebits(starting, cost));
    expect(result.finalBalance).toBe(starting - result.successes * cost);
  });

  it("exact boundary: available == N * cost yields exactly N successes", () => {
    const result = simulateConcurrentAtomicDebits({
      startingAvailable: 50,
      cost: 10,
      attempts: 20,
    });
    expect(result.successes).toBe(5);
    expect(result.finalBalance).toBe(0);
    expect(result.overdraft).toBe(false);
  });

  it("zero available yields zero successes", () => {
    const result = simulateConcurrentAtomicDebits({
      startingAvailable: 0,
      cost: 1,
      attempts: 100,
    });
    expect(result.successes).toBe(0);
    expect(result.finalBalance).toBe(0);
  });
});
