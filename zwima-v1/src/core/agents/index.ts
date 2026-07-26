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

// M8 Agent Platform Phase 2A — templates & memory foundation.
//
// `agent-service.ts` re-exports the audited, permission-checked wrapper for
// every template/memory read+write (listAgentTemplates, createAgentTemplate,
// getAgentMemoryPolicy, createAgentMemoryEntry, ...) — that facade is the
// intended public entry point (matches the Phase 1 create/run pattern), so
// only the *non-overlapping* names from the lower-level core modules are
// re-exported here to avoid ambiguous-export collisions.
export * from "./template-catalog";
export {
  newAgentTemplateId,
  assertToolKeysAllowed,
  type AgentTemplateRecord,
} from "./template-service";
export {
  DEFAULT_MEMORY_POLICY,
  getAgentMemoryPolicySafe,
  type AgentMemoryPolicyRecord,
} from "./memory-policy-service";
export {
  looksLikeSecretPhase2,
  loadRecentMemoryForExecution,
  type AgentMemoryPhase2Record,
} from "./memory-phase2-service";
// `createAgentFromTemplate` is intentionally omitted here — use the audited
// wrapper of the same name re-exported from `agent-service.ts` instead.
