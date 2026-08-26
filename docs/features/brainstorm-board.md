# Team Brainstorm Assist

Lets a squad submit, AI-generate, and upvote brainstorm ideas against an
argument block, grouped into boards by category (new arguments, impact
framing, frontline answers, responses & turns), each board ranked by
popularity with a near-duplicate badge.

A topic switcher can also seed boards straight from the Topic Coverage
Dashboard's under-covered arguments, so a board's prompt is visible before
anyone has submitted an idea to it.

- **Route:** `/cards/brainstorm`
- **Nav:** the global dock's Settings menu → **Team Brainstorm Assist**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

An optional topic switcher, a submission form (argument block, contributor
ID, category, idea text), and every board, sorted by argument block then
category. With no topic chosen, "every board" means every board that has at
least one submitted idea (the original behavior). Choosing a tracked topic
(via the Topic Coverage Dashboard's checklist) swaps in one board per
under-covered tracked argument/category pair — each showing its seeding
prompt even with zero submitted ideas — merged with every other board that
already has a submitted idea. Each board shows its seeding prompt and its
ideas ranked by popularity score, highest first, with:

- the contributor's ID
- the idea's popularity score (0-100)
- a "possible duplicate" badge when the idea's text is a near-duplicate of
  another idea already on the same board, plus a "Merge into…" select
  listing every other idea on that board — choosing one folds the
  duplicate's upvotes into the chosen target and removes the duplicate, so
  two lower-ranked duplicates can be merged directly into each other
  without first merging one of them into the board's top idea
- an "AI" badge when the idea was drafted by a "Generate AI ideas" action
  rather than typed in by a teammate
- an "Upvote" button showing the current upvote count

The form also has a "Generate AI ideas" button (next to "Submit idea") that
drafts several candidate ideas for the form's current argument block and
category via a real Anthropic call, saving each one as a normal,
AI-attributed idea on that board. Every rendered board's own header has a
second "Generate AI ideas" button that does the same thing for that board's
own argument block/category directly — no need to first type it into the
form above.

## Data flow

```
state/brainstormIdeas.ts (localStorage: brainstormIdeas)
  → buildBrainstormBoardsPanelView()      — groups every persisted
                                             BrainstormIdea into its board
                                             (argBlock + category) and ranks
                                             each via buildBrainstormBoard,
                                             sorted by argBlock then category
  → panels/BrainstormBoardPanel.tsx       — renders it, plus the submission
                                             form and upvote action
  → apps/debate-ai.com/app/cards/brainstorm/page.tsx  — mounts the panel

Submitting a new idea:
panels/BrainstormBoardPanel.tsx
  → saveBrainstormIdea(idea)              — state/brainstormIdeas.ts
  → panel re-reads buildBrainstormBoardsPanelView() to refresh

Upvoting an idea:
panels/BrainstormBoardPanel.tsx
  → upvotePersistedBrainstormIdea(id)     — state/brainstormIdeas.ts
      (reads the stored idea, increments its upvotes by one, saves it back)
  → panel re-reads buildBrainstormBoardsPanelView() to refresh

"Generate AI ideas" click (form, or a board's own header button):
  panels/BrainstormBoardPanel.tsx
    → requestTeamBrainstormAiIdeas()       — lib/team-brainstorm-client.ts
        → buildTeamBrainstormAiUserPrompt() — lib/team-brainstorm-ai.ts (pure)
        → POST /api/reason-ai               — apps/debate-ai.com/app/api/reason-ai/route.ts
            → https://api.anthropic.com/v1/messages
        → parseTeamBrainstormAiResponse()   — lib/team-brainstorm-ai.ts (pure)
    → saveBrainstormIdea() per drafted idea — state/brainstormIdeas.ts
        (contributorId "AI", isAiGenerated: true; the board's own
         argBlock/category when triggered from a board header, the form's
         current fields when triggered from the form)
  → panel re-reads buildBrainstormBoardsPanelView() to refresh

"Merge into…" select (choosing a target idea):
panels/BrainstormBoardPanel.tsx
  → mergePersistedBrainstormIdeas(targetId, duplicateId) — state/brainstormIdeas.ts
      → mergeBrainstormIdeas(target, duplicate)       — lib/team-brainstorm-assist.ts (pure)
          (returns a copy of target with the two ideas' upvotes combined)
      → saveBrainstormIdea(merged) + deleteBrainstormIdea(duplicateId)
  → panel re-reads buildBrainstormBoardsPanelView() to refresh

Choosing a topic in the topic switcher:
panels/BrainstormBoardPanel.tsx
  → buildBrainstormBoardsPanelViewForTopic(topic) — state/brainstormIdeas.ts
      → buildPersistedTopicCoverageReport(topic)  — state/trackedArguments.ts
      → buildBrainstormBoardsForCoverageGaps()    — lib/team-brainstorm-assist.ts (pure)
          (one board per under-covered tracked argument/category pair,
           populated with any ideas already submitted for it)
      → merged with buildBrainstormBoardsPanelView()'s other boards
          (skipping any board already produced as a coverage-gap seed)
  → panel re-renders that topic's board list
```

Ranking and near-duplicate flagging already existed in
`lib/team-brainstorm-assist.ts` (`groupIdeasByBoard`, `rankBrainstormIdeas`,
`buildBrainstormBoard`) and were already Vitest-covered; the panel/UI slice
closed follow-up "(b) a brainstorm-panel UI for live squad submission/upvoting"
named under the "🧠 Team Brainstorm Assist" bullet in `TODO.md`, adding two
small helpers to `state/brainstormIdeas.ts` — `buildBrainstormBoardsPanelView`
(groups the persisted ideas into boards for the panel) and
`upvotePersistedBrainstormIdea` (applies an upvote to a stored idea) —
rather than introducing new ranking or mutation logic.

This feature adds the "Generate AI ideas" action, closing follow-up "(a) an
actual AI-generation call that drafts candidate ideas from
`buildBrainstormPrompt`'s output" — a new `lib/team-brainstorm-ai.ts`
(system prompt + user-prompt builder + tolerant JSON parser, mirroring
`lib/llm-card-scoring-ai.ts`'s strict-JSON-with-fallback split) and
`lib/team-brainstorm-client.ts` (a small self-contained `fetch` client
POSTing to the existing `/api/reason-ai` proxy, mirroring
`lib/llm-card-scoring-client.ts`'s split). `BrainstormIdea` gains an
additive, optional `isAiGenerated` field (existing records without one stay
valid) so an AI-drafted idea is saved and displayed through the exact same
`saveBrainstormIdea`/ranking/upvote path as a human-submitted one, rather
than needing a parallel storage or rendering path. Vitest-covered in
`packages/debate-card-search/test/brainstormIdeas.test.ts`,
`packages/debate-card-search/test/team-brainstorm-ai.test.ts` (prompt
content and response parsing, including a fenced reply, a prose-wrapped
reply, and an empty/unusable reply), and
`packages/debate-card-search/test/team-brainstorm-client.test.ts` (the
`fetch` client, mocked via `vi.stubGlobal`, covering the success path, an
endpoint override, a server error message, a non-JSON error body, and an
unparseable reply).

This feature also closes the "boards aren't seeded from the coverage-gap
prompts" gap previously noted here — a new topic switcher (mirroring
`TopicCoverageDashboardPanel`'s) lets a user pick one of the same tracked
topics used by the Topic Coverage Dashboard, swapping the board list to
`state/brainstormIdeas.ts`'s `buildBrainstormBoardsPanelViewForTopic`. That
composes the topic's persisted coverage report
(`buildPersistedTopicCoverageReport`) with the already-existing pure
`buildBrainstormBoardsForCoverageGaps` (`lib/team-brainstorm-assist.ts`) —
no new coverage-gap or ranking logic is introduced — merged with every other
board that already has a submitted idea but isn't itself a coverage-gap
seed, so nothing that was visible before disappears when a topic is chosen.
Vitest-covered in `packages/debate-card-search/test/brainstormIdeas.test.ts`
(a seeded board with no ideas yet, a seeded board populated with an already-
submitted idea, merging in a non-seed board with a submitted idea, and an
untracked topic falling back to exactly the topic-less board list).

This feature closes both Known gaps previously recorded here. A "Generate
AI ideas" button now lives on every rendered board's own header, not just
the submission form — clicking it calls the same
`requestTeamBrainstormAiIdeas` request using that board's own
`argBlock`/`category` directly, so drafting AI ideas for a board that's
already visible no longer requires first typing its argument block into
the form above. And any idea flagged `isLikelyDuplicate` now shows a "Merge into…" target
picker, calling the new `lib/team-brainstorm-assist.ts`
`mergeBrainstormIdeas` (via `state/brainstormIdeas.ts`'s
`mergePersistedBrainstormIdeas`) to fold the duplicate's upvotes into
whichever idea is chosen and remove the duplicate — a moderator action
where the badge was previously informational only. `mergeBrainstormIdeas`
throws on a same-id or cross-board merge attempt rather than silently
conflating two unrelated ideas' vote counts. Vitest-covered in
`packages/debate-card-search/test/team-brainstorm-assist.test.ts`
(`mergeBrainstormIdeas`: combining upvotes onto a copy of the target, not
mutating either input, throwing on a same-idea merge, throwing on a
cross-board merge) and
`packages/debate-card-search/test/brainstormIdeas.test.ts`
(`mergePersistedBrainstormIdeas`: folding upvotes and deleting the
duplicate, and a no-op when either id isn't stored).

The target picker itself lists every *other* idea on the same board (not
only the board's top-ranked idea), closing the "a duplicate pair that both
rank below the board's actual top idea can't be merged directly into each
other without first merging one of them up" Known gap previously recorded
here — this is a UI-only change in `panels/BrainstormBoardPanel.tsx`
(swapping a single "Merge into top idea" button for a `Select` populated
from `board.ideas`); the already-tested `mergeBrainstormIdeas`/
`mergePersistedBrainstormIdeas` needed no changes, since both already
accepted an arbitrary target id.

A later slice adds a signed-in prefill (mirroring [Task Inbox](./task-inbox.md)'s
identical convention) for the idea form's "Contributor ID" field:

```
components/research/BrainstormBoardWithIdentity.tsx  — "use client" wrapper
  → useSession()                          — lib/hooks/useSession.ts, the
                                              better-auth React session hook
  → deriveContributorIdFromSessionIdentity(user)
      — debate-card-search's lib/session-identity.ts: name, else the
        email's local part, else the raw account id, else ""
  → <BrainstormBoardPanel signedInContributorId={...} />
      — seeds "Contributor ID" initial value only; a visitor who edits it
        (hasEditedContributorId) keeps their own typed value from then on,
        and a successful submission's form reset restores the prefilled
        value (rather than clearing it to blank) so a signed-in visitor can
        submit several ideas in a row without retyping their id
```

`apps/debate-ai.com/app/cards/brainstorm/page.tsx` and `ResearchHub.tsx`'s
Sprint tab now mount this wrapper instead of the bare panel; a signed-out
visitor sees the exact same blank field as before.

## Known gaps

- No reviewer/moderator identity check gates the merge action — any visitor
  can merge any two ideas on a board, same as every other unauthenticated
  moderator-style action in this repo (upvoting, approving a peer review,
  etc. — no auth system exists here yet).
- "Contributor ID" is still free-form text, not a login — a real signed-in
  session only *prefills* it (see "Signed-in prefill" above), so a visitor
  can still overwrite it to submit under any id. There is no server-side
  session check on `saveBrainstormIdea`, the same trust boundary every
  other localStorage-backed action in this repo has.
