import { prisma } from "../prisma";

export async function getOrgMemberUserIds(organizationId: string): Promise<string[]> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId, accepted: true },
    select: { userId: true },
  });
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } });
  const ids = new Set(members.map((m) => m.userId));
  if (org?.ownerId) ids.add(org.ownerId);
  return [...ids];
}

export async function getOrgApiKeyIds(organizationId: string): Promise<string[]> {
  const keys = await prisma.apiKey.findMany({
    where: { organizationId, name: { not: "__playground__" } },
    select: { id: true },
  });
  return keys.map((k) => k.id);
}

export async function buildOrgUsageWhere(organizationId: string) {
  const [keyIds, userIds] = await Promise.all([
    getOrgApiKeyIds(organizationId),
    getOrgMemberUserIds(organizationId),
  ]);

  return {
    OR: [
      ...(keyIds.length ? [{ apiKeyId: { in: keyIds } }] : []),
      { userId: { in: userIds }, apiKeyId: null },
    ],
  };
}

export async function assertOrgApiKey(organizationId: string, apiKeyId: string): Promise<void> {
  const key = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, organizationId },
    select: { id: true },
  });
  if (!key) throw new Error("FORBIDDEN");
}
