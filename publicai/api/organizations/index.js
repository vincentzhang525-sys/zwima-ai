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

const DEFAULT_TEAMS = workspace.DEFAULT_TEAMS;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);
    const admin = getAdminClient();

    if (req.method === "GET") {
      const orgId = String(req.query?.organizationId || "").trim();
      if (orgId) {
        await workspace.requireOrgAccess(admin, orgId, user.id);
        const { data: org } = await client.from("organizations").select("*").eq("id", orgId).maybeSingle();
        if (!org) return json(res, 404, { error: "Organization not found" });
        const [{ data: members }, { data: teams }] = await Promise.all([
          client.from("organization_members").select("*").eq("organization_id", orgId),
          client.from("teams").select("*").eq("organization_id", orgId).order("name"),
        ]);
        return json(res, 200, {
          organization: {
            id: org.id,
            name: org.name,
            vatNumber: org.vat_number,
            country: org.country,
            industry: org.industry,
            ownerId: org.owner_id,
            subscriptionPlan: org.subscription_plan,
            credits: Number(org.credits),
            status: org.status,
            memberCount: (members || []).filter((m) => m.status === "active").length + 1,
            teamCount: (teams || []).length,
          },
          members: members || [],
          teams: teams || [],
        });
      }

      const { data: owned } = await client.from("organizations").select("*").eq("owner_id", user.id);
      const { data: memberships } = await client
        .from("organization_members")
        .select("organization_id, role, status, organizations(*)")
        .eq("user_id", user.id)
        .eq("status", "active");

      const orgMap = new Map();
      (owned || []).forEach((o) => orgMap.set(o.id, { ...o, memberRole: "owner" }));
      (memberships || []).forEach((m) => {
        if (m.organizations && !orgMap.has(m.organizations.id)) {
          orgMap.set(m.organizations.id, { ...m.organizations, memberRole: m.role });
        }
      });

      return json(res, 200, {
        organizations: [...orgMap.values()].map((o) => ({
          id: o.id,
          name: o.name,
          vatNumber: o.vat_number,
          country: o.country,
          industry: o.industry,
          ownerId: o.owner_id,
          subscriptionPlan: o.subscription_plan,
          credits: Number(o.credits),
          status: o.status,
          role: o.memberRole,
        })),
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const action = body.action || "create";

      if (action === "create") {
        const name = String(body.name || "").trim();
        if (!name) return json(res, 400, { error: "Company name is required." });

        const { data: wallet } = await client.from("credit_wallets").select("balance").eq("user_id", user.id).maybeSingle();
        const credits = Number(wallet?.balance) || 0;

        const { data: org, error: orgError } = await admin
          .from("organizations")
          .insert({
            name,
            vat_number: body.vatNumber || null,
            country: body.country || "DE",
            industry: body.industry || null,
            owner_id: user.id,
            subscription_plan: body.subscriptionPlan || "free",
            credits,
          })
          .select()
          .single();
        if (orgError) throw orgError;

        await admin.from("organization_members").insert({
          organization_id: org.id,
          user_id: user.id,
          role: "owner",
          status: "active",
          joined_at: new Date().toISOString(),
        });

        for (const teamName of DEFAULT_TEAMS) {
          await admin.from("teams").insert({
            organization_id: org.id,
            name: teamName,
            slug: workspace.slugify(teamName),
          });
        }

        await workspace.recordActivity(admin, {
          organizationId: org.id,
          userId: user.id,
          action: "organization_created",
          detail: `Created organization ${name}`,
        });

        await writeAuditLog({
          userId: user.id,
          organizationId: org.id,
          eventType: "organization",
          action: "organization_created",
          target: org.id,
          detail: name,
          ip: getClientIp(req),
        });

        return json(res, 200, { ok: true, organization: org });
      }

      if (action === "update") {
        const orgId = String(body.organizationId || "").trim();
        await workspace.requireOrgAccess(admin, orgId, user.id, "settings");
        const { data: org } = await admin
          .from("organizations")
          .update({
            name: body.name,
            vat_number: body.vatNumber,
            country: body.country,
            industry: body.industry,
            subscription_plan: body.subscriptionPlan,
          })
          .eq("id", orgId)
          .select()
          .single();
        await writeAuditLog({
          userId: user.id,
          organizationId: orgId,
          eventType: "organization",
          action: "organization_updated",
          target: orgId,
          ip: getClientIp(req),
        });
        return json(res, 200, { ok: true, organization: org });
      }

      return json(res, 400, { error: "Unknown action" });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[organizations]", err);
    return json(res, err.status || 500, { error: err.message || "Organization request failed" });
  }
};
