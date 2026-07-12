import { prisma } from "./prisma";
import type { AuditCategory, Prisma } from "@prisma/client";

export async function writeAudit(params: {
  userId?: string;
  action: string;
  category: AuditCategory;
  detail?: Prisma.InputJsonValue;
  ip?: string;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      category: params.category,
      detail: params.detail,
      ip: params.ip,
    },
  });
}

export async function getAuditLogs(params: { userId?: string; limit?: number; category?: AuditCategory }) {
  return prisma.auditLog.findMany({
    where: {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.category ? { category: params.category } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
    include: { user: { select: { email: true, companyName: true } } },
  });
}

export async function searchAuditLogs(q: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { email: true } } },
  });
}
