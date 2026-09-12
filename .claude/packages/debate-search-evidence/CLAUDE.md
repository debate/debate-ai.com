# CLAUDE.md — `debate-research-evidence` (`packages/debate-search-evidence`)

**Package name:** `debate-research-evidence` — filter on that, not the
directory. Private. Entry `src/index.ts`, tests in `test/`. One of the two
load-bearing packages in the repo.

Owns the evidence card research interface (search bar, result list, card content
viewer, research and AI-analysis sidebars) plus the shared **evidence/argument
library**, **LLM card scoring**, revision incentives, the **review queue**, and
the topic coverage dashboard.

## You are the foundation

`debate-contributor-progress` (`debate-community`) and
`debate-team-collaboration` were both split out of the old `debate-card-search`
and **still build on this package**. A change to a public export or to the
shared library's shape reaches both. Check them before renaming anything.

## Rules

- **LLM card scoring decides what debaters see first.** A scoring change
  reorders the whole corpus for everyone; treat it as a product decision, pin
  the behaviour in a test, and say so in the PR.
- **The review queue is a moderation surface.** Cards move between states based
  on community review; never add a transition that bypasses review, and never
  make a rejection silently reversible.
- Revision incentives feed `debate-community`'s leaderboard — a change in what
  counts as a contribution changes everyone's standing.
- Card content is user-submitted and can be hostile. It is rendered widely;
  sanitize at the boundary, not at each render site.
