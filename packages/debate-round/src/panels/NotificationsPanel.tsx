/**
 * @fileoverview Notifications panel — the UI half of the "🔄 Strategy Sync
 * Notes" bullet's follow-up (b) in TODO.md, "an assignee notification once
 * a notification system exists." Renders one recipient's persisted
 * `Notification`s (from `state/notifications.ts`), unread first, with a
 * mark-read action. `PrepNotesPanel`'s assign action is what creates these
 * notifications; no new mutation logic is introduced here.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing — same convention as
 * every other panel in this package.
 *
 * @module panels/NotificationsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { markPersistedNotificationRead, listNotificationsForRecipient } from "../state/notifications"
import type { Notification } from "../notifications/notifications"

/**
 * Renders the Notifications panel: a recipient id field (this repo has no
 * auth/identity system yet, so the viewer types who they are, mirroring
 * every other panel's caller-supplied-id convention) plus that recipient's
 * notifications, unread first, each with a "Mark read" action.
 */
export function NotificationsPanel() {
  const [recipientId, setRecipientId] = useState("")
  const [notifications, setNotifications] = useState<Notification[] | null>(null)

  const refresh = (id: string) => {
    setNotifications(id.trim().length > 0 ? listNotificationsForRecipient(id.trim()) : [])
  }

  useEffect(() => {
    setNotifications([])
  }, [])

  const handleLookup = () => refresh(recipientId)

  const handleMarkRead = (id: string) => {
    markPersistedNotificationRead(id)
    refresh(recipientId)
  }

  const unread = (notifications ?? []).filter((n) => !n.read)
  const read = (notifications ?? []).filter((n) => n.read)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          See notifications addressed to you — for example, when a teammate assigns you a prep
          note.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLookup()
          }}
          placeholder="Your contributor id…"
          className="h-9 max-w-[280px]"
        />
        <Button size="sm" variant="outline" onClick={handleLookup}>
          Show my notifications
        </Button>
      </div>

      {notifications === null ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : recipientId.trim().length === 0 ? (
        <div className="text-center text-sm text-muted-foreground">
          Enter your contributor id to see notifications addressed to you.
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground">No notifications yet.</div>
      ) : (
        <div className="space-y-6">
          {unread.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge>Unread</Badge>
                <span className="text-muted-foreground font-normal">({unread.length})</span>
              </h2>
              <div className="space-y-2">
                {unread.map((n) => (
                  <div
                    key={n.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <p className="text-foreground">{n.message}</p>
                    <Button size="sm" variant="outline" onClick={() => handleMarkRead(n.id)}>
                      Mark read
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {read.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge variant="outline">Read</Badge>
                <span className="text-muted-foreground font-normal">({read.length})</span>
              </h2>
              <div className="space-y-2">
                {read.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
                  >
                    {n.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
