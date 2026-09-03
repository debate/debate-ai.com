# AI Coach Mode

Shows every persisted "AI Coach Mode" coaching session, grouped by round +
side — extension, refutation, collapse, and weighing prompts derived from
that round's flow — with a "Clear" action per session and a "Get AI
feedback" action that requests open-ended AI coaching feedback expanding on
those template prompts.

- **Route:** `/coaching`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t coach` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Each persisted `CoachingSessionRecord` (keyed by `roundId` + the side the
session was generated for) renders as its own card, sorted by `roundId` then
`sideKey` for a stable order. Inside a card, every prompt shows a kind badge
and its text:

| Kind | Meaning |
| --- | --- |
| Extension | One of the side's own arguments currently stands unanswered — extend it as dropped/conceded |
| Refutation | An opposing argument currently stands unanswered — answer it before it's extended |
| Collapse | One of the most vulnerable opposing arguments to recommend collapsing the round onto |
| Weighing | A whole-round weighing angle based on which side currently looks more exposed |

Below the template prompts, an **AI feedback** section shows either the
side's already-generated open-ended feedback, or a "Get AI feedback" button
if none has been generated (or generation failed) yet. The button text
changes to "Regenerate AI feedback" once feedback exists.

A **Generate coaching session for current round** form at the top of the
panel lets a user derive and persist a new session for a side directly from
the round workspace's currently selected flow — the button is disabled with
an inline hint when no flow is currently selected.

Each session card also has a **Download** action that saves the session —
its template prompts plus its AI feedback, if generated — as a plain-text
coaching-notes document, for offline use or sharing outside the app.

## Data flow

```
state/coachingSessions.ts (localStorage: coachingSessions)
  → buildCoachingSessionsPanelView()   — sorts every persisted
                                          CoachingSessionRecord by roundId
                                          then sideKey
  → panels/CoachingSessionsPanel.tsx   — renders it, grouped by round + side
  → apps/debate-ai.com/app/coaching/page.tsx  — mounts the panel as a route

Generating a coaching session for the current round:
panels/CoachingSessionsPanel.tsx
  → reads the round workspace's currently selected flow (state/store.ts's
    useFlowStore)
  → buildAndSaveCoachingSession(flow, roundId, sideKey)  — state/coachingSessions.ts,
    composing flow/coach-mode.ts's buildCoachingSession + saveCoachingSession
  → panel re-reads buildCoachingSessionsPanelView() to refresh

Clearing a round+side's coaching session:
panels/CoachingSessionsPanel.tsx
  → deleteCoachingSession(roundId, sideKey)  — state/coachingSessions.ts
  → panel re-reads buildCoachingSessionsPanelView() to refresh

Downloading a session's coaching notes:
panels/CoachingSessionsPanel.tsx
  → buildCoachingNotesText(session)    — state/coachingSessions.ts, composing
                                          buildCoachingSummaryText plus an
                                          "AI Feedback" section when present
  → coachingNotesFilename(roundId, sideKey)  — state/coachingSessions.ts
  → anchor+Blob download, mirroring PreRoundBriefingsPanel.tsx's pattern

Posting a freshly generated session to the News Stream:
state/coachingSessions.ts
  → coachingSessionNews()              — every session that carries a createdAt
                                          (stamped by buildAndSaveCoachingSession)
                                          becomes a "community" NewsItem
  → apps/debate-ai.com/app/news/NewsPageContent.tsx — passes the result as
                                          NewsStreamPanel's extraItems prop
                                          (see news-stream.md — this package
                                          already depends on debate-card-search,
                                          so the news source lives here rather
                                          than in that package)

Getting AI coaching feedback for a session:
panels/CoachingSessionsPanel.tsx
  → requestCoachFeedback({ sideKey, prompts })  — round/coach-feedback-client.ts
    → buildCoachFeedbackAiUserPrompt(...)       — round/coach-feedback-ai.ts,
                                                   renders the session's own
                                                   prompts via
                                                   flow/coach-mode.ts's
                                                   buildCoachingSummaryText
    → POST /api/reason-ai                       — existing Anthropic proxy
    → parseCoachFeedbackAiResponse(...)          — strips a wrapping code fence
  → saveCoachingSessionAiFeedback(roundId, sideKey, feedback)  — state/coachingSessions.ts
  → panel re-reads buildCoachingSessionsPanelView() to refresh
```

Every coaching-prompt generation and persistence rule already existed and
was Vitest-covered; the panel itself closed follow-up (b), "a
coaching-panel UI that reads/writes through the persistence store," named
under the "🎙️ AI Coach Mode" bullet in `TODO.md`, adding one small helper
to `state/coachingSessions.ts` — `buildCoachingSessionsPanelView`, which
sorts `listCoachingSessions`'s output for a stable panel display order.
A later slice closed follow-up (a), "an actual AI coaching call for
open-ended feedback beyond this deterministic template layer": a new
`round/coach-feedback-ai.ts` (prompt-building + tolerant response parsing,
mirroring `debate-speech-writer`'s `coach/team-coach-ai.ts` free-form-text
split rather than `round/judge-decision-ai.ts`'s structured-JSON split,
since open-ended feedback is prose) and `round/coach-feedback-client.ts`
(the `/api/reason-ai` fetch client, mirroring `coach/team-coach-client.ts`)
compose the session's own already-generated template prompts — via the
existing `buildCoachingSummaryText` — into a coaching-feedback request; no
new coaching-prompt derivation logic was introduced. `CoachingSessionRecord`
gained an additive, optional `aiFeedback` field (existing records without
it stay valid), set through a new `saveCoachingSessionAiFeedback` helper
that leaves a session's `prompts` untouched. No follow-ups remain open on
this bullet. Vitest-covered in
`packages/debate-round/test/coach-feedback-ai.test.ts`,
`packages/debate-round/test/coach-feedback-client.test.ts` (`fetch` mocked
via `vi.stubGlobal`, covering the success path, an endpoint override, a
server error message, a non-JSON error body, and an empty/unusable AI
reply), and `packages/debate-round/test/coachingSessions.test.ts` (the new
`saveCoachingSessionAiFeedback` helper). A later slice added a "Generate
coaching session for current round" form to `CoachingSessionsPanel.tsx`,
reading the round workspace's currently selected flow
(`state/store.ts`'s `useFlowStore`, the same mechanism `DrillSetsPanel`'s
analogous form uses) and deriving/persisting that round+side's session via
a new `buildAndSaveCoachingSession` helper in `state/coachingSessions.ts`
(composing the existing `buildCoachingSession` + `saveCoachingSession`,
mirroring `drillSets.ts`'s `buildAndSaveDrillSet`), closing the "no
affordance in this panel to generate a new coaching session for a round"
gap below. No follow-ups remain open on this bullet. Vitest-covered in
`packages/debate-round/test/coachingSessions.test.ts` (deriving and
persisting a session from a flow, overwriting an existing record for the
same round+side pair, keeping sessions for different sides of the same
round distinct, and `collapseLimit` passing through to
`buildCoachingSession`).

A later slice, `coachingSessionNews()` in `state/coachingSessions.ts`,
closed the "a coaching session" half of `docs/features/news-stream.md`'s
Known gap: a `CoachingSessionRecord` gained an additive, optional
`createdAt` field, stamped by `buildAndSaveCoachingSession` on generation
(existing records without it are silently excluded rather than backdated,
mirroring `evidenceLibraryEntries.ts`'s `argumentLibraryNews()`
convention), and `coachingSessionNews()` maps every session that carries
one straight to a News Stream `NewsItem`. Since `debate-card-search` (where
News Stream's other sources live) can't depend back on this package, this
helper is composed into the feed at the app layer instead — see
`news-stream.md`'s "Data flow" for the full path. No follow-ups remain open
on this bullet. Vitest-covered in
`packages/debate-round/test/coachingSessions.test.ts`.

A later slice added the **Download** action described above: a new
`buildCoachingNotesText`/`coachingNotesFilename` pair in
`state/coachingSessions.ts` — closing the "an exportable coaching-notes
document" follow-up named under the "🎙️ AI Coach Mode" bullet in
`TODO.md`. `buildCoachingNotesText` headers the already-existing
`buildCoachingSummaryText` rendering with the round id and side, and
appends the session's `aiFeedback` as its own section when one has been
generated; `coachingNotesFilename` mirrors
`pre-round-briefing.ts#preRoundBriefingFilename`'s exact sanitization rule.
No new coaching-prompt derivation or persistence logic was introduced. No
follow-ups remain open on this bullet. Vitest-covered in
`packages/debate-round/test/coachingSessions.test.ts` (the notes header,
prompts rendering, the AI-feedback section present/absent, the
no-prompts placeholder, and the filename sanitization rule).

A later slice added a **History** timeline per session — the "a
coaching-session history timeline per round" follow-up named under the
"🎙️ AI Coach Mode" bullet in TODO.md. `state/coachingSessions.ts`'s
`saveCoachingSession` now snapshots the record it's about to overwrite into
a new `state/coachingSessionHistory.ts` before replacing it (mirroring
`debate-speech-writer`'s `state/coachMaterialVersions.ts` pattern exactly:
same snapshot-on-overwrite shape, same per-pair cap of 10 versions), so
regenerating a round+side's session (via the panel's "Generate coaching
session for current round" form, or a manual `saveCoachingSession` call)
never silently loses the version it replaces. `CoachingSessionsPanel.tsx`
gained a "History" toggle per session listing every snapshot for that
round+side, newest first, each with a "Restore this version" action that
saves it back as the current session (itself snapshotting whatever was
current at the time, so restoring is reversible too). `deleteCoachingSession`
("Clear") now also clears that pair's whole snapshot history, so a cleared
session doesn't leave orphaned history behind. No account sync exists for
this history yet, matching the base session store's own local-only state.
See "History" in `panels/CoachingSessionsPanel.tsx`'s doc comment.

## Data flow (history)

```
Regenerating/saving a round+side's session:
state/coachingSessions.ts's saveCoachingSession(record)
  → if an existing record for that roundId+sideKey pair is found:
      appendCoachingSessionVersion(existing)  — state/coachingSessionHistory.ts,
        snapshots it, trimming the oldest snapshot past the 10-per-pair cap
  → overwrites the current record, returns { record, version? }

Viewing/restoring history:
panels/CoachingSessionsPanel.tsx ("History" toggle)
  → listVersionsForCoachingSession(roundId, sideKey)  — newest first
  → "Restore this version"
      → coachingSessionFromVersion(entry)  — rebuilds a session shape
      → saveCoachingSession(...)           — snapshots the version being
                                              replaced, same as any other save
  → panel re-reads buildCoachingSessionsPanelView() and the version list to refresh

Clearing a round+side's session:
panels/CoachingSessionsPanel.tsx ("Clear")
  → deleteCoachingSession(roundId, sideKey)  — state/coachingSessions.ts,
    also calls deleteVersionsForCoachingSession(roundId, sideKey)
```

A later slice added a **Compare two sessions** section — the "a side-by-side
comparison across two rounds" follow-up named under the "🎙️ AI Coach Mode"
bullet in TODO.md, the last one open once the History timeline shipped. A
new `state/coachingSessions.ts#buildCoachingSessionComparison` groups two
already-persisted sessions' prompts by kind (extension/refutation/collapse/
weighing) into rows so a comparison view can render matching kinds next to
each other, regardless of the order either session's own prompts are stored
in; it works for two sides of the same round or two different rounds
equally, since no relationship between the two sessions is assumed. The
panel gained two "Session" dropdowns (only shown once at least two sessions
are persisted) and a "Compare" button rendering the result as a two-column
grid, one row per prompt kind, plus a "Download comparison" action — a new
`buildCoachingSessionComparisonText`/`coachingSessionComparisonFilename`
pair mirroring `buildCoachingNotesText`/`coachingNotesFilename`'s heading
and sanitization rules. No new coaching-prompt derivation logic was
introduced.

## Data flow (comparison)

```
panels/CoachingSessionsPanel.tsx ("Compare" button)
  → buildCoachingSessionComparison(sessionA, sessionB)  — state/coachingSessions.ts,
    groups each session's prompts by kind into { kind, a, b } rows
  → renders a two-column grid, one row per kind (extension/refutation/collapse/weighing)

Downloading a comparison:
panels/CoachingSessionsPanel.tsx ("Download comparison")
  → buildCoachingSessionComparisonText(comparison)  — state/coachingSessions.ts
  → coachingSessionComparisonFilename(a, b)          — state/coachingSessions.ts
  → anchor+Blob download, mirroring the per-session Download action's pattern
```

## Known gaps

None open.
