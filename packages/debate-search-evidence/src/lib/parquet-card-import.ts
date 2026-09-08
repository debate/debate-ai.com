/**
 * @fileoverview Runtime-agnostic core of the debate-card Parquet importer.
 *
 * The card corpus is published as Parquet shards (the OpenCaselist-style
 * dump: `id`, `tag`, `cite`, `fullcite`, `summary`, `spoken`, `fulltext`,
 * `textLength`, `markup`, `pocket`, `hat`, `block`, `bucketId`,
 * `duplicateCount`, `side`, `caselistDisplayName`, `year`, `event`,
 * `level`). A single shard holds millions of rows and hundreds of megabytes
 * of HTML, so nothing here ever holds a whole file: a reader hands this
 * module one slice of decoded rows at a time, it normalizes them into
 * {@link DebateCardRecord}s, and the caller posts them onward in batches.
 *
 * Kept free of `node:fs`, `fetch` and React so the exact same normalization
 * runs in all three places a card can enter the library — the CLI
 * (`src/cli/upload-parquet.ts`, Node/Bun), the admin uploader (browser), and
 * the ingest endpoint that re-validates whatever those two send it. A row
 * that the CLI would skip is therefore a row the server skips too, with the
 * same code and the same reason.
 *
 * Every rejection is reported rather than dropped: a shard that silently
 * loses a tenth of its rows is worse than one that says which rows it lost
 * and why, since the operator's only other feedback is a row count.
 *
 * @module lib/parquet-card-import
 */

/**
 * Parquet columns the importer reads, in dataset order.
 *
 * Passed to the reader as an explicit projection so a shard that carries
 * extra columns (embeddings, provenance blobs) costs nothing to import —
 * unread columns are never decompressed.
 */
export const DEBATE_CARD_PARQUET_COLUMNS = [
  "id",
  "tag",
  "cite",
  "fullcite",
  "summary",
  "spoken",
  "fulltext",
  "textLength",
  "markup",
  "pocket",
  "hat",
  "block",
  "bucketId",
  "duplicateCount",
  "side",
  "caselistDisplayName",
  "year",
  "event",
  "level",
] as const;

/**
 * Accepted spellings for each field.
 *
 * The same dump is published with camelCase columns in some exports and
 * snake_case in others; an importer that only knew one spelling would read a
 * shard as "every row missing its text" rather than as a naming difference.
 */
const FIELD_ALIASES: Record<string, readonly string[]> = {
  id: ["id"],
  tag: ["tag"],
  cite: ["cite"],
  fullcite: ["fullcite", "full_cite", "fullCite"],
  summary: ["summary"],
  spoken: ["spoken"],
  fulltext: ["fulltext", "full_text", "fullText"],
  textLength: ["textLength", "text_length"],
  markup: ["markup", "html"],
  pocket: ["pocket"],
  hat: ["hat"],
  block: ["block"],
  bucketId: ["bucketId", "bucket_id"],
  duplicateCount: ["duplicateCount", "duplicate_count"],
  side: ["side"],
  caselistDisplayName: ["caselistDisplayName", "caselist_display_name", "caselist"],
  year: ["year"],
  event: ["event"],
  level: ["level"],
};

/** One normalized card row, ready to be posted to the ingest endpoint. */
export interface DebateCardRecord {
  /** Stable card id from the dump; the upsert key. */
  id: number;
  /** Tagline — the claim the card is read for. */
  tag: string;
  /** Short cite ("Blum et al. 18"). */
  cite: string;
  /** Full citation with author credentials. */
  fullcite: string;
  /** Underlined/"summary" reading of the card. */
  summary: string;
  /** Highlighted text as actually spoken. */
  spoken: string;
  /** Full body text, unhighlighted. */
  fulltext: string;
  /** Character count of {@link fulltext}, derived when the column is absent. */
  textLength: number;
  /** Card HTML with `<mark>`/`<u>` highlighting preserved. */
  markup: string;
  /** Pocket (top-level outline heading) the card sits under. */
  pocket: string;
  /** Hat (second-level heading). */
  hat: string;
  /** Block (third-level heading) the card belongs to. */
  block: string;
  /** Dedup bucket shared by near-identical cards, 0 when unbucketed. */
  bucketId: number;
  /** How many times this card appears across the corpus. */
  duplicateCount: number;
  /** "A" (aff) or "N" (neg), uppercased; empty when unlabeled. */
  side: string;
  /** Caselist the card came from ("NDT/CEDA 2021-22"). */
  caselistDisplayName: string;
  /** Competition year, 0 when unlabeled. */
  year: number;
  /** Event code, lowercased ("cx", "ld", "pf"). */
  event: string;
  /** Competition level, lowercased ("college", "hs"). */
  level: string;
}

/** Why one row was skipped, reported back to whoever started the import. */
export interface DebateCardRowFailure {
  /** Zero-based position in the shard, so the operator can find the row. */
  rowIndex: number;
  /** The row's id when it had a usable one. */
  id: number | null;
  /** Machine-readable cause, stable enough to branch on. */
  code: "not-a-row" | "missing-id" | "empty-card" | "row-too-large";
  /** Operator-facing explanation. */
  reason: string;
}

/** Result of normalizing a slice of decoded Parquet rows. */
export interface DebateCardNormalizeResult {
  cards: DebateCardRecord[];
  failures: DebateCardRowFailure[];
}

/**
 * Rows sent per ingest request.
 *
 * Cards carry full HTML, so this trades request size against round trips:
 * 250 rows of average dump cards lands well inside a Worker's request limit
 * while keeping a million-row shard to a few thousand requests.
 */
export const CARD_UPLOAD_BATCH_ROWS = 250;

/**
 * Rows decoded from the shard at a time.
 *
 * Larger than the upload batch because decoding is the expensive half:
 * reading 2,000 rows and posting them as eight requests beats eight separate
 * reads of the same row group.
 */
export const CARD_READ_CHUNK_ROWS = 2_000;

/**
 * Largest single row the importer accepts, in characters of text.
 *
 * The published dump tops out around 40k characters per card, so anything
 * past this is a malformed row (a whole file glued into one cell), and
 * letting it through would blow the ingest request rather than the row.
 */
export const MAX_CARD_CHARS = 1_000_000;

/**
 * Every column spelling the importer understands, in dataset order.
 *
 * A reader intersects this with the shard's own schema to build the
 * projection it asks for — requesting a column a shard does not have fails
 * the whole read.
 */
export const DEBATE_CARD_PARQUET_COLUMN_ALIASES: string[] = DEBATE_CARD_PARQUET_COLUMNS.flatMap(
  (field) => [...(FIELD_ALIASES[field] ?? [field])],
);

/** Reads a field by any of its accepted column spellings. */
function readField(row: Record<string, unknown>, field: string): unknown {
  for (const alias of FIELD_ALIASES[field] ?? [field]) {
    const value = row[alias];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/**
 * Coerces a decoded Parquet value to a trimmed string.
 *
 * Readers hand back `Uint8Array` for BYTE_ARRAY columns that carry no UTF8
 * annotation, which would otherwise stringify to "[object Uint8Array]" and
 * be stored as that.
 *
 * @param value - Decoded column value.
 * @returns The value as text, or "" when it carries nothing.
 */
export function toCardText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (value instanceof Uint8Array) return new TextDecoder().decode(value).trim();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") return "";
  return String(value).trim();
}

/**
 * Coerces a decoded Parquet value to a finite non-negative integer.
 *
 * Int64 columns decode to `BigInt`, which `JSON.stringify` refuses to
 * serialize — so ids reach the ingest endpoint as numbers or not at all.
 *
 * @param value - Decoded column value.
 * @param fallback - Returned when the value is missing or unusable.
 * @returns The value as a number.
 */
export function toCardNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : fallback;
  }
  const parsed = typeof value === "number" ? value : Number(toCardText(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

/**
 * Normalizes one decoded Parquet row into a {@link DebateCardRecord}.
 *
 * @param raw - One decoded row, keyed by column name.
 * @param rowIndex - The row's zero-based position in the shard, for reporting.
 * @returns The normalized card, or the reason it was skipped.
 */
export function normalizeDebateCardRow(
  raw: unknown,
  rowIndex: number,
): { card: DebateCardRecord } | { failure: DebateCardRowFailure } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      failure: {
        rowIndex,
        id: null,
        code: "not-a-row",
        reason: "Row is not an object — the file is probably not a card dump.",
      },
    };
  }

  const row = raw as Record<string, unknown>;
  const id = toCardNumber(readField(row, "id"), 0);
  if (id <= 0) {
    return {
      failure: {
        rowIndex,
        id: null,
        code: "missing-id",
        reason: "Row has no positive integer `id`, so it has no upsert key.",
      },
    };
  }

  const fulltext = toCardText(readField(row, "fulltext"));
  const markup = toCardText(readField(row, "markup"));
  const spoken = toCardText(readField(row, "spoken"));
  const summary = toCardText(readField(row, "summary"));
  const tag = toCardText(readField(row, "tag"));

  // A row with an id but no text at all is a corpus artifact, not a card —
  // storing it would only pad the row count and pollute search results.
  if (!fulltext && !markup && !spoken && !summary && !tag) {
    return {
      failure: {
        rowIndex,
        id,
        code: "empty-card",
        reason: "Row has no tag, summary, spoken, fulltext or markup content.",
      },
    };
  }

  const totalChars = fulltext.length + markup.length + spoken.length + summary.length;
  if (totalChars > MAX_CARD_CHARS) {
    return {
      failure: {
        rowIndex,
        id,
        code: "row-too-large",
        reason: `Row holds ${totalChars.toLocaleString()} characters, over the ${MAX_CARD_CHARS.toLocaleString()}-character per-card limit.`,
      },
    };
  }

  return {
    card: {
      id,
      tag,
      cite: toCardText(readField(row, "cite")),
      fullcite: toCardText(readField(row, "fullcite")),
      summary,
      spoken,
      fulltext,
      // The dump's own `textLength` is authoritative where present (it is
      // measured before trimming); derive it only when the column is absent.
      textLength: toCardNumber(readField(row, "textLength"), fulltext.length),
      markup,
      pocket: toCardText(readField(row, "pocket")),
      hat: toCardText(readField(row, "hat")),
      block: toCardText(readField(row, "block")),
      bucketId: toCardNumber(readField(row, "bucketId"), 0),
      duplicateCount: toCardNumber(readField(row, "duplicateCount"), 0),
      side: toCardText(readField(row, "side")).toUpperCase().slice(0, 8),
      caselistDisplayName: toCardText(readField(row, "caselistDisplayName")),
      year: toCardNumber(readField(row, "year"), 0),
      event: toCardText(readField(row, "event")).toLowerCase().slice(0, 16),
      level: toCardText(readField(row, "level")).toLowerCase().slice(0, 16),
    },
  };
}

/**
 * Normalizes a slice of decoded rows, keeping the good ones and collecting
 * the reason for each skipped one.
 *
 * @param rows - Decoded rows from the shard.
 * @param startIndex - Shard position of `rows[0]`, so reported row numbers
 *   stay absolute across chunked reads.
 * @returns The normalized cards and the per-row failures.
 */
export function normalizeDebateCardRows(
  rows: readonly unknown[],
  startIndex = 0,
): DebateCardNormalizeResult {
  const cards: DebateCardRecord[] = [];
  const failures: DebateCardRowFailure[] = [];
  for (let offset = 0; offset < rows.length; offset++) {
    const outcome = normalizeDebateCardRow(rows[offset], startIndex + offset);
    if ("card" in outcome) cards.push(outcome.card);
    else failures.push(outcome.failure);
  }
  return { cards, failures };
}

/**
 * Splits a list into fixed-size batches.
 *
 * @param items - Items to split.
 * @param size - Maximum batch size; values below 1 are treated as 1.
 * @returns The batches, in order.
 */
export function chunkForUpload<T>(items: readonly T[], size: number): T[][] {
  const limit = Math.max(1, Math.trunc(size));
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += limit) {
    batches.push(items.slice(start, start + limit));
  }
  return batches;
}

/**
 * Drops rows that repeat an id already seen in this import run.
 *
 * The dump ships near-duplicate cards, and a batch that names the same id
 * twice makes SQLite's upsert fail with "ON CONFLICT DO UPDATE command does
 * not affect row a second time" — taking the whole batch down with it. Last
 * write wins, matching what the upsert would have done across two batches.
 *
 * @param cards - Normalized cards, in shard order.
 * @param seenIds - Ids already sent in this run; mutated as rows are kept.
 * @returns The cards to send, and how many repeats were dropped.
 */
export function dedupeCardsById(
  cards: readonly DebateCardRecord[],
  seenIds: Set<number>,
): { cards: DebateCardRecord[]; duplicates: number } {
  const kept: DebateCardRecord[] = [];
  let duplicates = 0;
  for (const card of cards) {
    if (seenIds.has(card.id)) {
      duplicates++;
      continue;
    }
    seenIds.add(card.id);
    kept.push(card);
  }
  return { cards: kept, duplicates };
}

/** Running totals for one file's import, shown live and summarized at the end. */
export interface CardImportProgress {
  /** Rows read out of the shard. */
  read: number;
  /** Rows accepted and written. */
  imported: number;
  /** Rows dropped as repeats of an id already sent this run. */
  duplicates: number;
  /** Rows rejected by normalization. */
  skipped: number;
  /** Total rows the shard holds, when the reader could report it. */
  total?: number;
}

/** An empty progress record, for starting a run or resetting the UI. */
export function emptyCardImportProgress(total?: number): CardImportProgress {
  return { read: 0, imported: 0, duplicates: 0, skipped: 0, total };
}

/**
 * Renders one file's outcome as a single operator-facing line.
 *
 * @param fileName - The shard's file name.
 * @param progress - Totals for that shard.
 * @returns A sentence naming what landed and what did not.
 */
export function formatCardImportSummary(
  fileName: string,
  progress: CardImportProgress,
): string {
  const parts = [`${progress.imported.toLocaleString()} card${progress.imported === 1 ? "" : "s"} imported`];
  if (progress.duplicates > 0) parts.push(`${progress.duplicates.toLocaleString()} duplicate ids skipped`);
  if (progress.skipped > 0) parts.push(`${progress.skipped.toLocaleString()} rows skipped`);
  return `${fileName}: ${parts.join(", ")} (${progress.read.toLocaleString()} rows read).`;
}

/**
 * Percentage of a shard read so far, for a progress bar.
 *
 * @param progress - Totals for the shard.
 * @returns 0-100, or `null` when the shard's row count is unknown.
 */
export function cardImportPercent(progress: CardImportProgress): number | null {
  if (!progress.total || progress.total <= 0) return null;
  return Math.min(100, Math.round((progress.read / progress.total) * 100));
}
