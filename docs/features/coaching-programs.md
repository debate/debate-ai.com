# Coaching Programs

Lets a coach create a named coaching space scoped to a squad roster, and,
per roster member, link a Practice Round Simulator round so that member's
setup/feedback renders inline in the space — closing follow-up (c), "wiring
a member's Practice Round Simulator setup/feedback into the coaching
space," named under idea #13 ("Coaching Programs and Group Challenges") in
`TODO.md`'s Product Feature Ideas list.

- **Route:** `/coaching-programs`
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to create a coaching program (name + comma-separated squad roster),
plus every persisted `CoachingProgramConfig` below it. Each program renders
its roster as a list of member rows; each row has:

- a **practice round ID** field (defaulting to whatever round is already
  linked) with a **Link**/**Update** action, and an **Unlink** action once
  a round is linked;
- that member's resolved practice-round status text — the linked round's
  setup sections (speech order, judge paradigm, AI opponent) and, once
  generated, its post-round feedback, or an actionable placeholder line
  when nothing is linked yet or the linked round was since cleared;
- a link back to `/practice-round` to manage that round directly.

Removing a program also clears its members' round links.

## Data flow

```
state/coachingProgramMemberRounds.ts (localStorage: coachingProgramMemberRounds)
  → saveMemberRoundLink({ programId, memberId, roundId })
  → getMemberRoundLink(programId, memberId)
  → deleteMemberRoundLink(programId, memberId)
  → deleteMemberRoundLinksForProgram(programId)   — called when a program is removed

round/coaching-program-member-round-wiring.ts
  → buildCoachingProgramMemberRoundStatuses(program)
      resolves each roster member's MemberRoundLink, then looks up that
      roundId through the already-persisted state/practiceRounds.ts
      (getPracticeRound) — the same round a coach configures at
      /practice-round
  → buildMemberPracticeRoundStatusText(status)
      renders through practice-round-simulator.ts's own
      buildPracticeRoundSetupText/buildPracticeRoundFeedbackText rather
      than introducing a second rendering

panels/CoachingProgramsPanel.tsx
  → renders each program's roster via buildCoachingProgramMemberRoundStatuses
  → Link/Update/Unlink call saveMemberRoundLink/deleteMemberRoundLink and
    re-read the panel view to refresh
```

No new practice-round or coaching-program logic is introduced — this slice
only adds the member-to-round link store and the two-store composition that
resolves it, mirroring the existing `pre-round-briefing.ts`'s
`buildPreRoundBriefingFromStores` store-composition convention.

Vitest-covered in
`packages/debate-round/test/coachingProgramMemberRounds.test.ts` (store
CRUD, program-scoping, upsert, and bulk-delete-by-program) and
`packages/debate-round/test/coaching-program-member-round-wiring.test.ts`
(status resolution — unlinked, linked-and-found, linked-but-cleared,
program-scoped lookup — and the rendered status text for each case).

## Known gaps

This still doesn't render `buildCoachingProgramBoard`'s composed
topic-sprint/group-challenge/member-drill board — its remaining inputs
(persisted challenge win events and live topic-sprint contributions in a
form the board could read directly) aren't persisted yet. See follow-up
"(b-continued)" on idea #13 in `TODO.md`.
