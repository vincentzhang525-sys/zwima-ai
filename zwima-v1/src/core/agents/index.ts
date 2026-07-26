// M8 Agent Platform Phase 1 — core facade barrel export.
//
// This package exposes the Phase 1 required API surface
// (createAgent/runAgent/...) as a thin, safety-hardened layer over the
// existing `src/lib/agents/**` service layer (registry-service,
// execution-engine, mock-provider, mock-tools). It adds nothing that could
// call a live model/tool provider, send real email, or take a real payment
// — see `agent-safety.ts` for the enforced limits/allowlist.

export * from "./agent-types";
export * from "./agent-safety";
export * from "./agent-validator";
export * from "./agent-cost-tracker";
export * from "./agent-runner";
export * from "./agent-service";
export * from "./tools";
