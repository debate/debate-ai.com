/**
 * @fileoverview Streaming Parquet reader for debate-card shards.
 *
 * Card shards are hundreds of megabytes and the largest ones hold millions of
 * rows, so the file is never decoded in one go: {@link readDebateCardChunks}
 * walks it in row windows and yields each window, letting the caller upload
 * one window while the next is decoded. The same code runs in Node/Bun (the
 * CLI) and in the browser (the admin uploader) — the only difference is where
 * the {@link ParquetSource} byte slices come from, so this module takes one
 * rather than opening anything itself.
 *
 * `hyparquet` and its compressors are loaded with a dynamic `import()`:
 * nothing about the card-search UI needs a Parquet decoder in its bundle, and
 * this keeps it in a chunk only the uploader ever fetches.
 *
 * @module lib/parquet-card-reader
 */

import {
  CARD_READ_CHUNK_ROWS,
  DEBATE_CARD_PARQUET_COLUMN_ALIASES,
} from "./parquet-card-import";

/**
 * A random-access byte source: a local file, a `File` from an `<input>`, or a
 * URL served with range requests. Structurally hyparquet's `AsyncBuffer`.
 */
export interface ParquetSource {
  /** Total size of the file in bytes. */
  byteLength: number;
  /** Reads `[start, end)`; `end` omitted means "to the end of the file". */
  slice(start: number, end?: number): Promise<ArrayBuffer> | ArrayBuffer;
}

/** One window of decoded rows, with its absolute position in the shard. */
export interface DebateCardRowChunk {
  /** Decoded rows, keyed by column name. */
  rows: unknown[];
  /** Zero-based shard position of `rows[0]`. */
  startIndex: number;
}

/** Where to start and stop reading, and how much to decode at a time. */
export interface ReadDebateCardOptions {
  /** First row to read; used to resume an interrupted upload. */
  startRow?: number;
  /** Stop before this row; defaults to the end of the shard. */
  endRow?: number;
  /** Rows decoded per window. */
  chunkRows?: number;
  /** Aborts the read between windows. */
  signal?: { aborted: boolean };
  /**
   * A footer already read by {@link inspectDebateCardShard}. Passing it back
   * saves re-parsing the footer for a shard the caller has already inspected.
   */
  info?: DebateCardShardInfo;
}

/** Cached module namespace so a multi-file run imports the decoder once. */
let hyparquetModule: Promise<any> | null = null;

/**
 * Loads `hyparquet` plus the optional codec pack.
 *
 * Snappy is built into hyparquet, but shards are also published ZSTD- and
 * gzip-compressed; without the codec pack those fail deep inside the decoder
 * with an unrecognized-codec error rather than at import time. The pack is
 * optional so the importer still works — for Snappy and uncompressed shards —
 * if it is not installed.
 *
 * @returns The decoder entry points and the compressors to hand them.
 */
async function loadParquetDecoder(): Promise<{
  parquetReadObjects: (options: any) => Promise<any[]>;
  parquetMetadataAsync: (source: any) => Promise<any>;
  compressors: Record<string, unknown> | undefined;
}> {
  hyparquetModule ??= (async () => {
    const hyparquet = await import("hyparquet");
    let compressors: Record<string, unknown> | undefined;
    try {
      ({ compressors } = await import("hyparquet-compressors"));
    } catch {
      compressors = undefined;
    }
    return { ...hyparquet, compressors };
  })();
  return hyparquetModule;
}

/** What a shard's footer says about its contents. */
export interface DebateCardShardInfo {
  /** Rows the shard holds. */
  rowCount: number;
  /** Card columns the shard actually carries, in dataset order. */
  columns: string[];
  /** Column names present in the shard that the card table does not store. */
  extraColumns: string[];
}

/**
 * Reads a shard's footer to learn how many rows it holds and which card
 * columns it carries.
 *
 * Only the last few hundred kilobytes are fetched, so this is cheap enough to
 * call before an upload — and a total row count is what turns the CLI's and
 * the admin panel's progress from "12,000 rows so far" into a percentage.
 *
 * Reading the column list matters as much: asking a decoder for a column a
 * shard does not have fails the whole read, so a dump published without, say,
 * `spoken` has to be imported as the columns it does have rather than
 * refused.
 *
 * @param source - The shard's bytes.
 * @returns The shard's row count and card columns.
 * @throws If the file is not a readable Parquet file.
 */
export async function inspectDebateCardShard(source: ParquetSource): Promise<DebateCardShardInfo> {
  const { parquetMetadataAsync } = await loadParquetDecoder();
  const metadata = await parquetMetadataAsync(source);
  const rows = metadata?.num_rows;
  const rowCount = typeof rows === "bigint" ? Number(rows) : Number(rows ?? 0);

  // The schema's first element is the root group; the leaves after it are the
  // columns. Aliases are accepted, so match on the same spellings the
  // normalizer reads.
  const present = new Set<string>(
    (metadata?.schema ?? [])
      .slice(1)
      .map((element: { name?: string }) => element?.name)
      .filter((name: unknown): name is string => typeof name === "string"),
  );

  const columns = DEBATE_CARD_PARQUET_COLUMN_ALIASES.filter((name) => present.has(name));
  if (columns.length === 0) {
    throw new Error(
      `No debate-card columns found in this file — it has ${[...present].slice(0, 8).join(", ") || "no columns"}. Expected columns like id, tag, cite, fulltext.`,
    );
  }

  const known = new Set(DEBATE_CARD_PARQUET_COLUMN_ALIASES);
  return { rowCount, columns, extraColumns: [...present].filter((name) => !known.has(name)) };
}

/**
 * Rows a shard holds, when only the count is needed.
 *
 * @param source - The shard's bytes.
 * @returns The shard's row count.
 */
export async function countDebateCardRows(source: ParquetSource): Promise<number> {
  return (await inspectDebateCardShard(source)).rowCount;
}

/**
 * Yields a shard's rows in windows, decoding only the card columns.
 *
 * @param source - The shard's bytes.
 * @param options - Row range, window size and abort signal.
 * @yields One window of decoded rows at a time, in shard order.
 * @throws If the file cannot be decoded as Parquet.
 */
export async function* readDebateCardChunks(
  source: ParquetSource,
  options: ReadDebateCardOptions = {},
): AsyncGenerator<DebateCardRowChunk> {
  const { parquetReadObjects, compressors } = await loadParquetDecoder();
  const { rowCount: totalRows, columns } = options.info ?? (await inspectDebateCardShard(source));

  const chunkRows = Math.max(1, Math.trunc(options.chunkRows ?? CARD_READ_CHUNK_ROWS));
  const startRow = Math.max(0, Math.trunc(options.startRow ?? 0));
  const endRow = Math.min(totalRows, Math.trunc(options.endRow ?? totalRows));

  for (let rowStart = startRow; rowStart < endRow; rowStart += chunkRows) {
    if (options.signal?.aborted) return;
    const rowEnd = Math.min(rowStart + chunkRows, endRow);
    const rows = await parquetReadObjects({
      file: source,
      // Ask only for the card columns this shard actually has. A shard that
      // also carries embeddings or provenance blobs then costs nothing to
      // import, and one missing a column still imports the rest.
      columns,
      rowStart,
      rowEnd,
      compressors,
      utf8: true,
    });
    yield { rows, startIndex: rowStart };
  }
}
