# debate-research-evidence

Research & Evidence — the evidence card search interface (search bar, result list, card
content viewer, research sidebar, AI analysis sidebar) plus the shared evidence/argument
library, LLM card scoring, revision incentives, review queue and topic coverage dashboard.

```tsx
import { SearchInterface, EvidenceLibraryPanel, ArgumentLibraryPanel, ContributionsFeedPanel, CardScoringPanel, RevisionIncentivesPanel, ReviewQueuePanel, TopicCoverageDashboardPanel } from "debate-research-evidence"
```

This package split out of `debate-card-search` along with `debate-team-collaboration` and
`debate-community`. It has no dependency on either — it's the shared foundation both of
them depend on for evidence/contribution data, session identity, and UI primitives.

Cards are parsed by `debate-card-parser`. Deep imports (e.g.
`debate-research-evidence/src/lib/contribution-leaderboard`) are how `debate-team-collaboration`
and `debate-community` reach specific modules that aren't re-exported from the package root.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.
