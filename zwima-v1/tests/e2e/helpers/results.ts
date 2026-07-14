import fs from "node:fs";
import path from "node:path";
import { REPORT_MD, RESULTS_FILE } from "./constants";

export type StepResult = {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail?: string;
};

export type Phase4Report = {
  previewUrl: string;
  deploymentId: string | null;
  gitCommit: string | null;
  clerkAuthValid: boolean;
  timestamp: string;
  workspacePages: Record<string, StepResult>;
  projectCrud: StepResult;
  apiKeys: StepResult;
  routingModes: Record<string, StepResult>;
  usageCsv: StepResult;
  billingGuard: StepResult;
  logsSecurity: StepResult;
  settingsAudit: StepResult;
  adminRegression: StepResult;
  orgIsolation: StepResult;
  consoleErrors: string[];
  networkIssues: { url: string; status: number }[];
  skipped: string[];
  readyForRc: "YES" | "NO";
  p0: string[];
  p1: string[];
};

const defaultReport = (): Phase4Report => ({
  previewUrl: process.env.PLAYWRIGHT_BASE_URL || "https://zwima-8v2foh32q-zwima.vercel.app",
  deploymentId: process.env.PLAYWRIGHT_DEPLOYMENT_ID || null,
  gitCommit: process.env.PLAYWRIGHT_GIT_COMMIT || null,
  clerkAuthValid: false,
  timestamp: new Date().toISOString(),
  workspacePages: {},
  projectCrud: { name: "Project CRUD", status: "SKIP" },
  apiKeys: { name: "API Keys", status: "SKIP" },
  routingModes: {},
  usageCsv: { name: "Usage/CSV", status: "SKIP" },
  billingGuard: { name: "Billing Preview Guard", status: "SKIP" },
  logsSecurity: { name: "Logs security", status: "SKIP" },
  settingsAudit: { name: "Settings/Audit", status: "SKIP" },
  adminRegression: { name: "Admin regression", status: "SKIP" },
  orgIsolation: { name: "Org isolation", status: "SKIP" },
  consoleErrors: [],
  networkIssues: [],
  skipped: [],
  readyForRc: "NO",
  p0: [],
  p1: [],
});

let report: Phase4Report = defaultReport();

export function getReport(): Phase4Report {
  return report;
}

export function resetReport(): void {
  report = defaultReport();
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
}

export function recordStep(section: keyof Phase4Report, value: StepResult | Record<string, StepResult>): void {
  (report as Record<string, unknown>)[section as string] = value;
  persist();
}

export function recordMeta(partial: Partial<Phase4Report>): void {
  report = { ...report, ...partial };
  persist();
}

export function addConsoleError(msg: string): void {
  if (report.consoleErrors.length < 20) report.consoleErrors.push(msg);
  persist();
}

export function addNetworkIssue(url: string, status: number): void {
  if (status >= 400) {
    report.networkIssues.push({ url, status });
    if (report.networkIssues.length > 50) report.networkIssues.shift();
  }
  persist();
}

export function addSkipped(reason: string): void {
  if (!report.skipped.includes(reason)) report.skipped.push(reason);
  persist();
}

export function finalizeReport(): void {
  if (fs.existsSync(RESULTS_FILE)) {
    try {
      report = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8")) as Phase4Report;
    } catch {
      // keep in-memory defaults
    }
  }
  const failures = [
    ...Object.values(report.workspacePages).filter((s) => s.status === "FAIL"),
    report.projectCrud,
    report.apiKeys,
    ...Object.values(report.routingModes).filter((s) => s.status === "FAIL"),
    report.usageCsv,
    report.billingGuard,
    report.logsSecurity,
    report.settingsAudit,
  ].filter((s) => s.status === "FAIL");

  report.p0 = [];
  report.p1 = [];
  if (!report.clerkAuthValid) report.p0.push("Clerk auth invalid or expired — run npm run e2e:auth");
  for (const f of failures) report.p0.push(`${f.name} failed${f.detail ? `: ${f.detail}` : ""}`);
  if (report.networkIssues.some((n) => n.status >= 500)) {
    report.p0.push("Network 5xx responses detected during E2E");
  }
  if (report.consoleErrors.length > 0) report.p1.push(`${report.consoleErrors.length} browser console error(s)`);
  if (report.skipped.length > 0) report.p1.push(`${report.skipped.length} skipped check(s)`);

  report.readyForRc = failures.length === 0 && report.clerkAuthValid ? "YES" : "NO";
  persist();
  writeMarkdown();
}

function persist(): void {
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2));
}

function writeMarkdown(): void {
  const lines: string[] = [
    "# Phase 4 Playwright Validation Report",
    "",
    `- **Preview URL:** ${report.previewUrl}`,
    `- **Deployment ID:** ${report.deploymentId ?? "unknown"}`,
    `- **Clerk auth valid:** ${report.clerkAuthValid ? "YES" : "NO"}`,
    `- **Timestamp:** ${report.timestamp}`,
    `- **READY FOR PHASE 4 RC:** ${report.readyForRc}`,
    "",
    "## Workspace pages",
    ...Object.entries(report.workspacePages).map(([k, v]) => `- ${k}: **${v.status}**${v.detail ? ` — ${v.detail}` : ""}`),
    "",
    "## Feature results",
    `- Project CRUD: **${report.projectCrud.status}**`,
    `- API Keys: **${report.apiKeys.status}**`,
    `- Usage/CSV: **${report.usageCsv.status}**`,
    `- Billing guard: **${report.billingGuard.status}**`,
    `- Logs security: **${report.logsSecurity.status}**`,
    `- Settings/Audit: **${report.settingsAudit.status}**`,
    `- Admin regression: **${report.adminRegression.status}**`,
    `- Org isolation: **${report.orgIsolation.status}**`,
    "",
    "## Routing modes",
    ...Object.entries(report.routingModes).map(([k, v]) => `- ${k}: **${v.status}**${v.detail ? ` — ${v.detail}` : ""}`),
    "",
    "## Skipped",
    ...(report.skipped.length ? report.skipped.map((s) => `- ${s}`) : ["- none"]),
    "",
    "## Console errors (sample)",
    ...(report.consoleErrors.length ? report.consoleErrors.map((e) => `- ${e}`) : ["- none"]),
    "",
    "## Network 4xx/5xx (sample)",
    ...(report.networkIssues.length
      ? report.networkIssues.slice(0, 20).map((n) => `- ${n.status} ${n.url}`)
      : ["- none"]),
    "",
    "## P0",
    ...(report.p0.length ? report.p0.map((p) => `- ${p}`) : ["- none"]),
    "",
    "## P1",
    ...(report.p1.length ? report.p1.map((p) => `- ${p}`) : ["- none"]),
  ];
  fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
  fs.writeFileSync(REPORT_MD, lines.join("\n"));
}
