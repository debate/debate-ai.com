/**
 * @fileoverview Collaboration Prep Room panel — the "(a) a prep-room panel
 * UI" follow-up named under the "🧑‍🤝‍🧑 Collaboration Prep Room" bullet in
 * TODO.md ("Create a shared prep space for teammates to research, draft
 * blocks, organize evidence, and coordinate assignments").
 *
 * Reads a topic's `PrepRoom` entirely from persisted stores via
 * `state/prepRooms.ts`'s `buildPersistedPrepRoom` (itself a thin
 * composition of the already-persisted evidence-library, tracked-argument-
 * checklist, and contributor-availability stores) and renders it as a
 * topic-scoped evidence/draft-block search plus the topic's routed research
 * assignments, reusing each composed slice's own search/render helper
 * directly rather than introducing new organizing logic here.
 *
 * Also renders a live "active now" roster for the open topic, backed by
 * `state/topicPresence.ts`'s heartbeat store — the same presence signal the
 * "🤝 Team Collaboration Mode" bullet's follow-up (c) closed for
 * `SprintNotesPanel.tsx`, reused here to close this bullet's own follow-up
 * (b), "a live presence/who's-active signal" (TODO.md notes the two
 * follow-ups as the same signal). See `SprintNotesPanel.tsx` for the
 * heartbeat/freshness model this reuses unchanged.
 *
 * Also renders a "Room activity timeline" below the search results — this
 * bullet's "a room activity timeline" follow-up — via `lib/prep-room.ts`'s
 * `buildPrepRoomActivityTimeline`, a read-only, newest-first list of every
 * dated evidence/draft-block submission filed under the open topic.
 *
 * An optional `signedInContributorId` prop (mirroring `ReviewQueuePanel`'s
 * identical convention) prefills the "Your ID" presence field with a real
 * signed-in visitor's derived id — a starting value only; typing over the
 * field is always respected afterward, and a signed-out visitor sees the
 * same blank field as before.
 *
 * @module panels/PrepRoomPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import { Button } from "debate-research-evidence/src/ui/primitives/button"
import { Input } from "debate-research-evidence/src/ui/primitives/input"
import { Label } from "debate-research-evidence/src/ui/primitives/label"
import { EmptyState } from "debate-research-evidence/src/ui/panels/panel-shell"
import { buildPersistedPrepRoom, listPrepRoomTopics } from "../state/prepRooms"
import { buildPrepRoomActivityTimeline, buildPrepRoomActivityEventText, buildPrepRoomSummaryText, searchPrepRoomEvidence } from "../lib/prep-room"
import type { PrepRoom } from "../lib/prep-room"
import type { EvidenceSearchResult } from "debate-research-evidence/src/lib/shared-evidence-library"
import type { CoverageLevel } from "debate-research-evidence/src/lib/topic-coverage"
import { listPersistedActiveContributors, recordPersistedPresenceHeartbeat } from "../state/topicPresence"
import { buildPresenceSummaryText, type ActiveContributor } from "../lib/topic-presence"

/** How often the "active now" roster re-checks for staleness, client-side only. */
const PRESENCE_REFRESH_INTERVAL_MS = 30_000

const LEVEL_VARIANT: Record<CoverageLevel, "default" | "secondary" | "outline"> = {
  missing: "default",
  thin: "secondary",
  covered: "outline",
}

/**
 * Renders the Collaboration Prep Room: a topic switcher, that topic's
 * evidence/draft-block search (backed by `searchPrepRoomEvidence`), and its
 * routed research assignments (backed by the room's already-composed
 * `routing` result).
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export interface PrepRoomPanelProps {
  /**
   * A real signed-in visitor's derived contributor id (see
   * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`).
   * Prefills the "Your ID" presence field's *initial* value only — never
   * overwrites a visitor's own edit.
   */
  signedInContributorId?: string
}

export function PrepRoomPanel({ signedInContributorId }: PrepRoomPanelProps = {}) {
  const [topics, setTopics] = useState<string[] | null>(null)
  const [topic, setTopic] = useState("")
  const [room, setRoom] = useState<PrepRoom | null>(null)
  const [query, setQuery] = useState("")
  const [myId, setMyId] = useState("")
  const [hasEditedMyId, setHasEditedMyId] = useState(false)
  const [active, setActive] = useState<ActiveContributor[]>([])

  useEffect(() => {
    setTopics(listPrepRoomTopics())
  }, [])

  useEffect(() => {
    if (!hasEditedMyId && signedInContributorId) {
      setMyId(signedInContributorId)
    }
  }, [signedInContributorId, hasEditedMyId])

  useEffect(() => {
    const activeTopic = topic.trim()
    setRoom(activeTopic ? buildPersistedPrepRoom(activeTopic) : null)
  }, [topic])

  const refreshPresence = (activeTopic: string) => {
    setActive(activeTopic ? listPersistedActiveContributors(activeTopic, Date.now()) : [])
  }

  useEffect(() => {
    const activeTopic = topic.trim()
    refreshPresence(activeTopic)
    if (!activeTopic) return
    const interval = setInterval(() => refreshPresence(activeTopic), PRESENCE_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic])

  const handleMarkActive = () => {
    const activeTopic = topic.trim()
    const contributorId = myId.trim()
    if (!activeTopic || !contributorId) return
    recordPersistedPresenceHeartbeat(activeTopic, contributorId, Date.now())
    refreshPresence(activeTopic)
  }

  if (topics === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading prep room…</div>
  }

  const results: EvidenceSearchResult[] = room
    ? searchPrepRoomEvidence(room, query.trim() ? { text: query.trim() } : {})
    : []
  const timeline = room ? buildPrepRoomActivityTimeline(room) : []

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Collaboration Prep Room</h1>
        <p className="text-sm text-muted-foreground">
          A topic's shared prep space: its evidence and draft blocks, plus coverage-gap research
          tasks routed to available contributors.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prep-room-topic">Topic</Label>
        <Input
          id="prep-room-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Immigration"
          className="max-w-sm"
        />
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topics.map((existing) => (
              <Button
                key={existing}
                size="sm"
                variant={existing === topic.trim() ? "default" : "outline"}
                onClick={() => setTopic(existing)}
              >
                {existing}
              </Button>
            ))}
          </div>
        )}
      </div>

      {!room ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Enter a topic above to open its prep room.
        </div>
      ) : (
        <div className="space-y-4">
          <p className="whitespace-pre-line text-sm text-muted-foreground">{buildPrepRoomSummaryText(room)}</p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
            <Input
              value={myId}
              onChange={(e) => {
                setMyId(e.target.value)
                setHasEditedMyId(true)
              }}
              placeholder="Your ID"
              className="h-6 w-28 text-xs"
            />
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={!myId.trim()} onClick={handleMarkActive}>
              I'm active here
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prep-room-search">Search this room's evidence and draft blocks</Label>
            <Input
              id="prep-room-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by keyword…"
              className="max-w-sm"
            />
          </div>

          {results.length === 0 ? (
            <EmptyState
              title={
                room.entries.length === 0
                  ? "No evidence or draft blocks filed under this topic yet."
                  : "No entries match this search."
              }
            />
          ) : (
            <div className="space-y-1.5">
              {results.map(({ entry }) => (
                <div key={entry.id} className="rounded-md border border-border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{entry.argBlock}</span>
                    <Badge variant={entry.kind === "block" ? "secondary" : "outline"}>{entry.kind}</Badge>
                    <Badge variant="outline">{entry.caseArea}</Badge>
                    {entry.cite && <span className="text-xs text-muted-foreground">{entry.cite}</span>}
                  </div>
                  {entry.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border p-4 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Routed research tasks</h2>
            {room.routing.assignments.length === 0 && room.routing.unassignedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No coverage-gap tasks routed for this topic yet.
              </p>
            ) : (
              <div className="space-y-2">
                {room.routing.assignments.map((assignment) => (
                  <div
                    key={assignment.task.argBlock}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">{assignment.task.argBlock}</span>
                    <Badge variant={LEVEL_VARIANT[assignment.task.level]}>{assignment.task.level}</Badge>
                    <span className="text-muted-foreground">assigned to</span>
                    <span className="font-medium text-foreground">{assignment.contributorId}</span>
                  </div>
                ))}
                {room.routing.unassignedTasks.map((task) => (
                  <div
                    key={task.argBlock}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">{task.argBlock}</span>
                    <Badge variant={LEVEL_VARIANT[task.level]}>{task.level}</Badge>
                    <span className="text-muted-foreground">
                      unassigned — no eligible contributor available
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Room activity timeline</h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {room.entries.length === 0
                  ? "No activity yet — evidence and draft blocks filed under this topic will show up here."
                  : "This topic's entries predate activity tracking, so there's nothing dated to show."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {timeline.map((event) => (
                  <li
                    key={event.entry.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                  >
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatActivityTimestamp(event.atMs)}
                    </span>
                    <span className="text-foreground">{buildPrepRoomActivityEventText(event)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatActivityTimestamp(atMs: number): string {
  return new Date(atMs).toLocaleString()
}
