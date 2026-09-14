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
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-search-evidence"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/Next.js-black?logo=nextdotjs&logoColor=white" alt="Next.js" /> <img src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=white" alt="React" /> <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
</p>
<!-- template-git-repo:badges:end -->

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

## Card library import (`debate-cards-upload`)

The evidence corpus behind `/cards` is loaded from the published Parquet
shards. Shards are hundreds of megabytes of card HTML, so the file itself is
never uploaded: the CLI reads it in row windows, normalizes each window, and
posts batches of rows to `POST /api/admin/debate-cards`, which upserts them by
card id. Files are imported strictly one at a time, each with its own summary.

```bash
# One shard against a locally running dev server
bun run upload:cards cards-0000.parquet

# A directory, one file at a time, against a deployment
CARD_IMPORT_TOKEN=... bunx debate-cards-upload shards/*.parquet \
  --endpoint https://debate-ai.com/api/admin/debate-cards

# Parse a shard and report what would be skipped, writing nothing
bunx debate-cards-upload cards-0000.parquet --dry-run
```

Run it with `--help` for the full flag list (`--batch`, `--start-row` to resume
an interrupted import, `--max-rows`, `--cookie`, `--quiet`).

The admin panel's "Card library import" card runs the same import in the
browser, reusing these modules verbatim, so both accept and skip exactly the
same rows:

| Module | Role |
| --- | --- |
| `lib/parquet-card-import.ts` | Row normalization, batching, dedupe, progress formatting — pure, no I/O |
| `lib/parquet-card-reader.ts` | Streams a shard's rows in windows (dynamically imports `hyparquet`) |
| `lib/parquet-card-upload.ts` | Drives one shard end to end; builds the retrying HTTP batch sender |
| `lib/parquet-upload-cli-options.ts` | Flag parsing and usage text |
| `cli/upload-parquet.ts` | The CLI's file and console I/O |

See [packages/debate-help-docs/content/docs/features/card-library-import.mdx](../../docs/features/card-library-import.md)
for the column mapping, the skip codes, and how authorization works.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

## Tests

```bash
bun run test        # or: npx vitest run
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **57.27%** (tracked
under the `debate-search-evidence` flag).
