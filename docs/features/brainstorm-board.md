# Team Brainstorm Assist

Lets a squad submit, AI-generate, and upvote brainstorm ideas against an
argument block, grouped into boards by category (new arguments, impact
framing, frontline answers, responses & turns), each board ranked by
popularity with a near-duplicate badge.

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
- an "AI" badge when the idea was drafted by the "Generate AI ideas" action
  rather than typed in by a teammate
- an "Upvote" button showing the current upvote count

The form also has a "Generate AI ideas" button (next to "Submit idea") that
drafts several candidate ideas for the form's current argument block and
category via a real Anthropic call, saving each one as a normal,
AI-attributed idea on that board.

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

"Generate AI ideas" click:
  panels/BrainstormBoardPanel.tsx
    → requestTeamBrainstormAiIdeas()       — lib/team-brainstorm-client.ts
        → buildTeamBrainstormAiUserPrompt() — lib/team-brainstorm-ai.ts (pure)
        → POST /api/reason-ai               — apps/debate-ai.com/app/api/reason-ai/route.ts
            → https://api.anthropic.com/v1/messages
        → parseTeamBrainstormAiResponse()   — lib/team-brainstorm-ai.ts (pure)
    → saveBrainstormIdea() per drafted idea — state/brainstormIdeas.ts
        (contributorId "AI", isAiGenerated: true)
  → panel re-reads buildBrainstormBoardsPanelView() to refresh
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

## Known gaps

- Boards aren't seeded from the Topic Coverage Dashboard's under-covered
  arguments (`buildBrainstormPromptsForCoverageGaps`) — a board only exists
  once someone has submitted an idea to it (AI-generated or human), and the
  form's prompt text is only shown once a board exists.
- There's no reviewer/moderator merge action for ideas flagged as likely
  duplicates — the badge is informational only. AI-drafted ideas are scored
  for near-duplicates against the board's other ideas the same way a
  human's is, so a repeated "Generate AI ideas" click can itself produce
  flagged duplicates.
- The AI-generation call requires an argument block to already be filled in
  on the form; it doesn't infer one from an existing board.
