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
    const orgId = String(req.query?.organizationId || "").trim();

    if (req.method === "GET") {
      if (!orgId) return json(res, 400, { error: "organizationId is required" });
      await workspace.requireOrgAccess(admin, orgId, user.id, "members");

      const q = String(req.query?.q || "").trim().toLowerCase();
      const { data: org } = await client.from("organizations").select("owner_id").eq("id", orgId).maybeSingle();
      const { data: members } = await client.from("organization_members").select("*").eq("organization_id", orgId);
      const { data: profiles } = await admin.from("profiles").select("id, email, company, status");

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const rows = [];

      if (org?.owner_id) {
        const ownerProfile = profileMap.get(org.owner_id);
        if (!q || String(ownerProfile?.email || "").toLowerCase().includes(q) || "owner".includes(q)) {
          rows.push({
            userId: org.owner_id,
            email: ownerProfile?.email,
            role: "owner",
            status: "active",
            isOwner: true,
          });
        }
      }

      (members || []).forEach((m) => {
        const profile = profileMap.get(m.user_id);
        const email = m.invited_email || profile?.email || "";
        if (q && !email.toLowerCase().includes(q) && !String(m.role).includes(q)) return;
        rows.push({
          id: m.id,
          userId: m.user_id,
          email,
          role: m.role,
          status: m.status,
          joinedAt: m.joined_at,
          isOwner: false,
        });
      });

      const { data: activity } = await client
        .from("member_activity")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);

      return json(res, 200, { members: rows, activity: activity || [] });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const organizationId = String(body.organizationId || orgId || "").trim();
      if (!organizationId) return json(res, 400, { error: "organizationId is required" });
      const action = body.action;

      if (action === "invite") {
        await workspace.requireOrgAccess(admin, organizationId, user.id, "members");
        const email = String(body.email || "").trim().toLowerCase();
        const role = String(body.role || "developer").toLowerCase();
        if (!email) return json(res, 400, { error: "Email is required." });
        if (!workspace.ORG_ROLES.includes(role) || role === "owner") {
          return json(res, 400, { error: "Invalid role." });
        }

        const token = workspace.generateInviteToken();
        const { data: invite } = await admin
          .from("member_invitations")
          .insert({
            organization_id: organizationId,
            email,
            role,
            invited_by: user.id,
            token,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        await admin.from("organization_members").insert({
          organization_id: organizationId,
          user_id: null,
          role,
          status: "invited",
          invited_email: email,
        });

        await workspace.recordActivity(admin, {
          organizationId,
          userId: user.id,
          action: "member_invited",
          detail: `${email} as ${role}`,
        });

        await writeAuditLog({
          userId: user.id,
          organizationId,
          eventType: "member",
          action: "member_invited",
          target: email,
          detail: role,
          ip: getClientIp(req),
        });

        return json(res, 200, { ok: true, invitation: invite });
      }

      if (action === "remove") {
        await workspace.requireOrgAccess(admin, organizationId, user.id, "members");
        const memberId = body.memberId;
        const targetUserId = body.userId;
        if (memberId) {
          await admin.from("organization_members").delete().eq("id", memberId).eq("organization_id", organizationId);
        } else if (targetUserId) {
          await admin.from("organization_members").delete().eq("user_id", targetUserId).eq("organization_id", organizationId);
        }
        await writeAuditLog({
          userId: user.id,
          organizationId,
          eventType: "member",
          action: "member_removed",
          target: targetUserId || memberId,
          ip: getClientIp(req),
        });
        return json(res, 200, { ok: true });
      }

      if (action === "suspend") {
        await workspace.requireOrgAccess(admin, organizationId, user.id, "members");
        const targetUserId = String(body.userId || "").trim();
        await admin
          .from("organization_members")
          .update({ status: "suspended" })
          .eq("user_id", targetUserId)
          .eq("organization_id", organizationId);
        await workspace.recordActivity(admin, {
          organizationId,
          userId: user.id,
          action: "member_suspended",
          detail: targetUserId,
        });
        await writeAuditLog({
          userId: user.id,
          organizationId,
          eventType: "member",
          action: "member_suspended",
          target: targetUserId,
          ip: getClientIp(req),
        });
        return json(res, 200, { ok: true });
      }

      if (action === "transfer_ownership") {
        const { member } = await workspace.requireOrgAccess(admin, organizationId, user.id);
        if (member.role !== "owner") {
          const { data: org } = await admin.from("organizations").select("owner_id").eq("id", organizationId).maybeSingle();
          if (org?.owner_id !== user.id) return json(res, 403, { error: "Only owner can transfer ownership." });
        }
        const newOwnerId = String(body.newOwnerId || "").trim();
        if (!newOwnerId) return json(res, 400, { error: "newOwnerId is required." });

        await admin.from("organizations").update({ owner_id: newOwnerId }).eq("id", organizationId);
        await admin
          .from("organization_members")
          .upsert({
            organization_id: organizationId,
            user_id: newOwnerId,
            role: "owner",
            status: "active",
            joined_at: new Date().toISOString(),
          });
        await admin
          .from("organization_members")
          .update({ role: "admin" })
          .eq("user_id", user.id)
          .eq("organization_id", organizationId);

        await writeAuditLog({
          userId: user.id,
          organizationId,
          eventType: "member",
          action: "ownership_transferred",
          target: newOwnerId,
          ip: getClientIp(req),
        });
        return json(res, 200, { ok: true });
      }

      return json(res, 400, { error: "Unknown action" });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[members]", err);
    return json(res, err.status || 500, { error: err.message || "Member request failed" });
  }
};
