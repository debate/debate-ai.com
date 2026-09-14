<!-- template-git-repo:badges:start -->
<p align="center">
    <a href="https://debate-ai.com/docs"><img src="https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white" alt="Documentation" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/stargazers"><img src="https://img.shields.io/github/stars/debate/debate-ai.com" alt="GitHub Stars" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/issues"><img src="https://img.shields.io/github/issues/debate/debate-ai.com?logo=github" alt="GitHub Issues" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls"><img src="https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs" alt="Open Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed"><img src="https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5" alt="Merged Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/discussions"><img src="https://img.shields.io/github/discussions/debate/debate-ai.com" alt="GitHub Discussions" /></a>
    <a href="https://github.com/debate/debate-ai.com/commits/master/"><img src="https://img.shields.io/github/last-commit/debate/debate-ai.com.svg" alt="GitHub last commit" /></a>
    <br />
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-team-collaboration"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/Next.js-black?logo=nextdotjs&logoColor=white" alt="Next.js" /> <img src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=white" alt="React" /> <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
</p>
<!-- template-git-repo:badges:end -->

# debate-team-collaboration

Team Prep & Collaboration — task inbox, collaboration prep room, team collaboration mode
(topic sprints), team brainstorm assist, group challenges, research progress tracking, and
(from `debate-round`) prep notes and account/prep-note notifications.

```tsx
import { TaskInboxPanel, PrepRoomPanel, TopicSprintPanel, BrainstormBoardPanel, GroupChallengesPanel, ResearchProgressPanel, SprintNotesPanel } from "debate-team-collaboration"
import { PrepNotesPanel, AccountNotificationsPanel, PrepNoteNotificationsPanel } from "debate-team-collaboration"
import { ContactsPanel, SharedCardsPanel, useContacts, useCardShares } from "debate-team-collaboration"
```

Also home to the account-linked **contacts list** and **shared collab cards**
(`src/lib/contacts.ts` rules, `src/state/contacts.ts` / `src/state/cardShares.ts`
clients, the two hooks and panels above) — see
[packages/debate-help-docs/content/docs/features/contacts.mdx](../../docs/features/contacts.md).

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
