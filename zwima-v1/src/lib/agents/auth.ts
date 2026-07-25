import { isAdmin } from "../admin";
import { requireWorkspaceContext, type WorkspaceContext } from "../workspace/workspace-context";
import { AgentServiceError } from "./errors";
import type { AgentPermission } from "./types";

export type AgentContext = WorkspaceContext & {
  platformAdmin: boolean;
};

export async function requireAgentContext(): Promise<AgentContext> {
  const ctx = await requireWorkspaceContext();
  const platformAdmin = await isAdmin();
  return { ...ctx, platformAdmin };
}

/** OWNER/ADMIN (or a platform admin) can administer the agent platform for their org. */
function orgIsAdminRole(ctx: Pick<AgentContext, "role" | "platformAdmin">): boolean {
  return ctx.platformAdmin || ctx.role === "OWNER" || ctx.role === "ADMIN";
}

/** DEVELOPER may build/configure/run agents, in addition to admin roles. VIEWER (and BILLING) are read-only. */
function orgCanEdit(ctx: Pick<AgentContext, "role" | "platformAdmin">): boolean {
  return orgIsAdminRole(ctx) || ctx.role === "DEVELOPER";
}

export function hasAgentPermission(
  ctx: Pick<AgentContext, "role" | "platformAdmin">,
  perm: AgentPermission,
): boolean {
  if (perm === "read") return true;
  if (perm === "edit") return orgCanEdit(ctx);
  if (perm === "admin") return orgIsAdminRole(ctx);
  return false;
}

export function assertAgentPermission(
  ctx: Pick<AgentContext, "role" | "platformAdmin">,
  perm: AgentPermission,
): void {
  if (!hasAgentPermission(ctx, perm)) {
    throw new AgentServiceError("FORBIDDEN", `Insufficient agent permission: ${perm}`, 403);
  }
}
