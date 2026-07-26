/**
 * M8 Agent Platform Phase 2A — system template catalog.
 *
 * The three Phase 2A system templates are defined in code, not written to
 * the database by a seed script. `template-service.ts` merges this catalog
 * with any platform-admin-created `AgentTemplate` override rows
 * (`organizationId = null`) when listing/reading templates, but nothing in
 * this file ever performs I/O.
 *
 * Every template's `allowedToolKeys` is validated against the frozen Phase 1
 * `ALLOWED_TOOL_KEYS` at module load time (`assertCatalogToolKeysAllowed`) —
 * the catalog can never accidentally reference a forbidden or future tool.
 */

import { ALLOWED_TOOL_KEYS, AGENT_RUN_TIMEOUT_MS, MAX_AGENT_STEPS, PER_RUN_COST_CEILING_USD } from "./agent-safety";
import { DEFAULT_MOCK_MODEL } from "@/lib/agents/mock-provider";

export type SystemAgentTemplate = {
  templateId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxSteps: number;
  defaultTimeoutMs: number;
  defaultCostCeiling: number;
  allowedToolKeys: readonly string[];
};

const EU_COMPLIANCE_DISCLAIMER =
  "IMPORTANT: Every response you produce is operational guidance to help a team organize its own compliance workflow. It is NOT legal advice, it does not constitute a regulatory determination, and it must never be presented to a user as a substitute for qualified legal counsel or the organization's official M5/M6 compliance tooling.";

const SYSTEM_AGENT_TEMPLATES_SOURCE: readonly SystemAgentTemplate[] = [
  {
    templateId: "tpl_system_api_integration_assistant",
    slug: "api-integration-assistant",
    name: "API Integration Assistant",
    description:
      "Helps plan and document API integration steps (request/response shapes, retry/backoff math, usage accounting). Mock provider only — it never places a live HTTP call itself.",
    category: "integration",
    systemPrompt:
      "You are the API Integration Assistant. You help a developer plan an API integration: outline required request/response fields, compute simple numeric values (timeouts, retry backoff, rate-limit budgets) with the calculator tool, look up the current date/time with the current_datetime tool, and summarize workspace usage with the workspace_usage_summary tool. You never call any external HTTP endpoint yourself, you never fetch or write files, and you never execute shell commands or SQL — those capabilities do not exist for you. If asked to perform an action outside the calculator/current_datetime/workspace_usage_summary tools, explain that it is out of scope for this assistant.",
    defaultModel: DEFAULT_MOCK_MODEL,
    defaultTemperature: 0.4,
    defaultMaxSteps: MAX_AGENT_STEPS,
    defaultTimeoutMs: AGENT_RUN_TIMEOUT_MS,
    defaultCostCeiling: PER_RUN_COST_CEILING_USD,
    allowedToolKeys: ["calculator", "current_datetime", "workspace_usage_summary"],
  },
  {
    templateId: "tpl_system_cost_optimization_assistant",
    slug: "cost-optimization-assistant",
    name: "Cost Optimization Assistant",
    description:
      "Reviews synthetic workspace usage figures and helps model cost-saving scenarios with the calculator tool. Never touches real billing/payment systems.",
    category: "cost-optimization",
    systemPrompt:
      "You are the Cost Optimization Assistant. You help a workspace admin reason about spend: summarize workspace usage with the workspace_usage_summary tool, run cost/savings arithmetic with the calculator tool, and timestamp your analysis with the current_datetime tool. You never create a payment, charge a card, open a Stripe checkout session, or modify any billing record — you only produce read-only analysis and suggestions for a human to act on elsewhere.",
    defaultModel: DEFAULT_MOCK_MODEL,
    defaultTemperature: 0.3,
    defaultMaxSteps: MAX_AGENT_STEPS,
    defaultTimeoutMs: AGENT_RUN_TIMEOUT_MS,
    defaultCostCeiling: PER_RUN_COST_CEILING_USD,
    allowedToolKeys: ["calculator", "current_datetime", "workspace_usage_summary"],
  },
  {
    templateId: "tpl_system_eu_compliance_assistant",
    slug: "eu-compliance-assistant",
    name: "EU Compliance Assistant",
    description:
      "Helps organize EU-related compliance operational tasks (timestamps, workspace usage context). Operational guidance only — explicitly not legal advice.",
    category: "compliance",
    systemPrompt: `You are the EU Compliance Assistant. You help a team organize operational compliance tasks: timestamp checklist items with the current_datetime tool and reference workspace usage context with the workspace_usage_summary tool. You do not have web search, document retrieval, email, or any HTTP tool, so you never fetch or cite external regulatory text directly — point the user to their organization's official M5/M6 compliance modules and qualified legal counsel for anything requiring a binding determination. ${EU_COMPLIANCE_DISCLAIMER}`,
    defaultModel: DEFAULT_MOCK_MODEL,
    defaultTemperature: 0.2,
    defaultMaxSteps: MAX_AGENT_STEPS,
    defaultTimeoutMs: AGENT_RUN_TIMEOUT_MS,
    defaultCostCeiling: PER_RUN_COST_CEILING_USD,
    // Deliberately narrower than the other two system templates — no calculator.
    allowedToolKeys: ["current_datetime", "workspace_usage_summary"],
  },
];

/** Defense-in-depth: the catalog itself can never reference a tool outside the frozen Phase 1 allowlist. Runs at module load, so a bad edit fails fast (tests + app boot) rather than silently shipping a broken template. */
function assertCatalogToolKeysAllowed(templates: readonly SystemAgentTemplate[]): void {
  for (const template of templates) {
    for (const key of template.allowedToolKeys) {
      if (!(ALLOWED_TOOL_KEYS as readonly string[]).includes(key)) {
        throw new Error(
          `template-catalog: system template '${template.templateId}' references disallowed tool key '${key}'`,
        );
      }
    }
  }
}
assertCatalogToolKeysAllowed(SYSTEM_AGENT_TEMPLATES_SOURCE);

export const SYSTEM_AGENT_TEMPLATES: readonly SystemAgentTemplate[] = Object.freeze(
  SYSTEM_AGENT_TEMPLATES_SOURCE.map((t) => Object.freeze({ ...t, allowedToolKeys: Object.freeze([...t.allowedToolKeys]) })),
);

export function findSystemTemplate(templateId: string): SystemAgentTemplate | undefined {
  return SYSTEM_AGENT_TEMPLATES.find((t) => t.templateId === templateId);
}

export function isSystemTemplateId(templateId: string): boolean {
  return SYSTEM_AGENT_TEMPLATES.some((t) => t.templateId === templateId);
}

export function findSystemTemplateBySlug(slug: string): SystemAgentTemplate | undefined {
  return SYSTEM_AGENT_TEMPLATES.find((t) => t.slug === slug);
}
