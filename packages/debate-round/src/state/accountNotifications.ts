/**
 * @fileoverview Network calls for account-linked notifications
 * (`apps/debate-ai.com`'s `/api/notifications`) — the cross-account
 * counterpart to `state/prepNoteNotifications.ts`'s localStorage-only,
 * free-form-recipient-id notifications. Backs
 * `hooks/useAccountNotifications.ts`'s polling and `AccountNotificationsPanel`.
 *
 * Mirrors `round/round-pairings-client.ts`'s `401` → `null` convention for
 * reads (a signed-out browser just sees no notifications, no error), and
 * throws on a failed write since the panel/menu calling it needs to know a
 * "mark read" didn't take.
 *
 * @module state/accountNotifications
 */

export interface AccountNotification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface AccountNotificationsPage {
  notifications: AccountNotification[];
  unreadCount: number;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Fetches the current user's notifications and unread count. Returns `null` when signed out (a `401` response) or on any request failure. */
export async function fetchAccountNotifications(
  endpoint = "/api/notifications",
): Promise<AccountNotificationsPage | null> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as AccountNotificationsPage;
  } catch (error) {
    console.error("Unable to load notifications:", error);
    return null;
  }
}

/** Marks one notification read by id. Throws on failure, `401` included. */
export async function markAccountNotificationRead(id: number, endpoint = "/api/notifications"): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to mark this notification read."));
  }
}

/** Marks every unread notification read. Throws on failure, `401` included. */
export async function markAllAccountNotificationsRead(endpoint = "/api/notifications"): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ all: true }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to mark your notifications read."));
  }
}
