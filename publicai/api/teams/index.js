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
const workspace = require("../lib/workspace");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);
    const admin = getAdminClient();
    const orgId = String(req.query?.organizationId || parseBody(req).organizationId || "").trim();
    if (!orgId) return json(res, 400, { error: "organizationId is required" });

    if (req.method === "GET") {
      await workspace.requireOrgAccess(admin, orgId, user.id);
      const { data: teams } = await client.from("teams").select("*").eq("organization_id", orgId).order("name");
      const teamsWithMembers = await Promise.all(
        (teams || []).map(async (team) => {
          const { data: members } = await client.from("team_members").select("*").eq("team_id", team.id);
          return {
            id: team.id,
            name: team.name,
            slug: team.slug,
            creditsAllocated: Number(team.credits_allocated),
            status: team.status,
            memberCount: (members || []).length,
          };
        })
      );
      return json(res, 200, { teams: teamsWithMembers });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const action = body.action || "create";
      await workspace.requireOrgAccess(admin, orgId, user.id, "teams");

      if (action === "create") {
        const name = String(body.name || "").trim();
        if (!name) return json(res, 400, { error: "Team name is required." });
        const { data: team } = await admin
          .from("teams")
          .insert({
            organization_id: orgId,
            name,
            slug: workspace.slugify(name),
            credits_allocated: Number(body.creditsAllocated) || 0,
          })
          .select()
          .single();
        await workspace.recordActivity(admin, {
          organizationId: orgId,
          userId: user.id,
          action: "team_created",
          detail: name,
        });
        await writeAuditLog({
          userId: user.id,
          organizationId: orgId,
          teamId: team.id,
          eventType: "team",
          action: "team_created",
          target: team.id,
          detail: name,
          ip: getClientIp(req),
        });
        return json(res, 200, { ok: true, team });
      }

      if (action === "update") {
        const teamId = String(body.teamId || "").trim();
        const { data: team } = await admin
          .from("teams")
          .update({
            name: body.name,
            credits_allocated: body.creditsAllocated,
            status: body.status,
          })
          .eq("id", teamId)
          .eq("organization_id", orgId)
          .select()
          .single();
        return json(res, 200, { ok: true, team });
      }

      if (action === "delete") {
        const teamId = String(body.teamId || "").trim();
        await admin.from("teams").delete().eq("id", teamId).eq("organization_id", orgId);
        return json(res, 200, { ok: true });
      }

      return json(res, 400, { error: "Unknown action" });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[teams]", err);
    return json(res, err.status || 500, { error: err.message || "Team request failed" });
  }
};
