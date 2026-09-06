# debate-team-collaboration

Team Prep & Collaboration — task inbox, collaboration prep room, team collaboration mode
(topic sprints), team brainstorm assist, group challenges, research progress tracking, and
(from `debate-round`) prep notes and account/prep-note notifications.

```tsx
import { TaskInboxPanel, PrepRoomPanel, TopicSprintPanel, BrainstormBoardPanel, GroupChallengesPanel, ResearchProgressPanel, SprintNotesPanel } from "debate-team-collaboration"
import { PrepNotesPanel, AccountNotificationsPanel, PrepNoteNotificationsPanel } from "debate-team-collaboration"
```

This package split out of `debate-card-search` and `debate-round` alongside
`debate-research-evidence` and `debate-community`. It depends on `debate-research-evidence`
(evidence/contribution data, session identity, UI primitives) and on `debate-round` (flow/live
round primitives the notifications and prep-notes panels still need).

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

## Tests

```bash
bun run test        # or: npx vitest run
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **54.37%** (tracked
under the `debate-team-collaboration` flag).
