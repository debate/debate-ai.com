# Card Library Import (Parquet)

How the evidence corpus behind **CARD search** (`/cards`) gets loaded. The
published card dump ships as Parquet shards — one row per cut card, with the
tagline, both cites, the spoken and full text, the card HTML, and the caselist
metadata — and this feature imports them, a file at a time, either from a
terminal or from `/admin`.

- **CLI:** `debate-cards-upload`
  (`packages/debate-search-evidence/src/cli/upload-parquet.ts`)
- **Admin panel:** the "Card library import" card on `/admin`
  (`apps/debate-ai.com/components/admin/DebateCardParquetUpload.tsx`)
- **Endpoint:** `GET`/`POST /api/admin/debate-cards`
- **Tables:** `debate_cards`, `debate_card_imports`
  (`apps/debate-ai.com/lib/database/schema.ts`, migration
  `drizzle/0035_debate_cards.sql`)
- **Package:** [`debate-research-evidence`](../../packages/debate-search-evidence/README.md)
  (`lib/parquet-card-import.ts`, `lib/parquet-card-reader.ts`,
  `lib/parquet-card-upload.ts`, `lib/parquet-upload-cli-options.ts`)

## Why the file is never uploaded

A shard is hundreds of megabytes of card HTML — past a Worker's request limit,
and past the memory a Worker has to decode Parquet in. So the decode happens
where the file already is:

1. The **client** (CLI or browser) reads the shard's footer, then walks it in
   row windows — nothing holds the whole file.
2. Each window is normalized into card records and split into batches of ~250.
3. Each batch is `POST`ed to `/api/admin/debate-cards`, which re-validates
   every row and upserts it.

The endpoint therefore only ever sees rows, and a 40 GB corpus imports through
the same code path as a 40 MB one.

Both importers call the *same* functions to read and normalize, so a row the
CLI skips is a row the admin panel skips, with the same code and the same
reason.

## Columns

| Parquet column | Column stored | Notes |
| --- | --- | --- |
| `id` | `id` (primary key) | The dump's own id. Required — a row without one has no upsert key. |
| `tag` | `tag` | The claim the card is read for. |
| `cite` / `fullcite` | `cite`, `fullcite` | Short cite and full citation. |
| `summary`, `spoken`, `fulltext` | same | Underlined reading, spoken text, unhighlighted body. |
| `textLength` | `text_length` | Derived from the body when the column is absent. |
| `markup` | `markup` | Card HTML with `<mark>`/`<u>` intact. |
| `pocket`, `hat`, `block` | same | The dump's three outline levels. |
| `bucketId`, `duplicateCount` | `bucket_id`, `duplicate_count` | Dedup bucket and corpus-wide repeat count. |
| `side`, `year`, `event`, `level` | same | Normalized to `A`/`N`, an integer, and lowercase codes. |
| `caselistDisplayName` | `caselist_display_name` | e.g. `NDT/CEDA 2021-22`. |
| — | `source_file`, `imported_at` | Which shard the row came from, and when. |

`snake_case` spellings (`text_length`, `caselist_display_name`, `full_text`, …)
are accepted too, since the same dump is published both ways. Columns the table
does not store (embeddings, provenance blobs) are never decompressed — the
importer asks only for the card columns the shard actually has, so a shard
missing one still imports the rest.

### Rows that are skipped

Every rejection is reported with a code and a reason, per row, rather than
dropped silently:

| Code | Meaning |
| --- | --- |
| `missing-id` | No positive integer `id`. |
| `empty-card` | An id, but no tag, summary, spoken, fulltext or markup. |
| `row-too-large` | Over 1,000,000 characters in one card — a malformed row. |
| `not-a-row` | Not an object; the file is probably not a card dump. |

Ids repeated within a run are dropped as duplicates (last write wins), which is
also what keeps SQLite from rejecting a batch that names the same id twice.

## Re-importing

Cards are **upserted by id**, so importing the same shard twice is a no-op and
a corrected shard replays cleanly over the old one. `debate_card_imports` keeps
one row per file — rows imported, rows skipped, who ran it, and when — and
resets that file's counters when a new run starts rather than doubling them.

## CLI

```bash
# One shard against a locally running dev server
bun run --filter debate-research-evidence upload:cards cards-0000.parquet

# A whole directory, one file at a time, against production
CARD_IMPORT_TOKEN=… bunx debate-cards-upload shards/*.parquet \
  --endpoint https://debate-ai.com/api/admin/debate-cards

# Check a shard parses, and see what would be skipped, writing nothing
bunx debate-cards-upload cards-0000.parquet --dry-run
```

| Flag | Purpose |
| --- | --- |
| `--endpoint <url>` | Ingest endpoint (env `DEBATE_CARDS_ENDPOINT`). |
| `--token <token>` | Bearer token matching the server's `CARD_IMPORT_TOKEN` (env `CARD_IMPORT_TOKEN`). |
| `--cookie <cookie>` | A signed-in admin session's cookie, instead of a token (env `DEBATE_ADMIN_COOKIE`). |
| `--batch <rows>` | Cards per request (default 250). |
| `--chunk <rows>` | Rows decoded per read (default 2,000). |
| `--start-row <n>` | Skip the first *n* rows of each shard — how an interrupted import resumes. |
| `--max-rows <n>` | Import at most *n* rows per shard. |
| `--per-file-dedupe` | Dedupe ids within each shard only, not across the run. |
| `--dry-run` | Read and normalize, post nothing. |
| `--quiet` | Only print each shard's final summary. |

Files are imported strictly one after another, each with its own summary. A
shard that fails does not abandon the rest of the run, but the exit code is
non-zero (`1` for a failed file, `2` for a usage error).

## Admin panel

The **Card library import** card on `/admin` does the same thing for an
operator with a shard on their laptop and no terminal: pick one or more
`.parquet` files, watch each one's progress bar, stop mid-run if needed. The
tab has to stay open for the duration, since the browser is doing the decoding.
Below the queue it shows what the library currently holds and every file
imported into it so far.

## Authorization

`POST` and `GET /api/admin/debate-cards` accept either:

- an **admin session** — the `ADMIN_EMAILS` allowlist that gates the rest of
  `/admin` (open to everyone when unset), which is how the admin panel and
  `--cookie` authenticate; or
- a **bearer token** equal to the `CARD_IMPORT_TOKEN` secret, which is how the
  CLI authenticates with no browser session. The token path exists only when
  that secret is configured — an unset secret is never an unauthenticated
  write path.

Set it with `npx wrangler secret put CARD_IMPORT_TOKEN`.
