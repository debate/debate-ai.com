# CLAUDE.md — `debate-team-collaboration`

Private. Team prep and collaboration: task inbox, prep room, topic sprints, team
brainstorm assist, group challenges, research-progress tracking, sprint notes,
and — moved here from `debate-round` — **prep notes** and account/prep-note
notifications. Entry `src/index.ts`, tests in `test/`.

## Where it sits

Split out of the old `debate-card-search` and `debate-round`, and depends on
**`debate-search-evidence`** and **`debate-round`**. Both are upstream: a break
here often starts there.

Note the split is recent enough that prep notes have a foot in both camps —
`debate-round` still exports the roster panels that *render* persisted prep
records. Check both packages before moving prep-note behaviour again.

## Rules

- **Team data is shared data.** A prep room, a task inbox and sprint notes are
  visible to teammates by construction. Never widen a sharing default, never
  surface one team's prep to another, and treat "who can see this" as part of
  every feature, not a follow-up.
- Users include minors; notifications carry names and activity. Don't add a
  notification that leaks content the recipient shouldn't see.
- Real-time-ish surfaces (prep room, task inbox) must degrade to a plain reload.
  Nothing should require a live connection to be usable.
