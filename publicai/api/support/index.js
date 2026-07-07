const {
  getAuthedClient,
  getAdminClient,
  parseBody,
  json,
  handleOptions,
  withCors,
  writeAuditLog,
  getClientIp,
} = require("../lib/supabase");
const support = require("../lib/support");

const MAX_SCREENSHOT = 500000;

function sanitizeScreenshot(value) {
  if (!value) return null;
  const str = String(value);
  if (str.length > MAX_SCREENSHOT) return str.slice(0, MAX_SCREENSHOT);
  return str;
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);
    const admin = getAdminClient();
    const body = parseBody(req);

    if (req.method === "GET") {
      const recordType = req.query?.type || body.type;
      let query = client.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (recordType) query = query.eq("record_type", recordType);
      const { data, error } = await query;
      if (error) throw error;

      const featureIds = (data || []).filter((r) => r.record_type === "feature").map((r) => r.id);
      let voted = new Set();
      if (featureIds.length) {
        const { data: votes } = await client.from("feature_votes").select("feature_id").eq("user_id", user.id).in("feature_id", featureIds);
        voted = new Set((votes || []).map((v) => v.feature_id));
      }

      return json(res, 200, {
        categories: support.TICKET_CATEGORIES,
        priorities: support.PRIORITIES,
        ticketStatuses: support.TICKET_STATUSES,
        featureStatuses: support.FEATURE_STATUSES,
        records: (data || []).map((row) => support.mapTicket(row, { hasVoted: voted.has(row.id) })),
      });
    }

    if (req.method === "POST") {
      const action = body.action;

      if (action === "create_ticket") {
        const category = String(body.category || "Other");
        if (!support.TICKET_CATEGORIES.includes(category)) {
          return json(res, 400, { error: "Invalid category" });
        }
        const priority = String(body.priority || "medium").toLowerCase();
        if (!support.PRIORITIES.includes(priority)) {
          return json(res, 400, { error: "Invalid priority" });
        }
        const title = String(body.title || "").trim();
        const description = String(body.description || "").trim();
        if (!title || !description) return json(res, 400, { error: "Title and description are required" });

        const ticketNumber = await support.nextTicketNumber(admin);
        const { data, error } = await admin
          .from("support_tickets")
          .insert({
            ticket_number: ticketNumber,
            user_id: user.id,
            record_type: "ticket",
            category,
            title,
            description,
            priority,
            status: "open",
          })
          .select()
          .single();
        if (error) throw error;

        await writeAuditLog({
          userId: user.id,
          eventType: "support",
          action: "Ticket created",
          target: ticketNumber,
          detail: title,
          ip: getClientIp(req),
        });
        await support.notifyUser(admin, user.id, "support", "Ticket submitted", `${ticketNumber} — ${title}`);
        return json(res, 200, { ok: true, ticket: support.mapTicket(data) });
      }

      if (action === "create_bug") {
        const title = String(body.title || "").trim();
        const description = String(body.description || "").trim();
        if (!title || !description) return json(res, 400, { error: "Title and description are required" });
        const severity = String(body.severity || "medium").toLowerCase();
        if (!support.PRIORITIES.includes(severity)) return json(res, 400, { error: "Invalid severity" });

        const ticketNumber = await support.nextTicketNumber(admin);
        const { data, error } = await admin
          .from("support_tickets")
          .insert({
            ticket_number: ticketNumber,
            user_id: user.id,
            record_type: "bug",
            category: "Other",
            title,
            description,
            priority: severity,
            severity,
            status: "open",
            steps_to_reproduce: String(body.stepsToReproduce || "").trim() || null,
            browser: String(body.browser || "").trim() || null,
            operating_system: String(body.operatingSystem || "").trim() || null,
            screenshot_url: sanitizeScreenshot(body.screenshotUrl),
          })
          .select()
          .single();
        if (error) throw error;

        await writeAuditLog({
          userId: user.id,
          eventType: "support",
          action: "Bug report submitted",
          target: ticketNumber,
          detail: title,
          ip: getClientIp(req),
        });
        await support.notifyUser(admin, user.id, "support", "Bug report received", `${ticketNumber} — ${title}`);
        return json(res, 200, { ok: true, bug: support.mapTicket(data) });
      }

      if (action === "create_feature") {
        const title = String(body.title || "").trim();
        const description = String(body.description || "").trim();
        if (!title) return json(res, 400, { error: "Feature title is required" });

        const ticketNumber = await support.nextTicketNumber(admin);
        const { data, error } = await admin
          .from("support_tickets")
          .insert({
            ticket_number: ticketNumber,
            user_id: user.id,
            record_type: "feature",
            category: "Other",
            title,
            description: description || title,
            priority: "medium",
            status: "pending",
            roadmap_status: "pending",
          })
          .select()
          .single();
        if (error) throw error;

        await writeAuditLog({
          userId: user.id,
          eventType: "support",
          action: "Feature request submitted",
          target: ticketNumber,
          detail: title,
          ip: getClientIp(req),
        });
        return json(res, 200, { ok: true, feature: support.mapTicket(data) });
      }

      if (action === "vote_feature") {
        const featureId = body.featureId;
        if (!featureId) return json(res, 400, { error: "featureId required" });
        const { data: feature } = await client.from("support_tickets").select("*").eq("id", featureId).eq("record_type", "feature").maybeSingle();
        if (!feature) return json(res, 404, { error: "Feature request not found" });

        const { data: existing } = await client.from("feature_votes").select("id").eq("feature_id", featureId).eq("user_id", user.id).maybeSingle();
        if (existing) {
          await client.from("feature_votes").delete().eq("id", existing.id);
          await admin.from("support_tickets").update({ vote_count: Math.max(0, (Number(feature.vote_count) || 0) - 1) }).eq("id", featureId);
          return json(res, 200, { ok: true, voted: false });
        }

        await client.from("feature_votes").insert({ feature_id: featureId, user_id: user.id });
        await admin.from("support_tickets").update({ vote_count: (Number(feature.vote_count) || 0) + 1 }).eq("id", featureId);
        return json(res, 200, { ok: true, voted: true });
      }

      return json(res, 400, { error: "Unknown action" });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[support]", err);
    return json(res, err.status || 500, { error: err.message || "Support request failed" });
  }
};
