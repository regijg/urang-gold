"use server";

import { listNotifications, type AppNotification } from "@/server/services/notification.service";

export async function getNotificationsAction(): Promise<AppNotification[]> {
  try {
    return await listNotifications();
  } catch (e) {
    console.error("[notifications]", e);
    return [];
  }
}
