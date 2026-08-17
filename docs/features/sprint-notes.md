# Sprint Notes

Lets a team see and act on every shared topic-sprint prep note in one
place — cycle a note's status (open → covered → needs follow-up → open) or
assign it to a teammate as a task.

- **Route:** `/cards/sprints`
- **Nav:** the global dock's Settings menu → **Sprint Notes**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Every persisted `SprintNote` (from `state/sprintNotes.ts`), grouped by
status (needs-follow-up first, mirroring the existing `debate-round`
`PrepNotesPanel` convention):

| Field | Source |
| --- | --- |
| Topic | `note.topic` — shown as a badge, since a sprint note is scoped to a topic sprint rather than a flow box |
| Status | `note.status` — `open` / `covered` / `needs-follow-up` |
| Cycle-status action | Advances through `open → covered → needs-follow-up → open` |
| Assignee | `note.assignedToId`, with an "Assign"/"Reassign"/"Unassign" control |

## Data flow

```
state/sprintNotes.ts (localStorage: sprintNotes)
  → buildSprintNotesPanelView()        — groups every persisted note by
                                          status, needs-follow-up first
  → panels/SprintNotesPanel.tsx        — renders it

Taking an action:
panels/SprintNotesPanel.tsx
  → updatePersistedSprintNoteStatus() / assignPersistedSprintNote()
    — state/sprintNotes.ts, applying lib/team-collaboration-mode.ts's pure
      updateSprintNoteStatus/assignSprintNote transitions against the
      stored note and saving the result
  → panel re-reads buildSprintNotesPanelView() to refresh
```

Every sprint-note lifecycle/persistence rule already existed and was
Vitest-covered (`saveSprintNote`, `updateSprintNoteStatus`,
`assignSprintNote`); this feature adds the panel-facing composition layer —
`updatePersistedSprintNoteStatus`, `assignPersistedSprintNote`,
`buildSprintNotesPanelView`, and `nextSprintNoteStatus`
(`packages/debate-card-search/src/state/sprintNotes.ts`) — mirroring
`debate-round`'s `prepNotes.ts` convention exactly. No new lifecycle logic
was introduced. Vitest-covered in
`packages/debate-card-search/test/sprintNotes.test.ts`.

## Known gaps

- Only renders each topic's `SprintNote`s — not the rest of a
  `TopicSprint` (quest board, task routing, progress board), which need
  caller-supplied quests/coverage-report/assignment inputs this panel
  doesn't yet source from a store.
- No presence/live-status signal for who's currently active on a sprint.
- No reviewer/author identity checks (no auth/roles in this repo yet), so
  any visitor can act as any assignee.
