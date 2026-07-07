const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");
const workspace = require("../lib/workspace");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { admin } = await requireAdmin(req);

    if (req.method === "GET") {
      const [{ data: orgs }, { data: teams }, { data: members }, { data: permissions }, { data: payments }] =
        await Promise.all([
          admin.from("organizations").select("*").order("created_at", { ascending: false }),
          admin.from("teams").select("*"),
          admin.from("organization_members").select("*"),
          admin.from("workspace_role_permissions").select("*"),
          admin.from("payments").select("*").eq("status", "completed"),
        ]);

      const revenueByOrg = (orgs || []).map((org) => {
        const orgMemberIds = new Set([org.owner_id]);
        (members || []).filter((m) => m.organization_id === org.id && m.user_id).forEach((m) => orgMemberIds.add(m.user_id));
        const revenue = (payments || [])
          .filter((p) => orgMemberIds.has(p.user_id))
          .reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          organizationId: org.id,
          organizationName: org.name,
          revenue: Number(revenue.toFixed(2)),
          credits: Number(org.credits),
          memberCount: orgMemberIds.size,
          teamCount: (teams || []).filter((t) => t.organization_id === org.id).length,
        };
      });

      return json(res, 200, {
        organizations: (orgs || []).map((o) => ({
          id: o.id,
          name: o.name,
          vatNumber: o.vat_number,
          country: o.country,
          industry: o.industry,
          ownerId: o.owner_id,
          subscriptionPlan: o.subscription_plan,
          credits: Number(o.credits),
          status: o.status,
        })),
        teams: (teams || []).map((t) => ({
          id: t.id,
          organizationId: t.organization_id,
          name: t.name,
          creditsAllocated: Number(t.credits_allocated),
        })),
        roles: workspace.ORG_ROLES,
        permissions: (permissions || []).map((p) => ({ role: p.role, permissions: p.permissions })),
        revenueByOrganization: revenueByOrg,
        totals: {
          organizations: (orgs || []).length,
          teams: (teams || []).length,
          members: (members || []).length,
          totalRevenue: revenueByOrg.reduce((s, r) => s + r.revenue, 0),
        },
      });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[admin/enterprise]", err);
    return json(res, err.status || 500, { error: err.message || "Enterprise admin failed" });
  }
};
