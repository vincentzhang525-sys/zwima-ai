/**
 * current_datetime — returns the current local server Date/time. No network
 * access, no arguments required. Deterministic in the sense that it always
 * reflects wall-clock time (tests should treat its output as opaque/only
 * check shape, not exact value).
 */

import type { ToolDescriptor, ToolExecutionContext, ToolInput, ToolOutput } from "./tool-types";

export async function currentDatetimeTool(_input: ToolInput, _context: ToolExecutionContext): Promise<ToolOutput> {
  const now = new Date();
  return {
    iso: now.toISOString(),
    unixMs: now.getTime(),
    timezoneOffsetMinutes: now.getTimezoneOffset(),
    parts: {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
    },
    source: "local-clock",
  };
}

export const currentDatetimeToolDescriptor: ToolDescriptor = {
  key: "current_datetime",
  name: "Current Date/Time",
  description: "Returns the current local server date/time. No network access, no arguments required.",
  handler: currentDatetimeTool,
};
