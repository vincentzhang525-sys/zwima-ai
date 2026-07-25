import type { ComplianceRiskCategory, HumanReviewMode, TransparencyLevel } from "@prisma/client";
import type { RiskClassificationInput, RiskClassificationResult } from "./types";

/**
 * EU AI Act risk classification rules (platform-level heuristics).
 *
 * This is intentionally conservative: unknown / unmapped use cases default
 * to LIMITED (never silently MINIMAL or UNCLASSIFIED) so that AI-generated
 * content transparency obligations are still met by default.
 */

const PROHIBITED_TAGS = new Set([
  "social_scoring",
  "biometric_categorization_sensitive",
  "subliminal_manipulation",
  "exploitation_of_vulnerabilities",
  "predictive_policing_profiling",
  "emotion_recognition_workplace",
  "emotion_recognition_education",
  "real_time_biometric_id_public_law_enforcement",
  "untargeted_facial_scraping",
]);

const HIGH_RISK_TAGS = new Set([
  "credit_scoring",
  "employment_decision",
  "biometric_identification",
  "critical_infrastructure",
  "law_enforcement",
  "migration_asylum_border",
  "education_assessment",
  "essential_private_public_services",
  "medical_diagnosis",
  "insurance_pricing",
  "justice_administration",
]);

const LIMITED_RISK_TAGS = new Set([
  "chatbot",
  "generated_content",
  "deepfake",
  "emotion_recognition",
  "synthetic_media",
  "virtual_assistant",
]);

const MINIMAL_RISK_TASK_TYPES = new Set(["EMBEDDING"]);

export function classifyRisk(input: RiskClassificationInput): RiskClassificationResult {
  const tags = (input.useCaseTags ?? []).map((t) => t.toLowerCase());
  const reasons: string[] = [];

  if (input.prohibitedOverride || tags.some((t) => PROHIBITED_TAGS.has(t))) {
    reasons.push("Matched prohibited AI practice under EU AI Act Art. 5");
    return buildResult("PROHIBITED", "MANDATORY", "ENHANCED", reasons, true);
  }

  if (tags.some((t) => HIGH_RISK_TAGS.has(t))) {
    reasons.push("Matched high-risk use case under EU AI Act Annex III");
    return buildResult("HIGH", "REQUIRED", "ENHANCED", reasons, false);
  }

  if (tags.some((t) => LIMITED_RISK_TAGS.has(t))) {
    reasons.push("Matched limited-risk transparency obligation (chatbot / generated content / synthetic media)");
    return buildResult("LIMITED", "OPTIONAL", "STANDARD", reasons, false);
  }

  if (input.taskType && MINIMAL_RISK_TASK_TYPES.has(input.taskType)) {
    reasons.push("Task type classified as minimal risk (no direct end-user-facing generative output)");
    return buildResult("MINIMAL", "NONE", "BASIC", reasons, false);
  }

  // Default: never leave a runtime event UNCLASSIFIED once it has been
  // through the classifier — fall back to LIMITED so transparency notices
  // still apply.
  reasons.push("No specific risk tag matched — defaulting to LIMITED transparency obligations");
  return buildResult("LIMITED", "OPTIONAL", "BASIC", reasons, false);
}

/** Normalizes any category (including UNCLASSIFIED coming from storage) to an actionable one. */
export function normalizeRiskCategory(riskCategory: ComplianceRiskCategory): ComplianceRiskCategory {
  return riskCategory === "UNCLASSIFIED" ? "LIMITED" : riskCategory;
}

function buildResult(
  riskCategory: ComplianceRiskCategory,
  reviewMode: HumanReviewMode,
  transparencyLevel: TransparencyLevel,
  reasons: string[],
  blocked: boolean,
): RiskClassificationResult {
  return { riskCategory, reviewMode, transparencyLevel, reasons, blocked };
}
