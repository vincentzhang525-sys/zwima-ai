const fs = require("fs");
const path = require("path");
const { json, handleOptions, withCors } = require("../lib/supabase");

const FALLBACK_ENTRIES = [
  {
    title: "Sprint 45 — Customer Success Center (2026-07-07)",
    date: "2026-07-07",
    sections: {
      Added: ["Support Center with tickets, bugs, and feature voting", "Knowledge Base and Help Center", "Incident publishing and system status components"],
    },
  },
];

function changelogPaths() {
  return [
    path.join(process.cwd(), "CHANGELOG.md"),
    path.join(process.cwd(), "publicai", "CHANGELOG.md"),
    path.join(__dirname, "..", "..", "CHANGELOG.md"),
    path.join(__dirname, "..", "..", "..", "CHANGELOG.md"),
  ];
}

function readChangelogMarkdown() {
  for (const p of changelogPaths()) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return "";
}

function parseChangelog(markdown) {
  const entries = [];
  const lines = markdown.split("\n");
  let current = null;
  let section = null;

  for (const line of lines) {
    const sprintMatch = line.match(/^##\s+(.+)$/);
    if (sprintMatch) {
      if (current) entries.push(current);
      current = { title: sprintMatch[1].trim(), date: "", sections: {} };
      section = null;
      continue;
    }
    if (!current) continue;
    const dateMatch = current.title.match(/\((\d{4}-\d{2}-\d{2})\)/);
    if (dateMatch) current.date = dateMatch[1];
    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      current.sections[section] = current.sections[section] || [];
      continue;
    }
    if (section && line.startsWith("- ")) {
      current.sections[section].push(line.slice(2).trim());
    } else if (!section && line.startsWith("- ") && !current.sections.Features) {
      current.sections.Features = current.sections.Features || [];
      current.sections.Features.push(line.slice(2).trim());
    }
  }
  if (current) entries.push(current);
  return entries;
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const markdown = readChangelogMarkdown();
    let entries = markdown ? parseChangelog(markdown) : [...FALLBACK_ENTRIES];
    if (!entries.length) entries = [...FALLBACK_ENTRIES];
    return json(res, 200, {
      entries,
      highlights: {
        platformUpdates: entries.slice(0, 3),
        sprintReleases: entries.filter((e) => /Sprint/i.test(e.title)).slice(0, 5),
        newProviders: entries.flatMap((e) => e.sections.Added || []).filter((l) => /provider|OpenAI|Gemini|Claude/i.test(l)).slice(0, 8),
        bugFixes: entries.flatMap((e) => e.sections.Fixed || []).slice(0, 8),
        securityPatches: entries.flatMap((e) => (e.sections.Added || []).concat(e.sections.Fixed || [])).filter((l) => /security|auth|RLS|rate limit/i.test(l)).slice(0, 8),
      },
    });
  } catch (err) {
    console.error("[changelog]", err);
    return json(res, 500, { error: err.message || "Changelog request failed" });
  }
};
