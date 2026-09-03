/**
 * @fileoverview Notifications panel — closes the "an assignee notification"
 * follow-up (b) named under the "🔄 Strategy Sync Notes" bullet in TODO.md.
 *
 * Reads a recipient's persisted notifications via
 * `state/prepNoteNotifications.ts`'s `buildNotificationsPanelView` and
 * renders them newest first, with a "Mark read" action per notification
 * that calls the already-persisted `markPersistedNotificationRead` — no new
 * mutation logic is introduced here. There is no auth/identity system in
 * this repo yet, so the panel asks for a free-form recipient id the same
 * way `PrepNotesPanel`'s "Assign to" field does.
 *
 * @module panels/PrepNoteNotificationsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { EmptyState, PanelRow } from "debate-ui/src/panels/panel-shell"
import {
  buildNotificationsPanelView,
  markPersistedNotificationRead,
} from "../state/prepNoteNotifications"
import { isPrepNoteNotificationsLiveUpdateStorageEvent } from "../flow/live-update"
import type { PrepNoteNotification } from "../flow/prep-note-notifications"

const RECIPIENT_STORAGE_KEY = "prepNoteNotifications:lastRecipientId"

function readLastRecipientId(): string {
  if (typeof localStorage === "undefined") return ""
  return localStorage.getItem(RECIPIENT_STORAGE_KEY) ?? ""
}

/**
 * Renders the Notifications panel: a recipient-id lookup plus every
 * persisted `PrepNoteNotification` addressed to that recipient, newest
 * first, with a "Mark read" action per unread notification.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function PrepNoteNotificationsPanel() {
  const [recipientId, setRecipientId] = useState("")
  const [notifications, setNotifications] = useState<PrepNoteNotification[] | null>(null)

  useEffect(() => {
    const lastRecipientId = readLastRecipientId()
    setRecipientId(lastRecipientId)
    setNotifications(lastRecipientId ? buildNotificationsPanelView(lastRecipientId) : [])
  }, [])

  const refresh = (id: string) => setNotifications(buildNotificationsPanelView(id))

  /**
   * Live-update this recipient's notifications when another browser tab
   * assigns a prep note to them (or marks one of their notifications read)
   * while this tab is open — the `storage` event never fires in the tab
   * that made the write, only in other same-origin tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isPrepNoteNotificationsLiveUpdateStorageEvent(event)) return
      refresh(recipientId.trim())
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientId])

  const handleLookup = () => {
    const trimmed = recipientId.trim()
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(RECIPIENT_STORAGE_KEY, trimmed)
    }
    refresh(trimmed)
  }

  const handleMarkRead = (id: string) => {
    markPersistedNotificationRead(id)
    refresh(recipientId.trim())
  }

  const unreadCount = (notifications ?? []).filter((notification) => !notification.read).length

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Assignee notifications for prep notes handed off to you as a task.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLookup()
          }}
          placeholder="Your teammate id…"
          className="h-9 max-w-[240px]"
        />
        <Button size="sm" variant="outline" onClick={handleLookup}>
          Look up
        </Button>
        {notifications !== null && (
          <Badge variant={unreadCount > 0 ? "default" : "outline"}>{unreadCount} unread</Badge>
        )}
      </div>
      {notifications === null ? (
        <div className="p-6 text-sm text-muted-foreground">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications for this id yet."
          message="You'll see one here whenever a prep note is assigned to you."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <PanelRow
              key={notification.id}
              title={`Assigned: "${notification.noteText}"`}
              subtitle={`from a note by ${notification.noteAuthorId}`}
              trailing={
                notification.read ? (
                  <Badge variant="outline">Read</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleMarkRead(notification.id)}>
                    Mark read
                  </Button>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
