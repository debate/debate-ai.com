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

See [docs/features/card-library-import.md](../../docs/features/card-library-import.md)
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
