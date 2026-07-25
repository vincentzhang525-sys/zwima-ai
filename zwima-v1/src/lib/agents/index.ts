// M8 Agent Platform — service layer barrel export.
//
// Mock provider only. Additive on top of the frozen M1-M7 baseline; nothing
// here modifies compliance-center / compliance-automation /
// compliance-regulatory / enterprise business logic — it only imports from
// them (event-recorder, human-review-service, workspace-context).

export * from "./types";
export * from "./errors";
export * from "./auth";
export * from "./http";
export * from "./mock-provider";
export * from "./mock-tools";
export * from "./registry-service";
export * from "./config-service";
export * from "./tool-registry-service";
export * from "./prompt-service";
export * from "./memory-service";
export * from "./review-bridge";
export * from "./execution-engine";
export * from "./delegation-service";
export * from "./metrics-service";
export * from "./policy-service";
export * from "./seed-agents";
