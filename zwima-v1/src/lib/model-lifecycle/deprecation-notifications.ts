/**
 * GAP-010 — Deprecation notifications (IN_APP only).
 * EMAIL channel is fail-closed — never calls Resend / never sends real mail.
 */

export type NotificationChannel = "IN_APP" | "EMAIL";

export type PlannedNotification = {
  notificationType:
    | "ANNOUNCEMENT"
    | "REMINDER_30D"
    | "REMINDER_14D"
    | "REMINDER_7D"
    | "REMINDER_1D"
    | "SUNSET_DAY";
  channel: "IN_APP";
  scheduledAt: Date;
};

export function assertNotificationChannelAllowed(channel: NotificationChannel): void {
  if (channel === "EMAIL") {
    throw new Error("DEPRECATION_EMAIL_FORBIDDEN: GAP-010 Closed Beta sends IN_APP only (no real email)");
  }
}

/** Plan IN_APP reminders from announcement/sunset dates — does not send. */
export function planInAppDeprecationNotifications(input: {
  announcementDate?: Date | null;
  sunsetDate?: Date | null;
  now?: Date;
}): PlannedNotification[] {
  const now = input.now ?? new Date();
  const planned: PlannedNotification[] = [];

  if (input.announcementDate && input.announcementDate.getTime() >= now.getTime() - 86_400_000) {
    planned.push({
      notificationType: "ANNOUNCEMENT",
      channel: "IN_APP",
      scheduledAt: input.announcementDate,
    });
  }

  if (input.sunsetDate) {
    const sunset = input.sunsetDate.getTime();
    const day = 86_400_000;
    const reminders: Array<[PlannedNotification["notificationType"], number]> = [
      ["REMINDER_30D", 30 * day],
      ["REMINDER_14D", 14 * day],
      ["REMINDER_7D", 7 * day],
      ["REMINDER_1D", 1 * day],
      ["SUNSET_DAY", 0],
    ];
    for (const [notificationType, offset] of reminders) {
      const scheduledAt = new Date(sunset - offset);
      if (scheduledAt.getTime() >= now.getTime() - day) {
        planned.push({ notificationType, channel: "IN_APP", scheduledAt });
      }
    }
  }

  return planned;
}

/** Dispatch stub — records intent only; never sends email. */
export function dispatchDeprecationNotification(input: {
  channel: NotificationChannel;
  notificationType: string;
}): { delivered: boolean; channel: NotificationChannel; mode: "IN_APP_RECORDED" | "REFUSED" } {
  if (input.channel === "EMAIL") {
    return { delivered: false, channel: "EMAIL", mode: "REFUSED" };
  }
  return { delivered: true, channel: "IN_APP", mode: "IN_APP_RECORDED" };
}
