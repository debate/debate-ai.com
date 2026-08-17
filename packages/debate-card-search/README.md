# debate-card-search

CARDS — the evidence card research interface: the search bar and result list, the card
content viewer, the research sidebar, and the AI analysis sidebar with its hooks — plus the
Research Crowdsourcing Organizer feature set (leaderboards, quests, task routing, evidence
library, prep rooms, and more) described in `TODO.md`.

```tsx
import { SearchInterface, ContributionLeaderboardPanel, TaskInboxPanel, ProgressUnlocksPanel, EvidenceLibraryPanel, RevisionIncentivesPanel, ReviewQueuePanel, BrainstormBoardPanel, SprintNotesPanel } from "debate-card-search"
```

Cards are parsed by `debate-card-parser`; shared lookups come from `debate-core`, and all
primitives come from `debate-ui`.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-card-search/
├── src/
│   ├── components/   # search interface, result card, viewers, sidebars
│   ├── hooks/        # useSearchState, useAiAnalysis
│   ├── layout/       # desktop layout, mobile overlays, floating actions
│   ├── panels/       # full-page feature panels (ContributionLeaderboardPanel, TaskInboxPanel,
│   │                 # ProgressUnlocksPanel, EvidenceLibraryPanel, RevisionIncentivesPanel,
│   │                 # ReviewQueuePanel, BrainstormBoardPanel, SprintNotesPanel)
│   ├── lib/          # pure logic — search-query building, scoring, quests, task
│   │                 # routing, evidence library, prep rooms, and more (see TODO.md)
│   ├── state/        # localStorage-backed persistence stores over the lib/ models
│   ├── types/        # SearchResult and filter types
│   └── index.ts      # public entry point
└── test/             # Vitest suites mirroring lib/ and state/
```

See [`docs/features/contribution-leaderboard.md`](../../docs/features/contribution-leaderboard.md)
for one example of a `lib/` + `state/` slice wired all the way through to a routed panel.

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.
