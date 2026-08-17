# Team Brainstorm Assist

Lets a squad submit and upvote brainstorm ideas against an argument block,
grouped into boards by category (new arguments, impact framing, frontline
answers, responses & turns), each board ranked by popularity with a
near-duplicate badge.

- **Route:** `/cards/brainstorm`
- **Nav:** the global dock's Settings menu → **Team Brainstorm Assist**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

A submission form (argument block, contributor ID, category, idea text)
followed by every board that has at least one submitted idea, sorted by
argument block then category. Each board shows its seeding prompt and its
ideas ranked by popularity score, highest first, with:

- the contributor's ID
- the idea's popularity score (0-100)
- a "possible duplicate" badge when the idea's text is a near-duplicate of
  another idea already on the same board
- an "Upvote" button showing the current upvote count

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
```

Ranking and near-duplicate flagging already existed in
`lib/team-brainstorm-assist.ts` (`groupIdeasByBoard`, `rankBrainstormIdeas`,
`buildBrainstormBoard`) and were already Vitest-covered; this feature closes
follow-up "(b) a brainstorm-panel UI for live squad submission/upvoting"
named under the "🧠 Team Brainstorm Assist" bullet in `TODO.md`, adding two
small helpers to `state/brainstormIdeas.ts` — `buildBrainstormBoardsPanelView`
(groups the persisted ideas into boards for the panel) and
`upvotePersistedBrainstormIdea` (applies an upvote to a stored idea) —
rather than introducing new ranking or mutation logic. Vitest-covered in
`packages/debate-card-search/test/brainstormIdeas.test.ts`.

## Known gaps

- Follow-up "(a) an actual AI-generation call that drafts candidate ideas
  from `buildBrainstormPrompt`'s output" remains open — the panel only lets
  a human type an idea in; it doesn't call any AI model to draft one.
- Boards aren't seeded from the Topic Coverage Dashboard's under-covered
  arguments (`buildBrainstormPromptsForCoverageGaps`) — a board only exists
  once someone has submitted an idea to it. The form's prompt text is only
  shown once a board exists.
- There's no reviewer/moderator merge action for ideas flagged as likely
  duplicates — the badge is informational only.
