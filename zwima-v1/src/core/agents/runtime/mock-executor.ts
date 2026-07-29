import type { MockScenario } from "./types";
import { MOCK_TIMEOUT_SCENARIO_MS } from "./types";

export type MockExecutorInput = {
  scenario: MockScenario;
  message: string;
  signal?: AbortSignal;
  /** Wall-clock timeout for this mock invocation. */
  timeoutMs: number;
};

export type MockExecutorSuccess = {
  kind: "success";
  output: {
    text: string;
    mock: true;
    providerCallExecuted: false;
    scenario: "success";
  };
};

export type MockExecutorFailure = {
  kind: "fail" | "timeout" | "cancelled";
  error: { code: string; message: string };
};

export type MockExecutorResult = MockExecutorSuccess | MockExecutorFailure;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Deterministic mock executor — no network, no Provider SDK, no real cost.
 */
export async function runMockExecutor(input: MockExecutorInput): Promise<MockExecutorResult> {
  if (input.signal?.aborted) {
    return {
      kind: "cancelled",
      error: { code: "MOCK_CANCELLED", message: "Mock executor cancelled by caller." },
    };
  }

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  input.signal?.addEventListener("abort", onOuterAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    if (input.scenario === "timeout") {
      await sleep(Math.max(input.timeoutMs, MOCK_TIMEOUT_SCENARIO_MS) + 5, controller.signal);
      return {
        kind: "timeout",
        error: { code: "MOCK_TIMEOUT", message: "Mock executor timed out." },
      };
    }

    if (input.scenario === "fail") {
      await sleep(5, controller.signal);
      return {
        kind: "fail",
        error: {
          code: "MOCK_FORCED_FAILURE",
          message: "Mock executor forced failure scenario.",
        },
      };
    }

    await sleep(5, controller.signal);
    const preview = input.message.slice(0, 120);
    return {
      kind: "success",
      output: {
        text: `[MOCK] Preview-safe agent response to: ${preview}`,
        mock: true,
        providerCallExecuted: false,
        scenario: "success",
      },
    };
  } catch (err) {
    const aborted =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError");
    if (aborted && input.signal?.aborted) {
      return {
        kind: "cancelled",
        error: { code: "MOCK_CANCELLED", message: "Mock executor cancelled by caller." },
      };
    }
    if (aborted) {
      return {
        kind: "timeout",
        error: { code: "MOCK_TIMEOUT", message: "Mock executor timed out." },
      };
    }
    return {
      kind: "fail",
      error: {
        code: "MOCK_ERROR",
        message: err instanceof Error ? err.message : "Mock executor failed.",
      },
    };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onOuterAbort);
  }
}
