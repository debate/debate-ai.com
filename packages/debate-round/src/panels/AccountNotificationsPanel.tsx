/**
 * @fileoverview Account-linked notifications panel — the "real" (server-
 * backed, cross-account) counterpart to `PrepNoteNotificationsPanel`'s
 * localStorage/free-form-recipient-id feed. Renders via
 * `hooks/useAccountNotifications.ts`, so it shares its polling/toast
 * behavior instead of loading independently.
 *
 * @module panels/AccountNotificationsPanel
 */

"use client";

import Link from "next/link";
import { Badge } from "debate-ui/src/primitives/badge";
import { Button } from "debate-ui/src/primitives/button";
import { useAccountNotifications } from "../hooks/useAccountNotifications";

/** Renders the current user's account notifications (round invites, etc.), newest first, with per-item and mark-all-read actions. */
export function AccountNotificationsPanel() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useAccountNotifications(true);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">Invites and updates addressed to your account.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={unreadCount > 0 ? "default" : "outline"}>{unreadCount} unread</Badge>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={() => markAllRead()}>
              Mark all read
            </Button>
          )}
        </div>
      </div>
      {loading && notifications.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No notifications yet. You'll see one here whenever someone invites you to a round.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const content = (
              <div>
                <p className="text-foreground">{notification.title}</p>
                {notification.body && <p className="text-xs text-muted-foreground">{notification.body}</p>}
              </div>
            )
            return (
              <div
                key={notification.id}
                className="rounded-md border border-border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                {notification.link ? (
                  <Link href={notification.link} className="flex-1 hover:underline" onClick={() => markRead(notification.id)}>
                    {content}
                  </Link>
                ) : (
                  <div className="flex-1">{content}</div>
                )}
                {notification.readAt ? (
                  <Badge variant="outline">Read</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => markRead(notification.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}
