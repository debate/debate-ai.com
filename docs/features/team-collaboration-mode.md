# Team Collaboration Mode

Lets a teammate leave a live prep note against a shared topic sprint, and
shows every persisted `SprintNote` grouped by topic, with a "cycle status"
action and an "assign to" control per note — mirroring `debate-round`'s
Prep Notes panel, since `SprintNoteStatus` shares the same open/covered/
needs-follow-up cycle as `PrepNoteStatus`.

- **Route:** `/cards/collaboration`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t collaboration` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

A form to add a note (topic, author ID, note text, optional assignee), then
every persisted note grouped into its topic, each group in first-seen order
across the stored notes and each topic's notes oldest first. Each note shows
its status badge, text, author, current assignee (if any), a "Mark &lt;next
status&gt;" button, and an "Assign to" input + button (plus an "Unassign"
button once a note is assigned).

| Status | Meaning |
| --- | --- |
| Open | The note hasn't been marked covered or flagged for follow-up |
| Covered | The topic this note is about has been addressed |
| Needs follow-up | The topic this note is about still needs work |

## Data flow

```
state/sprintNotes.ts (localStorage: sprintNotes)
  → buildSprintNotesPanelView()                — groups every persisted
                                                   SprintNote by topic,
                                                   each group oldest first
  → panels/SprintNotesPanel.tsx                — renders the form + grouped list
  → apps/debate-ai.com/app/cards/collaboration/page.tsx  — mounts the panel as a route

Adding a note:
panels/SprintNotesPanel.tsx
  → saveSprintNote(note)                       — state/sprintNotes.ts
  → panel re-reads buildSprintNotesPanelView() to refresh

Cycling a note's status:
panels/SprintNotesPanel.tsx
  → nextSprintNoteStatus(status)                       — state/sprintNotes.ts
      (open → covered → needs-follow-up → open)
  → updatePersistedSprintNoteStatus(id, next, now)      — state/sprintNotes.ts
      (applies lib/team-collaboration-mode.ts's updateSprintNoteStatus and saves it)
  → panel re-reads buildSprintNotesPanelView() to refresh

Assigning/unassigning a note:
panels/SprintNotesPanel.tsx
  → assignPersistedSprintNote(id, assignedToId | null, now)  — state/sprintNotes.ts
      (applies lib/team-collaboration-mode.ts's assignSprintNote and saves it)
  → panel re-reads buildSprintNotesPanelView() to refresh

Presence ("active now"):
state/topicPresence.ts (localStorage: topicPresenceHeartbeats)
  → listPersistedActiveContributors(topic, now)  — every topic group polls this
                                                     on mount and every 30s
  → panels/SprintNotesPanel.tsx                  — renders each topic's fresh
                                                     roster as badges

Marking yourself active:
panels/SprintNotesPanel.tsx ("I'm active here" button, per topic group)
  → recordPersistedPresenceHeartbeat(topic, myId, now)  — state/topicPresence.ts
      (applies lib/topic-presence.ts's recordPresenceHeartbeat upsert and saves it)
  → panel re-reads listPersistedActiveContributors(topic, now) to refresh
```

This closes follow-up (a), "a collaboration-mode panel UI," named under the
"🤝 Team Collaboration Mode" bullet in `TODO.md`, adding four small helpers to
`state/sprintNotes.ts` — `buildSprintNotesPanelView` (groups the persisted
notes by topic for the panel), `nextSprintNoteStatus` (the panel's
status-cycle order), and `updatePersistedSprintNoteStatus`/
`assignPersistedSprintNote` (apply-and-save the already-existing
`updateSprintNoteStatus`/`assignSprintNote` pure transitions) — rather than
introducing new note-lifecycle logic. Vitest-covered in
`packages/debate-card-search/test/sprintNotes.test.ts`.

A later slice closes follow-up (c), "a presence/live-status signal for who's
currently active." There's no WebSocket (or similar) live transport
anywhere in this repo, so presence is modeled as an explicit,
caller-recorded heartbeat rather than a push signal: `lib/topic-presence.ts`
adds a `PresenceHeartbeat` model (one heartbeat per topic + contributor
pair, upserted by `recordPresenceHeartbeat`) and `listActiveContributors`,
which treats a contributor as active only while their most recent heartbeat
for that topic is within a freshness window (5 minutes by default). Its
`state/topicPresence.ts` persists heartbeats to localStorage under
`topicPresenceHeartbeats`, mirroring the `sprintNotes.ts` persistence
convention. `SprintNotesPanel.tsx` renders each topic group's live "active
now" roster (badges, most-recently-active first, or "No one active right
now.") and gives a contributor a "Your ID" field plus an "I'm active here"
button per topic to record their own heartbeat; every topic's roster
re-evaluates staleness on a 30-second client-side timer even without a new
heartbeat, so someone who goes quiet drops off the list. Vitest-covered in
`packages/debate-card-search/test/topic-presence.test.ts` (the pure
heartbeat/freshness logic) and `test/topicPresence.test.ts` (the persisted
store). No follow-ups remain open on this bullet.

A later slice closes follow-up (b), "persisting a topic sprint's other
inputs (so the full `buildTopicSprint` composition can be rendered, not just
the note thread)." `SprintNotesPanel` above still only renders the note
thread — the full composition lives in a separate, already-existing
`panels/TopicSprintPanel.tsx` (quest board, task routing, progress board,
and notes in one view), which previously required its caller to hand-supply
`quests`/`contributions`/`coverageReport`/`assignments` (only `contributors`
and `notes` already defaulted to persisted state). `state/topicSprints.ts`
adds `readPersistedTopicSprintInputs`/`buildPersistedTopicSprint`, composing
every one of those six inputs from its own already-persisted store —
`state/dailyQuests.ts` (quest templates), `state/contributions.ts`
(timestamped contributions), `state/trackedArguments.ts`'s
`buildPersistedTopicCoverageReport` (the topic's live coverage report),
`state/contributorAvailability.ts`, a new `state/researchProgress.ts`
`listTrackedAssignmentsForTopic` (this topic's completed-plus-still-active
assignments, scoped down from the same completed-task history and routed
queues `buildPersistedResearchProgressBoard` already reads across every
topic), and `state/sprintNotes.ts` — rather than requiring a caller to
assemble them, mirroring `state/prepRooms.ts`'s `buildPersistedPrepRoom`
"compose every input from its own store" convention. `TopicSprintPanel` now
makes those four props optional, re-reading `readPersistedTopicSprintInputs`
whenever its `topic` prop changes and falling back to it for any prop the
caller doesn't override; `ResearchHub.tsx`'s Sprint tab (the panel's only
current caller) now just passes a `topic`, having previously hand-derived a
coverage report from the evidence library and always passed `contributions:
[]`. Vitest-covered in `packages/debate-card-search/test/topicSprints.test.ts`
(each input read individually, plus an end-to-end composed sprint) and a new
`listTrackedAssignmentsForTopic` describe block in `test/researchProgress.test.ts`.
`sprint.routing` itself is unchanged: it's still a *live* re-route of the
topic's current coverage gaps against current contributor availability
(`buildRoutingResult`), not a readback of whatever was last routed and saved
to `routedTaskQueues.ts` — only `sprint.progressBoard` reads the persisted
routed/completed assignments. No follow-ups remain open on this bullet.

A later slice adds a signed-in prefill (mirroring [Task Inbox](./task-inbox.md)'s
identical convention) for this panel's two free-form id fields:

```
components/research/SprintNotesWithIdentity.tsx  — "use client" wrapper
  → useSession()                          — lib/hooks/useSession.ts, the
                                              better-auth React session hook
  → deriveContributorIdFromSessionIdentity(user)
      — debate-card-search's lib/session-identity.ts: name, else the
        email's local part, else the raw account id, else ""
  → <SprintNotesPanel signedInContributorId={...} />
      — seeds the note form's "Author ID" initial value only; a visitor who
        edits it (hasEditedAuthorId) keeps their own typed value from then on
      — seeds the presence control's "Your ID" field the same way
        (hasEditedMyId)
```

`apps/debate-ai.com/app/cards/collaboration/page.tsx` and `ResearchHub.tsx`'s
Sprint tab now mount this wrapper instead of the bare panel; a signed-out
visitor sees the exact same blank fields as before.

A later slice closes the one remaining unprefilled "my id" field on this
tab: `ResearchHub.tsx`'s own "Your contributor id" field (the hub-level
input that feeds `panels/TopicSprintPanel.tsx`'s `authorId` prop — a
*different* field from `SprintNotesWithIdentity`'s "Author ID"/"Your ID"
above, since `TopicSprintPanel` and `SprintNotesPanel` are two separate
components sharing the tab). `ResearchHub.tsx` now calls `useSession()`
and `deriveContributorIdFromSessionIdentity(user)` directly (it's already
an app-level component, so no separate `*WithIdentity` wrapper was
needed) and seeds the field's initial value from it — but only when the
field has no previously-saved `localStorage` value and hasn't been
hand-edited yet this session, mirroring every other slice's prefill-only
behavior. A signed-out visitor still sees the field default to `"me"`.

## Cross-tab live update

`TopicSprintPanel` previously read `readPersistedTopicSprintInputs`/
`listSprintNotes` on mount only (and again whenever its `topic` prop
changed), so a teammate's quest, contribution, tracked argument, coverage
entry, availability change, routed/completed task, or sprint note in another
browser tab left the panel showing a stale snapshot until something else
forced a re-render. It now also subscribes to the browser's `storage`
event, which the spec fires only in *other* same-origin tabs/windows, never
the one that made the write. A new pure helper,
`state/live-update.ts`'s `isTopicSprintLiveUpdateStorageEvent`, checks
whether the event's `key` is one of the eight stores
`readPersistedTopicSprintInputs` composes (`dailyQuestTemplates`,
`contributions`, `trackedArguments`, `evidenceLibraryEntries`,
`contributorAvailability`, `completedResearchTasks`, `routedTaskQueues`,
`sprintNotes`) or `null` (a `localStorage.clear()`); when it is, the
listener re-reads `readPersistedTopicSprintInputs(topic)` and the panel's
own `useStoreSnapshot`-backed notes read, mirroring `DailyQuestsPanel`'s
identical `[topic]`-dependent listener (re-registered with a fresh closure
whenever `topic` changes, rather than refreshing a stale topic's inputs).
This closes the matching entry in
[`shared-flow-sync.md`](shared-flow-sync.md)'s Known gap: "every other
localStorage-backed panel in this repo still has no cross-tab live-update
mechanism." Vitest-covered in
`packages/debate-card-search/test/live-update.test.ts` (every backing-key
match, the `null`-key clear-all case, two unrelated keys, and two
same-prefix substring keys). `TopicSprintPanel.tsx`'s own `storage`-listener
wiring remains intentionally untested, matching every other panel in this
repo whose wiring is exercised only through the shared pure predicate's own
tests.

A later slice closes the "an end-of-sprint retrospective summary" follow-up
named under the "🤝 Team Collaboration Mode" bullet in `TODO.md`.
`lib/team-collaboration-mode.ts` adds `buildSprintRetrospective(sprint)`, a
pure derivation off an already-composed `TopicSprint` (no new persistence):
how many quests finished (`questsCompleted`/`questsTotal`), how the topic's
tasks landed (`tasksAssigned`/`tasksUnassigned` from `sprint.routing`,
`tasksCompletedByTeam` summed across `sprint.progressBoard`), how many
contributors were active, and how the sprint's notes resolved
(`notesCovered`/`notesOpen`/`notesNeedFollowUp`), plus the oldest still-open
follow-up notes (capped to 5, oldest first) that would carry into the next
sprint. `buildSprintRetrospectiveText`/`sprintRetrospectiveFilename` render
it as a downloadable plain-text file, mirroring
`research-progress.ts`'s `buildResearchProgressReportText` report-download
convention. `TopicSprintPanel.tsx` gained an "End-of-sprint retrospective"
section below the note wall — a stat row (quests complete, tasks completed,
tasks unassigned, notes covered) plus a "Carrying into the next sprint"
list, with a "Download retrospective" button using the same anchor+Blob
pattern as `ResearchProgressPanel.tsx`'s "Download report" action.
Vitest-covered in `packages/debate-team-collaboration/test/team-collaboration-mode.test.ts`
(`buildSprintRetrospective`'s composed counts, an all-zero empty sprint, the
covered-vs-open note split, and the 5-note carry-over cap;
`buildSprintRetrospectiveText`'s rendered lines with and without a
carry-over section; `sprintRetrospectiveFilename`'s slugging, including a
blank/punctuation-only topic falling back to `"topic"`).

## Known gaps

- All three id fields on this tab ("Author ID" and "Your ID" on
  `SprintNotesPanel`, plus `ResearchHub`'s own "Your contributor id" that
  feeds `TopicSprintPanel`) are still free-form text, not a login — a real
  signed-in session only *prefills* their initial value (see "Signed-in
  prefill" above), so a visitor can still overwrite any of them. There is
  no server-side session check on `saveSprintNote`/
  `recordPersistedPresenceHeartbeat`/`createSprintNote` (via
  `TopicSprintPanel`'s note form), the same trust boundary every other
  localStorage-backed action in this repo has.
