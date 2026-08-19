# Coaching Programs

Lets a coach create a named group coaching space scoped to a squad roster,
and assign each roster member's already-configured [Practice Round
Simulator](practice-round-simulator.md) round to that member so its setup
and (once generated) post-round feedback render right there in the space —
idea #13 ("Coaching Programs and Group Challenges") in `TODO.md`'s Product
Feature Ideas list.

- **Route:** `/coaching-programs`
- **Nav:** the global dock's Settings menu → **Coaching Programs**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to create a coaching program (name + comma-separated squad roster),
plus every persisted `CoachingProgramConfig` below it, each with a "Remove"
action.

Inside a program's card, each roster member gets a "Practice rounds" row: an
**Assign round** control (a round-ID text field, linking to
`/practice-round` where a round is actually configured) and, once a
`roundId` is assigned and matches a persisted practice round, that round's
rendered setup text and post-round feedback text (or a "No post-round
feedback yet" placeholder). An assignment whose `roundId` doesn't match any
persisted practice round shows a "no matching practice round found" note
instead of rendering anything, rather than failing.

## Data flow

```
round/coaching-program.ts
  → buildCoachingProgramBoard(...)  — composes a program's roster with the
                                       shared topic sprint, group-challenge
                                       standings, and per-member drill sets;
                                       not yet rendered in any UI (see
                                       "Known gaps")

state/coachingPrograms.ts (localStorage: coachingPrograms)
  → buildCoachingProgramsPanelView()  — sorts every persisted
                                         CoachingProgramConfig by name

round/coaching-program-practice-rounds.ts
  → buildCoachingProgramMemberPracticeRounds(program, memberRoundIds, practiceRounds)
      — resolves a program's roster against a contributorId → roundId map
        and the practiceRounds.ts records into rendered setup/feedback text
        per member, reusing practice-round-simulator.ts's
        buildPracticeRoundSetupText/buildPracticeRoundFeedbackText directly

state/coachingProgramMemberRounds.ts (localStorage: coachingProgramMemberRounds)
  → setMemberPracticeRound(programId, contributorId, roundId)
  → clearMemberPracticeRound(programId, contributorId)
  → buildCoachingProgramMemberPracticeRoundsFromStores(program)
      — composes the persisted assignment map against the real, persisted
        state/practiceRounds.ts store

panels/CoachingProgramsPanel.tsx
  → renders programs, roster, and each member's assign-round control +
    resolved setup/feedback view
  → apps/debate-ai.com/app/coaching-programs/page.tsx  — mounts the panel
    as a route
```

## History

- `coaching-program.ts`'s `buildCoachingProgramBoard` composed a program's
  roster with `debate-card-search`'s `team-collaboration-mode.ts` topic
  sprint, `group-challenges.ts` standings, and this package's
  `flow/drill-generator.ts` per-member drill sets — the first slice, working
  entirely off caller-supplied inputs.
- `state/coachingPrograms.ts` persisted a program's config (name + roster)
  to localStorage.
- `panels/CoachingProgramsPanel.tsx` rendered a create-program form and
  every persisted program's roster at `/coaching-programs`.
- `round/coaching-program-practice-rounds.ts` and
  `state/coachingProgramMemberRounds.ts` (this slice) wired a roster
  member's Practice Round Simulator setup/feedback into the space, closing
  follow-up (c) named under idea #13 in `TODO.md`. No new practice-round
  setup/feedback composition logic was introduced — the panel reads/writes
  through the existing `state/practiceRounds.ts` store, keyed by a new,
  program-scoped `contributorId` → `roundId` assignment persisted
  separately (a practice round itself has no `contributorId` field, and one
  round could in principle be assigned to more than one member, e.g. a
  shared drill).

## Known gaps

- `buildCoachingProgramBoard`'s full composed board (shared topic sprint,
  group-challenge standings, and per-member drill sets) isn't rendered in
  any UI yet — it still needs persisted challenge win events and
  topic-sprint contributions in a form this panel could read live. Not
  started.
- No affordance to browse or search existing practice rounds when assigning
  one to a member — a coach has to already know (or copy) the `roundId`
  from `/practice-round`.
