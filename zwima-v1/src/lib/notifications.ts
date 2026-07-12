import { prisma } from "./prisma";
import type { NotificationType } from "@prisma/client";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
}) {
  return prisma.notification.create({ data: params });
}

export async function getNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markNotificationRead(userId: string, id: string) {
  return prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}

export async function checkLowBalance(userId: string, credits: number) {
  if (credits >= 1000) return;
  const recent = await prisma.notification.findFirst({
    where: { userId, type: "LOW_BALANCE", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (!recent) {
    await createNotification({
      userId,
      type: "LOW_BALANCE",
      title: "Low balance",
      message: `Your credit balance is ${credits}. Recharge to avoid service interruption.`,
    });
  }
}
