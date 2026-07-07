const TICKET_CATEGORIES = ["API", "Billing", "Credits", "Playground", "Gateway", "Provider", "Enterprise", "Security", "Account", "Other"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const TICKET_STATUSES = ["open", "assigned", "waiting_customer", "resolved", "closed"];
const FEATURE_STATUSES = ["pending", "approved", "rejected", "planned", "in_progress", "released"];
const INCIDENT_COMPONENTS = ["openai", "gemini", "claude", "deepseek", "qwen", "gateway", "authentication", "billing", "database", "smtp"];
const KB_CATEGORIES = ["Getting Started", "API Keys", "Credits", "Billing", "Playground", "Authentication", "Enterprise", "Security", "GDPR"];

function mapTicket(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    userId: row.user_id,
    recordType: row.record_type,
    category: row.category,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    stepsToReproduce: row.steps_to_reproduce,
    browser: row.browser,
    operatingSystem: row.operating_system,
    screenshotUrl: row.screenshot_url,
    severity: row.severity,
    roadmapStatus: row.roadmap_status,
    adminNotes: row.admin_notes,
    assignedTo: row.assigned_to,
    satisfactionRating: row.satisfaction_rating,
    voteCount: Number(row.vote_count) || 0,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extras,
  };
}

function mapIncident(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    component: row.component,
    impact: row.impact,
    incidentStatus: row.incident_status,
    published: Boolean(row.published),
    startsAt: row.starts_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapArticle(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: row.title,
    summary: row.summary,
    body: row.body,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function nextTicketNumber(admin) {
  const year = new Date().getFullYear();
  const { data: existing } = await admin.from("support_ticket_counters").select("*").eq("year", year).maybeSingle();
  const next = (Number(existing?.last_number) || 0) + 1;
  if (existing) {
    await admin.from("support_ticket_counters").update({ last_number: next }).eq("year", year);
  } else {
    await admin.from("support_ticket_counters").insert({ year, last_number: next });
  }
  return `ZW-${year}-${String(next).padStart(6, "0")}`;
}

async function notifyUser(admin, userId, category, title, message) {
  if (!userId) return;
  await admin.from("notifications").insert({
    user_id: userId,
    category,
    title,
    message,
  });
}

function healthToImpact(health) {
  if (health === "online" || health === "operational") return "operational";
  if (health === "degraded") return "degraded";
  if (health === "maintenance") return "maintenance";
  return "offline";
}

module.exports = {
  TICKET_CATEGORIES,
  PRIORITIES,
  TICKET_STATUSES,
  FEATURE_STATUSES,
  INCIDENT_COMPONENTS,
  KB_CATEGORIES,
  mapTicket,
  mapIncident,
  mapArticle,
  nextTicketNumber,
  notifyUser,
  healthToImpact,
};
