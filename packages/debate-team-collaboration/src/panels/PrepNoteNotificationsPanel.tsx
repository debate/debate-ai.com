/**
 * @fileoverview Notifications panel — closes the "an assignee notification"
 * follow-up (b) and the later "a digest notification instead of one per
 * assignment" follow-up, both named under the "🔄 Strategy Sync Notes"
 * bullet in TODO.md.
 *
 * Reads a recipient's persisted notifications via
 * `state/prepNoteNotifications.ts`'s `buildNotificationDigestView`, which
 * groups them into one digest card per UTC calendar day instead of a flat
 * per-notification list, newest day first. Each digest card has a "Mark all
 * read" bulk action and an "Expand" toggle revealing its individual
 * notifications (each still with its own "Mark read"). There is no
 * auth/identity system in this repo yet, so the panel asks for a free-form
 * recipient id the same way `PrepNotesPanel`'s "Assign to" field does.
 *
 * @module panels/PrepNoteNotificationsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-round/src/ui/primitives/badge"
import { Button } from "debate-round/src/ui/primitives/button"
import { Input } from "debate-round/src/ui/primitives/input"
import { EmptyState, PanelRow } from "debate-round/src/ui/panels/panel-shell"
import {
  buildNotificationDigestView,
  markManyPersistedNotificationsRead,
  markPersistedNotificationRead,
} from "../state/prepNoteNotifications"
import { isPrepNoteNotificationsLiveUpdateStorageEvent } from "debate-round/src/flow/live-update"
import { buildDigestGroupHeading, type NotificationDigestGroup } from "../flow/prep-note-notifications"

const RECIPIENT_STORAGE_KEY = "prepNoteNotifications:lastRecipientId"

function readLastRecipientId(): string {
  if (typeof localStorage === "undefined") return ""
  return localStorage.getItem(RECIPIENT_STORAGE_KEY) ?? ""
}

/**
 * Renders the Notifications panel: a recipient-id lookup plus every
 * persisted `PrepNoteNotification` addressed to that recipient, grouped
 * into one digest card per UTC calendar day (newest first), each
 * expandable to its individual assignments.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function PrepNoteNotificationsPanel() {
  const [recipientId, setRecipientId] = useState("")
  const [digestGroups, setDigestGroups] = useState<NotificationDigestGroup[] | null>(null)
  const [expandedDayKeys, setExpandedDayKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    const lastRecipientId = readLastRecipientId()
    setRecipientId(lastRecipientId)
    setDigestGroups(lastRecipientId ? buildNotificationDigestView(lastRecipientId) : [])
  }, [])

  const refresh = (id: string) => setDigestGroups(buildNotificationDigestView(id))

  const toggleExpanded = (dayKey: string) => {
    setExpandedDayKeys((prev) => {
      const next = new Set(prev)
      if (next.has(dayKey)) {
        next.delete(dayKey)
      } else {
        next.add(dayKey)
      }
      return next
    })
  }

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

  const handleMarkGroupRead = (group: NotificationDigestGroup) => {
    markManyPersistedNotificationsRead(group.notifications.map((notification) => notification.id))
    refresh(recipientId.trim())
  }

  const unreadCount = (digestGroups ?? []).reduce((total, group) => total + group.unreadCount, 0)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Assignee notifications for prep notes handed off to you as a task, grouped into one digest per day.
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
        {digestGroups !== null && (
          <Badge variant={unreadCount > 0 ? "default" : "outline"}>{unreadCount} unread</Badge>
        )}
      </div>
      {digestGroups === null ? (
        <div className="p-6 text-sm text-muted-foreground">Loading notifications…</div>
      ) : digestGroups.length === 0 ? (
        <EmptyState
          title="No notifications for this id yet."
          message="You'll see one here whenever a prep note is assigned to you."
        />
      ) : (
        <div className="space-y-3">
          {digestGroups.map((group) => {
            const expanded = expandedDayKeys.has(group.dayKey)
            return (
              <div key={group.dayKey} className="rounded-md border border-border">
                <PanelRow
                  title={buildDigestGroupHeading(group)}
                  subtitle={`Notifications from ${group.dayKey}`}
                  trailing={
                    <>
                      {group.unreadCount > 0 && (
                        <Button size="sm" variant="outline" onClick={() => handleMarkGroupRead(group)}>
                          Mark all read
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => toggleExpanded(group.dayKey)}>
                        {expanded ? "Collapse" : `Expand (${group.notifications.length})`}
                      </Button>
                    </>
                  }
                />
                {expanded && (
                  <div className="space-y-2 border-t border-border p-2">
                    {group.notifications.map((notification) => (
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
          })}
        </div>
      )}
    </div>
  )
}
