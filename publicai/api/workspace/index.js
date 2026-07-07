const { getAuthedClient, getAdminClient, parseBody, json, handleOptions, withCors } = require("../lib/supabase");
const workspace = require("../lib/workspace");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const { client, user } = await getAuthedClient(req);
    const admin = getAdminClient();
    const orgId = String(req.query?.organizationId || "").trim();
    const teamId = String(req.query?.teamId || "").trim();
    if (!orgId) return json(res, 400, { error: "organizationId is required" });

    const { member, permissions } = await workspace.requireOrgAccess(admin, orgId, user.id);

    const { data: org } = await client.from("organizations").select("*").eq("id", orgId).maybeSingle();
    const { data: teams } = await client.from("teams").select("*").eq("organization_id", orgId);

    const memberUserIds = new Set([org.owner_id]);
    const { data: orgMembers } = await admin.from("organization_members").select("user_id").eq("organization_id", orgId).eq("status", "active");
    (orgMembers || []).forEach((m) => { if (m.user_id) memberUserIds.add(m.user_id); });

    const userIds = [...memberUserIds];
    const [{ data: apiKeys }, { data: usage }, { data: payments }, { data: audit }, { data: prompts }] = await Promise.all([
      admin.from("api_keys").select("*").in("user_id", userIds).eq("status", "Active"),
      admin.from("usage_records").select("*").in("user_id", userIds).order("date_time", { ascending: false }).limit(50),
      admin.from("payments").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(10),
      admin.from("audit_logs").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(30),
      client.from("shared_prompts").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20),
    ]);

    const teamFilter = teamId ? (teams || []).filter((t) => t.id === teamId) : teams || [];

    return json(res, 200, {
      workspace: {
        organization: {
          id: org.id,
          name: org.name,
          credits: Number(org.credits),
          subscriptionPlan: org.subscription_plan,
        },
        role: member.role,
        permissions,
        resources: {
          apiKeys: {
            count: (apiKeys || []).length,
            keys: (apiKeys || []).slice(0, 10).map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, status: k.status })),
            link: "apikeys.html",
          },
          credits: {
            balance: Number(org.credits),
            link: "credits.html",
          },
          playground: { link: "playground.html", enabled: permissions.includes("playground") },
          usage: {
            totalRequests: (usage || []).length,
            recent: (usage || []).slice(0, 10),
            link: "usage.html",
          },
          billing: {
            payments: (payments || []).length,
            link: "billing.html",
            enabled: permissions.includes("billing"),
          },
          logs: {
            entries: (audit || []).map((a) => ({
              action: a.action,
              eventType: a.event_type,
              detail: a.detail,
              createdAt: a.created_at,
            })),
          },
          models: { link: "models.html", enabled: permissions.includes("models") },
          sharedPrompts: (prompts || []).map((p) => ({
            id: p.id,
            title: p.title,
            teamId: p.team_id,
            createdAt: p.created_at,
          })),
        },
        teams: teamFilter.map((t) => ({
          id: t.id,
          name: t.name,
          creditsAllocated: Number(t.credits_allocated),
        })),
      },
    });
  } catch (err) {
    console.error("[workspace]", err);
    return json(res, err.status || 500, { error: err.message || "Workspace request failed" });
  }
};
