const {
  getAdminClient,
  parseBody,
  json,
  handleOptions,
  withCors,
  writeAuditLog,
  getClientIp,
} = require("../lib/supabase");
const { requireAdmin } = require("../admin/_common");
const support = require("../lib/support");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { admin, user } = await requireAdmin(req);
    const body = parseBody(req);

    if (req.method === "GET") {
      const [
        { data: tickets },
        { data: bugs },
        { data: features },
        { data: incidents },
        { data: votes },
      ] = await Promise.all([
        admin.from("support_tickets").select("*").eq("record_type", "ticket").order("created_at", { ascending: false }).limit(100),
        admin.from("support_tickets").select("*").eq("record_type", "bug").order("created_at", { ascending: false }).limit(100),
        admin.from("support_tickets").select("*").eq("record_type", "feature").order("vote_count", { ascending: false }).limit(100),
        admin.from("status_incidents").select("*").order("starts_at", { ascending: false }).limit(50),
        admin.from("feature_votes").select("id"),
      ]);

      const openTickets = (tickets || []).filter((t) => ["open", "assigned", "waiting_customer"].includes(t.status));
      const openBugs = (bugs || []).filter((b) => !["resolved", "closed"].includes(b.status));
      const criticalBugs = openBugs.filter((b) => b.severity === "critical" || b.priority === "critical");

      const resolved = (tickets || []).filter((t) => t.resolved_at);
      const avgResolutionHours =
        resolved.length > 0
          ? resolved.reduce((sum, t) => {
              const ms = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
              return sum + ms / 3600000;
            }, 0) / resolved.length
          : 0;

      const rated = (tickets || []).filter((t) => t.satisfaction_rating != null);
      const avgSatisfaction = rated.length ? rated.reduce((s, t) => s + t.satisfaction_rating, 0) / rated.length : null;

      const providerComplaints = (tickets || []).filter((t) => t.category === "Provider" || t.category === "Gateway").length;

      const topModels = (features || [])
        .slice(0, 10)
        .map((f) => ({ title: f.title, votes: Number(f.vote_count) || 0, status: f.roadmap_status }));

      return json(res, 200, {
        ticketQueue: openTickets.map((r) => support.mapTicket(r)),
        averageResolutionHours: Number(avgResolutionHours.toFixed(1)),
        openBugs: openBugs.length,
        criticalBugs: criticalBugs.length,
        bugs: openBugs.map((r) => support.mapTicket(r)),
        featureVotes: (features || []).map((r) => support.mapTicket(r)),
        totalVotes: (votes || []).length,
        customerSatisfaction: avgSatisfaction != null ? Number(avgSatisfaction.toFixed(1)) : null,
        providerComplaints,
        topRequestedModels: topModels,
        tickets: (tickets || []).map((r) => support.mapTicket(r)),
        features: (features || []).map((r) => support.mapTicket(r)),
        incidents: (incidents || []).map(support.mapIncident),
        analytics: {
          openTickets: openTickets.length,
          totalTickets: (tickets || []).length,
          openBugs: openBugs.length,
          criticalBugs: criticalBugs.length,
          featureRequests: (features || []).length,
          publishedIncidents: (incidents || []).filter((i) => i.published).length,
        },
      });
    }

    if (req.method === "POST") {
      const action = body.action;

      if (action === "update_ticket") {
        const { ticketId, status, assignedTo, adminNotes, satisfactionRating } = body;
        const patch = { updated_at: new Date().toISOString() };
        if (status) patch.status = status;
        if (assignedTo !== undefined) patch.assigned_to = assignedTo || null;
        if (adminNotes !== undefined) patch.admin_notes = adminNotes;
        if (satisfactionRating !== undefined) patch.satisfaction_rating = satisfactionRating;
        if (status === "resolved" || status === "closed") patch.resolved_at = new Date().toISOString();

        const { data: before } = await admin.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
        const { data, error } = await admin.from("support_tickets").update(patch).eq("id", ticketId).select().single();
        if (error) throw error;

        const notifyTitle =
          status === "assigned"
            ? "Ticket assigned"
            : status === "closed" || status === "resolved"
              ? "Ticket closed"
              : "Ticket updated";
        await support.notifyUser(admin, data.user_id, "support", notifyTitle, `${data.ticket_number} — ${data.title}`);

        await writeAuditLog({
          userId: user.id,
          eventType: "admin",
          action: "Support ticket updated",
          target: data.ticket_number,
          detail: status || "updated",
          ip: getClientIp(req),
        });
        return json(res, 200, { ok: true, ticket: support.mapTicket(data), previousStatus: before?.status });
      }

      if (action === "update_feature") {
        const { featureId, roadmapStatus, status, adminNotes } = body;
        const patch = { updated_at: new Date().toISOString() };
        if (roadmapStatus) {
          patch.roadmap_status = roadmapStatus;
          patch.status = roadmapStatus;
        }
        if (status) patch.status = status;
        if (adminNotes !== undefined) patch.admin_notes = adminNotes;
        if (roadmapStatus === "released") patch.resolved_at = new Date().toISOString();

        const { data, error } = await admin.from("support_tickets").update(patch).eq("id", featureId).eq("record_type", "feature").select().single();
        if (error) throw error;

        if (roadmapStatus === "released") {
          const { data: voters } = await admin.from("feature_votes").select("user_id").eq("feature_id", featureId);
          for (const v of voters || []) {
            await support.notifyUser(admin, v.user_id, "product", "Feature released", data.title);
          }
        }

        return json(res, 200, { ok: true, feature: support.mapTicket(data) });
      }

      if (action === "publish_incident") {
        const { data, error } = await admin
          .from("status_incidents")
          .insert({
            title: String(body.title || "").trim(),
            description: String(body.description || "").trim(),
            component: String(body.component || "gateway").toLowerCase(),
            impact: body.impact || "degraded",
            incident_status: body.incidentStatus || "investigating",
            published: body.published !== false,
            starts_at: body.startsAt || new Date().toISOString(),
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;

        if (data.published) {
          const { data: profiles } = await admin.from("profiles").select("id").eq("status", "active").limit(500);
          for (const p of profiles || []) {
            await support.notifyUser(admin, p.id, "system", "Incident published", data.title);
          }
        }

        return json(res, 200, { ok: true, incident: support.mapIncident(data) });
      }

      if (action === "resolve_incident") {
        const { incidentId } = body;
        const { data, error } = await admin
          .from("status_incidents")
          .update({ incident_status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", incidentId)
          .select()
          .single();
        if (error) throw error;
        return json(res, 200, { ok: true, incident: support.mapIncident(data) });
      }

      if (action === "schedule_maintenance") {
        const { data, error } = await admin
          .from("status_incidents")
          .insert({
            title: String(body.title || "Scheduled maintenance").trim(),
            description: String(body.description || "").trim(),
            component: String(body.component || "gateway").toLowerCase(),
            impact: "maintenance",
            incident_status: "scheduled",
            published: true,
            starts_at: body.startsAt || new Date().toISOString(),
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;

        const { data: profiles } = await admin.from("profiles").select("id").eq("status", "active").limit(500);
        for (const p of profiles || []) {
          await support.notifyUser(admin, p.id, "system", "Maintenance scheduled", data.title);
        }

        return json(res, 200, { ok: true, incident: support.mapIncident(data) });
      }

      return json(res, 400, { error: "Unknown action" });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[admin/success]", err);
    return json(res, err.status || 500, { error: err.message || "Admin success request failed" });
  }
};
