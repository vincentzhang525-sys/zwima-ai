import { auth } from "@clerk/nextjs/server";
import { prisma } from "../prisma";
import { ApiError } from "../api-errors";
import type { OrgRole } from "@prisma/client";
import {
  OverviewCacheTtl,
  cacheGet,
  cacheSet,
  overviewIdentityKey,
} from "./overview-cache";

export type OverviewIdentity = {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: OrgRole;
};

export type OverviewIdentityTimings = {
  auth_ms: number;
  user_lookup_ms: number;
  membership_lookup_ms: number;
  organization_ms: number;
};

/**
 * Read-only workspace identity for Dashboard overview GET.
 * - Single Prisma query (User + first accepted membership + org name)
 * - No create/update/upsert / ensureDefault*
 */
export async function requireOverviewIdentity(): Promise<{
  identity: OverviewIdentity;
  timings: OverviewIdentityTimings;
  cacheHit: boolean;
}> {
  const tAuth = Date.now();
  const { userId: clerkId } = await auth();
  const auth_ms = Date.now() - tAuth;

  if (!clerkId) {
    throw new ApiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const cached = cacheGet<OverviewIdentity>(overviewIdentityKey(clerkId));
  if (cached) {
    return {
      identity: cached,
      timings: {
        auth_ms,
        user_lookup_ms: 0,
        membership_lookup_ms: 0,
        organization_ms: 0,
      },
      cacheHit: true,
    };
  }

  const tLookup = Date.now();
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      organizationMembers: {
        where: { accepted: true },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          role: true,
          organization: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });
  const user_lookup_ms = Date.now() - tLookup;

  if (!user) {
    throw new ApiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const membership = user.organizationMembers[0];
  if (!membership?.organization) {
    // Pure GET — do not auto-create organization/membership here.
    throw new ApiError(
      "FORBIDDEN",
      "No organization membership found. Complete onboarding first.",
      403,
    );
  }

  const identity: OverviewIdentity = {
    userId: user.id,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    role: membership.role,
  };

  cacheSet(overviewIdentityKey(clerkId), identity, OverviewCacheTtl.identityMs);

  return {
    identity,
    timings: {
      auth_ms,
      // Membership + org resolved in the same query as user.
      user_lookup_ms,
      membership_lookup_ms: 0,
      organization_ms: 0,
    },
    cacheHit: false,
  };
}
