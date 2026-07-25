import { createHash } from "crypto";
import { AgentServiceError } from "./errors";

/**
 * M8 Agent Platform — Mock tool runtime.
 *
 * All tools here are synthetic/local: no network requests, no filesystem
 * access, and `email-draft-mock` never sends anything — it only returns
 * draft text. These are the only tool handlers the mock execution engine
 * may invoke.
 */

export type MockToolInput = Record<string, unknown>;
export type MockToolOutput = Record<string, unknown>;

export type MockToolHandler = (input: MockToolInput) => Promise<MockToolOutput>;

// ---------------------------------------------------------------------------
// calculator — safe arithmetic evaluator (no eval/Function)
// ---------------------------------------------------------------------------

class CalculatorSyntaxError extends Error {}

/** Tiny recursive-descent parser for `+ - * / ( )` and decimal numbers — deliberately avoids eval()/Function(). */
function evaluateArithmeticExpression(expression: string): number {
  const src = expression.trim();
  if (!src) throw new CalculatorSyntaxError("Empty expression");
  if (!/^[0-9+\-*/().\s]+$/.test(src)) {
    throw new CalculatorSyntaxError("Expression contains unsupported characters");
  }

  let pos = 0;

  function peek(): string | undefined {
    return src[pos];
  }
  function skipSpace() {
    while (pos < src.length && /\s/.test(src[pos])) pos += 1;
  }
  function parseNumber(): number {
    skipSpace();
    const start = pos;
    if (peek() === "-") pos += 1;
    let sawDigit = false;
    while (pos < src.length && /[0-9]/.test(src[pos])) {
      pos += 1;
      sawDigit = true;
    }
    if (peek() === ".") {
      pos += 1;
      while (pos < src.length && /[0-9]/.test(src[pos])) {
        pos += 1;
        sawDigit = true;
      }
    }
    if (!sawDigit) throw new CalculatorSyntaxError(`Expected number at position ${start}`);
    return Number(src.slice(start, pos));
  }
  function parseFactor(): number {
    skipSpace();
    if (peek() === "(") {
      pos += 1;
      const value = parseExpression();
      skipSpace();
      if (peek() !== ")") throw new CalculatorSyntaxError("Missing closing parenthesis");
      pos += 1;
      return value;
    }
    if (peek() === "-") {
      pos += 1;
      return -parseFactor();
    }
    return parseNumber();
  }
  function parseTerm(): number {
    let value = parseFactor();
    for (;;) {
      skipSpace();
      const op = peek();
      if (op === "*" || op === "/") {
        pos += 1;
        const rhs = parseFactor();
        if (op === "*") value *= rhs;
        else {
          if (rhs === 0) throw new CalculatorSyntaxError("Division by zero");
          value /= rhs;
        }
      } else {
        return value;
      }
    }
  }
  function parseExpression(): number {
    let value = parseTerm();
    for (;;) {
      skipSpace();
      const op = peek();
      if (op === "+" || op === "-") {
        pos += 1;
        const rhs = parseTerm();
        value = op === "+" ? value + rhs : value - rhs;
      } else {
        return value;
      }
    }
  }

  const result = parseExpression();
  skipSpace();
  if (pos !== src.length) throw new CalculatorSyntaxError(`Unexpected trailing input at position ${pos}`);
  if (!Number.isFinite(result)) throw new CalculatorSyntaxError("Result is not a finite number");
  return result;
}

export async function calculatorTool(input: MockToolInput): Promise<MockToolOutput> {
  const expression = String(input.expression ?? "").trim();
  if (!expression) {
    throw new AgentServiceError("VALIDATION_ERROR", "calculator tool requires an 'expression' string", 400);
  }
  try {
    const result = evaluateArithmeticExpression(expression);
    return { expression, result };
  } catch (err) {
    throw new AgentServiceError(
      "TOOL_INPUT_ERROR",
      `Invalid arithmetic expression: ${err instanceof Error ? err.message : "parse error"}`,
      400,
    );
  }
}

// ---------------------------------------------------------------------------
// web-search-mock — deterministic synthetic search results, no network
// ---------------------------------------------------------------------------

function stableSeedFrom(text: string): number {
  const hex = createHash("sha256").update(text).digest("hex").slice(0, 8);
  return parseInt(hex, 16);
}

export async function webSearchMockTool(input: MockToolInput): Promise<MockToolOutput> {
  const query = String(input.query ?? "").trim();
  if (!query) {
    throw new AgentServiceError("VALIDATION_ERROR", "web-search-mock tool requires a 'query' string", 400);
  }
  const limit = Math.min(Math.max(Number(input.limit ?? 3) || 3, 1), 10);
  const seed = stableSeedFrom(query);
  const results = Array.from({ length: limit }, (_, i) => ({
    title: `Synthetic result ${i + 1} for "${query}"`,
    url: `https://mock.search.invalid/${seed}/${i + 1}`,
    snippet: `This is a deterministic mock search snippet #${i + 1} generated locally for query "${query}". No live web request was made.`,
  }));
  return {
    query,
    results,
    disclaimer: "Mock search results — no live network call was performed.",
  };
}

// ---------------------------------------------------------------------------
// document-retrieval-mock — deterministic synthetic document chunks
// ---------------------------------------------------------------------------

export async function documentRetrievalMockTool(input: MockToolInput): Promise<MockToolOutput> {
  const query = String(input.query ?? "").trim();
  if (!query) {
    throw new AgentServiceError("VALIDATION_ERROR", "document-retrieval-mock tool requires a 'query' string", 400);
  }
  const documentId = input.documentId ? String(input.documentId) : `doc_${stableSeedFrom(query)}`;
  const chunkCount = Math.min(Math.max(Number(input.topK ?? 2) || 2, 1), 5);
  const chunks = Array.from({ length: chunkCount }, (_, i) => ({
    documentId,
    chunkId: `${documentId}_chunk_${i + 1}`,
    text: `Synthetic retrieved chunk #${i + 1} relevant to "${query}". This content is generated locally and does not come from a real document store.`,
    score: Number((0.9 - i * 0.12).toFixed(2)),
  }));
  return {
    query,
    documentId,
    chunks,
    disclaimer: "Mock document retrieval — no real document store was queried.",
  };
}

// ---------------------------------------------------------------------------
// email-draft-mock — returns a draft only, NEVER sends
// ---------------------------------------------------------------------------

export async function emailDraftMockTool(input: MockToolInput): Promise<MockToolOutput> {
  const to = String(input.to ?? "").trim();
  const subject = String(input.subject ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!to || !subject || !body) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      "email-draft-mock tool requires 'to', 'subject', and 'body'",
      400,
    );
  }
  return {
    draft: { to, subject, body },
    status: "DRAFT_ONLY",
    sent: false,
    disclaimer: "This is a draft only. No email was sent by this tool, and it never will be.",
  };
}

// ---------------------------------------------------------------------------
// Registry / dispatcher
// ---------------------------------------------------------------------------

export const MOCK_TOOL_KEYS = [
  "calculator",
  "web-search-mock",
  "document-retrieval-mock",
  "email-draft-mock",
] as const;
export type MockToolKey = (typeof MOCK_TOOL_KEYS)[number];

export const MOCK_TOOL_HANDLERS: Record<MockToolKey, MockToolHandler> = {
  calculator: calculatorTool,
  "web-search-mock": webSearchMockTool,
  "document-retrieval-mock": documentRetrievalMockTool,
  "email-draft-mock": emailDraftMockTool,
};

export function isMockToolKey(value: string): value is MockToolKey {
  return (MOCK_TOOL_KEYS as readonly string[]).includes(value);
}

export async function runMockTool(handlerKey: string, input: MockToolInput): Promise<MockToolOutput> {
  if (!isMockToolKey(handlerKey)) {
    throw new AgentServiceError("TOOL_NOT_FOUND", `Unknown mock tool handler: ${handlerKey}`, 404);
  }
  return MOCK_TOOL_HANDLERS[handlerKey](input);
}
