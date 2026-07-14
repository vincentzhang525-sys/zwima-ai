import { describe, expect, it } from "vitest";
import { daysFromNow, endOfMonth, startOfDay, startOfMonth } from "../admin/ops-dashboard-service";

describe("Ops dashboard date helpers", () => {
  it("startOfDay zeroes time", () => {
    const d = startOfDay(new Date("2026-07-14T15:30:00Z"));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("startOfMonth returns first of month", () => {
    const d = startOfMonth(new Date("2026-07-14"));
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(6);
  });

  it("endOfMonth is last day of month", () => {
    const d = endOfMonth(new Date("2026-07-14"));
    expect(d.getDate()).toBe(31);
    expect(d.getMonth()).toBe(6);
  });

  it("daysFromNow offsets correctly", () => {
    const d = daysFromNow(7);
    const diff = Math.round((d.getTime() - Date.now()) / 86400000);
    expect(diff).toBe(7);
  });
});
