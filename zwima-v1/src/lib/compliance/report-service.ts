import { prisma } from "../prisma";
import type { ComplianceAuditRecord } from "@prisma/client";
import type { ComplianceReportFilters, ComplianceReportFormat } from "./types";

export type ComplianceReportRow = {
  auditId: string;
  eventId: string;
  createdAt: string;
  provider: string;
  model: string;
  riskCategory: string;
  transparencyLevel: string;
  reviewMode: string;
  reviewStatus: string;
  processingRegion: string | null;
  policyVersion: string | null;
  disclaimerVersion: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: string | null;
  actualCost: string | null;
  currency: string;
  anonymized: boolean;
};

/** Fields that must never appear in an exported report, defense-in-depth against future schema/field additions. */
const FORBIDDEN_ROW_KEYS = new Set([
  "apiKeyId",
  "userId",
  "promptHash",
  "responseHash",
  "humanReviewerId",
  "reviewNotes",
  "integrityHash",
  "previousIntegrityHash",
]);

function toReportRow(record: ComplianceAuditRecord): ComplianceReportRow {
  return {
    auditId: record.auditId,
    eventId: record.eventId,
    createdAt: record.createdAt.toISOString(),
    provider: record.provider,
    model: record.model,
    riskCategory: record.riskCategory,
    transparencyLevel: record.transparencyLevel,
    reviewMode: record.reviewMode,
    reviewStatus: record.reviewStatus,
    processingRegion: record.processingRegion,
    policyVersion: record.policyVersion,
    disclaimerVersion: record.disclaimerVersion,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    estimatedCost: record.estimatedCost ? record.estimatedCost.toString() : null,
    actualCost: record.actualCost ? record.actualCost.toString() : null,
    currency: record.currency,
    anonymized: !!record.anonymizedAt,
  };
}

export async function fetchComplianceReportRows(filters: ComplianceReportFilters): Promise<ComplianceReportRow[]> {
  const records = await prisma.complianceAuditRecord.findMany({
    where: {
      organizationId: filters.organizationId,
      workspaceId: filters.workspaceId ?? undefined,
      riskCategory: filters.riskCategory,
      reviewStatus: filters.reviewStatus,
      provider: filters.provider,
      createdAt:
        filters.from || filters.to
          ? { gte: filters.from, lte: filters.to }
          : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(filters.limit ?? 500, 5000),
  });
  return records.map(toReportRow);
}

/** Guards against CSV formula injection by prefixing dangerous leading characters with a single quote. */
export function sanitizeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  const escaped = str.replace(/"/g, '""');
  const needsQuoting = /[",\n]/.test(escaped);
  const dangerous = /^[=+\-@]/.test(escaped);
  const safe = dangerous ? `'${escaped}` : escaped;
  return needsQuoting || dangerous ? `"${safe}"` : safe;
}

export function rowsToCsv(rows: ComplianceReportRow[]): string {
  if (rows.length === 0) {
    return "auditId,eventId,createdAt,provider,model,riskCategory,transparencyLevel,reviewMode,reviewStatus,processingRegion,policyVersion,disclaimerVersion,inputTokens,outputTokens,estimatedCost,actualCost,currency,anonymized\n";
  }
  const headers = Object.keys(rows[0]) as Array<keyof ComplianceReportRow>;
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => sanitizeCsvCell(row[h])).join(","));
  }
  return lines.join("\n");
}

export function rowsToJson(rows: ComplianceReportRow[]): string {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (FORBIDDEN_ROW_KEYS.has(key)) {
        throw new Error(`Compliance report row contains forbidden field: ${key}`);
      }
    }
  }
  return JSON.stringify({ rows, count: rows.length, generatedAt: new Date().toISOString() }, null, 2);
}

/**
 * Minimal text-only PDF builder (no external dependencies), intentionally
 * copied from `compliance-center/documentation/export-engine.ts`'s
 * `buildSimplePdf` pattern rather than imported, so this new report-service
 * never has to modify the frozen M6.3 documentation module.
 */
export function buildSimpleReportPdf(title: string, bodyLines: string[]): Buffer {
  const disclaimer =
    "This export is a system-generated compliance report and does not itself constitute legal advice.";
  const lines = [title, "", disclaimer, "", ...bodyLines];
  const contentLines = lines.map((line) =>
    line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"),
  );
  const streamParts: string[] = ["BT", "/F1 9 Tf", "40 780 Td", "12 TL"];
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i].slice(0, 120);
    if (i === 0) streamParts.push(`(${line}) Tj`);
    else streamParts.push(`T* (${line}) Tj`);
  }
  streamParts.push("ET");
  const stream = streamParts.join("\n");

  const objs: string[] = [];
  objs.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj");
  objs.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj");
  objs.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
  );
  objs.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj`);
  objs.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj + "\n";
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export function rowsToPdf(rows: ComplianceReportRow[], organizationId: string): Buffer {
  const bodyLines = rows
    .slice(0, 200)
    .map(
      (r) =>
        `${r.createdAt} | ${r.provider}/${r.model} | risk=${r.riskCategory} review=${r.reviewStatus} region=${r.processingRegion ?? "n/a"}`,
    );
  if (rows.length > 200) bodyLines.push(`... (${rows.length - 200} more rows omitted from PDF summary)`);
  return buildSimpleReportPdf(`Compliance Report — Organization ${organizationId}`, bodyLines);
}

export type GenerateComplianceReportResult = {
  format: ComplianceReportFormat;
  fileName: string;
  contentType: string;
  content: string | Buffer;
  rowCount: number;
};

export async function generateComplianceReport(
  filters: ComplianceReportFilters,
  format: ComplianceReportFormat,
  createdBy?: string | null,
): Promise<GenerateComplianceReportResult> {
  const rows = await fetchComplianceReportRows(filters);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `compliance-report-${timestamp}`;

  let result: GenerateComplianceReportResult;
  if (format === "csv") {
    result = {
      format,
      fileName: `${baseName}.csv`,
      contentType: "text/csv",
      content: rowsToCsv(rows),
      rowCount: rows.length,
    };
  } else if (format === "pdf") {
    result = {
      format,
      fileName: `${baseName}.pdf`,
      contentType: "application/pdf",
      content: rowsToPdf(rows, filters.organizationId),
      rowCount: rows.length,
    };
  } else {
    result = {
      format,
      fileName: `${baseName}.json`,
      contentType: "application/json",
      content: rowsToJson(rows),
      rowCount: rows.length,
    };
  }

  const reportExport = await prisma.complianceReportExport.create({
    data: {
      organizationId: filters.organizationId,
      workspaceId: filters.workspaceId ?? null,
      format,
      filters: JSON.parse(JSON.stringify(filters)),
      status: "COMPLETED",
      createdBy: createdBy ?? null,
      fileName: result.fileName,
      rowCount: result.rowCount,
    },
  });

  await recordReportExportComplianceEvent(filters, reportExport.id, createdBy);

  return result;
}

/**
 * Satisfies "an Audit Export itself generates a Compliance Event": every
 * successful `generateComplianceReport` call also records a runtime AIEvent
 * (eventSource=SYSTEM, requestType=compliance_report_export) so exporting a
 * report is itself an auditable act. No prompt/response plaintext is ever
 * involved here — recordAIEvent is dynamically imported (avoids any
 * module-load-order/circular-dependency risk with event-recorder's own
 * imports) and this function never calls back into report-service, so there
 * is no recursion risk. Failure to record this secondary event must never
 * fail the primary report export, so it is best-effort and swallowed.
 */
async function recordReportExportComplianceEvent(
  filters: ComplianceReportFilters,
  reportExportId: string,
  createdBy?: string | null,
): Promise<void> {
  try {
    const { recordAIEvent } = await import("./event-recorder");
    await recordAIEvent({
      requestId: `compliance_report_export_${reportExportId}`,
      organizationId: filters.organizationId,
      workspaceId: filters.workspaceId ?? null,
      userId: createdBy ?? null,
      provider: "internal",
      model: "compliance-report-export",
      taskType: "OTHER",
      requestType: "compliance_report_export",
      eventSource: "SYSTEM",
      environment:
        (process.env.VERCEL_ENV || process.env.NODE_ENV || "development").toLowerCase() === "production"
          ? "PRODUCTION"
          : (process.env.VERCEL_ENV || process.env.NODE_ENV || "development").toLowerCase() === "preview"
            ? "PREVIEW"
            : "DEVELOPMENT",
      inputTokens: 0,
      outputTokens: 0,
    });
  } catch (err) {
    console.error("compliance report export event recording failed (non-fatal):", err);
  }
}
