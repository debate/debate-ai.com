/**
 * @fileoverview Team Collaboration Mode panel — the "(a) a collaboration-mode
 * panel UI" follow-up named under the "🤝 Team Collaboration Mode" bullet in
 * TODO.md.
 *
 * Lets a teammate submit a new `SprintNote` against a topic, then renders
 * every persisted note via `state/sprintNotes.ts`'s `buildSprintNotesPanelView`
 * grouped by topic, with a "cycle status" action (calling the already-persisted
 * `updatePersistedSprintNoteStatus`) and an "assign to" control (calling the
 * already-persisted `assignPersistedSprintNote`) per note — mirroring
 * `debate-round`'s `PrepNotesPanel` convention, since `SprintNoteStatus` shares
 * the same open/covered/needs-follow-up cycle as `PrepNoteStatus`. No new
 * note-lifecycle logic is introduced here.
 *
 * This only renders the `SprintNote` thread itself — not the full
 * `buildTopicSprint` composition (quest board + task routing + progress
 * board), since none of those inputs are persisted in a form this panel could
 * read live yet. See follow-up (b) in TODO.md.
 *
 * Each topic group also renders a live "active now" roster, backed by
 * `state/topicPresence.ts`'s heartbeat store — closing follow-up (c), "a
 * presence/live-status signal for who's currently active." There's no
 * WebSocket (or similar) transport in this repo, so a contributor marks
 * themselves active with an explicit "I'm active here" button (mirroring the
 * "no scheduled-job infrastructure" manual-trigger convention `dailyQuests.ts`
 * already uses for its own check-in action), and the roster re-evaluates
 * which heartbeats are still fresh on a periodic client-side timer so a
 * contributor who goes quiet still drops off without needing a new write.
 *
 * An optional `signedInContributorId` prop (mirroring `TaskInboxPanel`'s
 * identical convention) prefills the note form's "Author ID" and the
 * presence control's "Your ID" field's *initial* value only — never
 * overwrites a visitor's own edit, and a signed-out visitor sees the same
 * blank fields as before.
 *
 * @module panels/SprintNotesPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  assignPersistedSprintNote,
  buildSprintNotesPanelView,
  nextSprintNoteStatus,
  saveSprintNote,
  updatePersistedSprintNoteStatus,
  type SprintNotesPanelGroup,
} from "../state/sprintNotes"
import { listPersistedActiveContributors, recordPersistedPresenceHeartbeat } from "../state/topicPresence"
import { buildPresenceSummaryText, type ActiveContributor } from "../lib/topic-presence"
import type { SprintNoteStatus } from "../lib/team-collaboration-mode"

/** How often the "active now" roster re-checks for staleness, client-side only. */
const PRESENCE_REFRESH_INTERVAL_MS = 30_000

const STATUS_LABEL: Record<SprintNoteStatus, string> = {
  "needs-follow-up": "Needs follow-up",
  open: "Open",
  covered: "Covered",
}

const STATUS_VARIANT: Record<SprintNoteStatus, "default" | "secondary" | "outline"> = {
  "needs-follow-up": "default",
  open: "secondary",
  covered: "outline",
}

type NoteDraft = { topic: string; authorId: string; text: string; assignedToId: string }

const EMPTY_DRAFT: NoteDraft = { topic: "", authorId: "", text: "", assignedToId: "" }

export interface SprintNotesPanelProps {
  /**
   * A real signed-in visitor's derived contributor id (see
   * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`).
   * Prefills the note form's "Author ID" and the presence control's
   * "Your ID" field's *initial* value only — never overwrites a visitor's
   * own edit.
   */
  signedInContributorId?: string
}

/**
 * Renders the Team Collaboration Mode panel: a form to submit a new sprint
 * note against a topic, plus every persisted `SprintNote` grouped by topic,
 * with a "cycle status" action and an "assign to" control per note.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function SprintNotesPanel({ signedInContributorId }: SprintNotesPanelProps = {}) {
  const [groups, setGroups] = useState<SprintNotesPanelGroup[] | null>(null)
  const [draft, setDraft] = useState<NoteDraft>(EMPTY_DRAFT)
  const [hasEditedAuthorId, setHasEditedAuthorId] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string>>({})
  const [myId, setMyId] = useState("")
  const [hasEditedMyId, setHasEditedMyId] = useState(false)
  const [activeByTopic, setActiveByTopic] = useState<Record<string, ActiveContributor[]>>({})

  useEffect(() => {
    setGroups(buildSprintNotesPanelView())
  }, [])

  useEffect(() => {
    if (!signedInContributorId) return
    if (!hasEditedAuthorId) {
      setDraft((prev) => ({ ...prev, authorId: signedInContributorId }))
    }
    if (!hasEditedMyId) {
      setMyId(signedInContributorId)
    }
  }, [signedInContributorId, hasEditedAuthorId, hasEditedMyId])

  const refresh = () => setGroups(buildSprintNotesPanelView())

  const refreshPresence = (topics: string[]) => {
    const now = Date.now()
    setActiveByTopic(
      Object.fromEntries(topics.map((topic) => [topic, listPersistedActiveContributors(topic, now)])),
    )
  }

  useEffect(() => {
    if (!groups) return
    const topics = groups.map((group) => group.topic)
    refreshPresence(topics)
    const interval = setInterval(() => refreshPresence(topics), PRESENCE_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  const handleMarkActive = (topic: string) => {
    const contributorId = myId.trim()
    if (!contributorId) return
    recordPersistedPresenceHeartbeat(topic, contributorId, Date.now())
    refreshPresence((groups ?? []).map((group) => group.topic))
  }

  const handleSubmit = () => {
    const topic = draft.topic.trim()
    const authorId = draft.authorId.trim()
    const text = draft.text.trim()
    if (!topic || !authorId || !text) {
      setError("Topic, author ID, and note text are all required.")
      return
    }
    const assignedToId = draft.assignedToId.trim()
    saveSprintNote({
      id: `${topic}-${authorId}-${Date.now()}`,
      topic,
      authorId,
      text,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(assignedToId ? { assignedToId } : {}),
    })
    setError(null)
    setDraft(EMPTY_DRAFT)
    refresh()
  }

  const handleCycleStatus = (id: string, status: SprintNoteStatus) => {
    updatePersistedSprintNoteStatus(id, nextSprintNoteStatus(status), Date.now())
    refresh()
  }

  const handleAssign = (id: string) => {
    const assignedToId = (assigneeDrafts[id] ?? "").trim()
    assignPersistedSprintNote(id, assignedToId.length > 0 ? assignedToId : null, Date.now())
    setAssigneeDrafts((prev) => ({ ...prev, [id]: "" }))
    refresh()
  }

  if (groups === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading sprint notes…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Team Collaboration Mode</h1>
        <p className="text-sm text-muted-foreground">
          Leave live prep notes on a shared topic sprint, grouped by topic. Cycle a note's status
          or assign it to a teammate as a task.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sprint-note-topic">Topic</Label>
            <Input
              id="sprint-note-topic"
              value={draft.topic}
              onChange={(e) => setDraft((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="solvency"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sprint-note-author">Author ID</Label>
            <Input
              id="sprint-note-author"
              value={draft.authorId}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, authorId: e.target.value }))
                setHasEditedAuthorId(true)
              }}
              placeholder="alice"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sprint-note-text">Note</Label>
          <Textarea
            id="sprint-note-text"
            value={draft.text}
            onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
            placeholder="Need a 2026 solvency card for the affirmative"
            className="min-h-[72px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sprint-note-assignee">Assign to (optional)</Label>
          <Input
            id="sprint-note-assignee"
            value={draft.assignedToId}
            onChange={(e) => setDraft((prev) => ({ ...prev, assignedToId: e.target.value }))}
            placeholder="bob"
            className="max-w-[220px]"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit}>Add note</Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sprint-presence-id">Your ID (for "active now")</Label>
        <Input
          id="sprint-presence-id"
          value={myId}
          onChange={(e) => {
            setMyId(e.target.value)
            setHasEditedMyId(true)
          }}
          placeholder="alice"
          className="max-w-sm"
        />
      </div>

      {groups.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No sprint notes yet. Add one above to start a topic sprint.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const active = activeByTopic[group.topic] ?? []
            return (
              <div key={group.topic} className="rounded-lg border border-border p-4">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  {group.topic}
                  <span className="text-muted-foreground font-normal">({group.notes.length})</span>
                </h2>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {active.length === 0 ? (
                    <span>{buildPresenceSummaryText(active)}</span>
                  ) : (
                    <>
                      <span>Active now:</span>
                      {active.map((contributor) => (
                        <Badge key={contributor.contributorId} variant="secondary" className="whitespace-nowrap">
                          {contributor.contributorId}
                        </Badge>
                      ))}
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    disabled={!myId.trim()}
                    onClick={() => handleMarkActive(group.topic)}
                  >
                    I'm active here
                  </Button>
                </div>
                <div className="space-y-2">
                  {group.notes.map((note) => (
                    <div key={note.id} className="rounded-md border border-border px-3 py-2 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={STATUS_VARIANT[note.status]}>{STATUS_LABEL[note.status]}</Badge>
                          <p className="text-foreground">{note.text}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleCycleStatus(note.id, note.status)}>
                          Mark {STATUS_LABEL[nextSprintNoteStatus(note.status)].toLowerCase()}
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>by {note.authorId}</span>
                        {note.assignedToId && (
                          <Badge variant="outline" className="whitespace-nowrap">
                            assigned to {note.assignedToId}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={assigneeDrafts[note.id] ?? ""}
                          onChange={(e) =>
                            setAssigneeDrafts((prev) => ({ ...prev, [note.id]: e.target.value }))
                          }
                          placeholder="Assign to…"
                          className="h-8 max-w-[220px] text-xs"
                        />
                        <Button size="sm" variant="outline" onClick={() => handleAssign(note.id)}>
                          {note.assignedToId ? "Reassign" : "Assign"}
                        </Button>
                        {note.assignedToId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              assignPersistedSprintNote(note.id, null, Date.now())
                              refresh()
                            }}
                          >
                            Unassign
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
