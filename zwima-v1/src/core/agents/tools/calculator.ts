/**
 * calculator — thin Phase 1 wrapper around the existing, already-safe
 * `src/lib/agents/mock-tools.ts#calculatorTool` (no eval/Function, local
 * recursive-descent parser). Reused rather than reimplemented.
 */

import { calculatorTool } from "@/lib/agents/mock-tools";
import type { ToolDescriptor, ToolExecutionContext, ToolInput } from "./tool-types";

export async function runCalculator(input: ToolInput, _context: ToolExecutionContext) {
  return calculatorTool(input);
}

export const calculatorToolDescriptor: ToolDescriptor = {
  key: "calculator",
  name: "Calculator",
  description: "Evaluates basic arithmetic expressions (+ - * / and parentheses). Local, deterministic, no network.",
  handler: runCalculator,
};
