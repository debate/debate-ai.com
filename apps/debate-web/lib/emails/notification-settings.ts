/**
 * @fileoverview Settings → Notifications account prefs: push opt-in on
 * `user_settings.push_notifications_enabled`, plus the email unsubscribe
 * status for the signed-in address.
 */

import { eq } from "drizzle-orm";
import { userSettings } from "@/lib/database/schema";
import type { getDBFromContext } from "@/lib/database/context";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { isEmailUnsubscribed } from "./unsubscribe";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

export interface NotificationSettings {
  email: string;
  /** Opted out of every Debate AI email. */
  emailUnsubscribed: boolean;
  /**
   * OS/browser push preference: `true` enabled, `false` declined/off,
   * `null` never asked on this account.
   */
  pushEnabled: boolean | null;
}

/** Read the signed-in user's notification prefs. */
export async function getNotificationSettings(
  db: Database,
  userId: string,
  email: string,
): Promise<NotificationSettings> {
  await ensureTableColumns(db, userSettings);
  const [row] = await db
    .select({ push: userSettings.pushNotificationsEnabled })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  const raw = row?.push;
  const pushEnabled = raw === 1 ? true : raw === 0 ? false : null;
  return {
    email,
    emailUnsubscribed: await isEmailUnsubscribed(db, email),
    pushEnabled,
  };
}

/** Persist the push opt-in flag (creates the settings row when missing). */
export async function setPushNotificationsEnabled(
  db: Database,
  userId: string,
  enabled: boolean,
): Promise<void> {
  await ensureTableColumns(db, userSettings);
  const now = new Date();
  const value = enabled ? 1 : 0;
  await db
    .insert(userSettings)
    .values({ userId, pushNotificationsEnabled: value, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { pushNotificationsEnabled: value, updatedAt: now },
    });
}
