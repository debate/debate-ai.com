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
 * Windows are cut on the shard's own row groups rather than on a flat row
 * count, because a row group is the smallest thing a Parquet decoder can
 * read: asking for rows 0-2,000 of a 500,000-row group decodes all 500,000 of
 * them and throws away the rest, so a flat 2,000-row window over a real dump
 * re-decoded the same group 250 times over. See {@link planReadWindows}.
 *
 * `hyparquet` and its compressors are loaded with a dynamic `import()`:
 * nothing about the card-search UI needs a Parquet decoder in its bundle, and
 * this keeps it in a chunk only the uploader ever fetches.
 *
 * @module lib/parquet-card-reader
 */

import {
  CARD_READ_CHUNK_ROWS,
  CARD_READ_MAX_WINDOW_ROWS,
  CARD_READ_WINDOW_BYTES,
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
  /**
   * Upper bound on the rows in one window. Omit it — the reader sizes windows
   * from the shard's row groups, which is what keeps a read from decoding the
   * same group repeatedly. Set it only to force smaller windows than the
   * shard suggests.
   */
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
let hyparquetModule: Promise<ParquetDecoder> | null = null;

/** The decoder entry points this module uses. */
interface ParquetDecoder {
  parquetReadObjects: (options: any) => Promise<any[]>;
  parquetMetadataAsync: (source: any) => Promise<any>;
  parquetSchema: (metadata: any) => any;
  compressors: Record<string, unknown> | undefined;
}

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
async function loadParquetDecoder(): Promise<ParquetDecoder> {
  hyparquetModule ??= (async () => {
    const hyparquet = await import("hyparquet");
    let compressors: Record<string, unknown> | undefined;
    try {
      ({ compressors } = await import("hyparquet-compressors"));
    } catch {
      compressors = undefined;
    }
    return { ...hyparquet, compressors } as unknown as ParquetDecoder;
  })().catch((error) => {
    // A failed chunk fetch must not poison the uploader for the rest of the
    // session: drop the rejected promise so the next attempt re-imports.
    hyparquetModule = null;
    throw error;
  });
  return hyparquetModule;
}

/** One row group's position in the shard and the weight of its card columns. */
export interface DebateCardRowGroup {
  /** Zero-based shard position of the group's first row. */
  startRow: number;
  /** Rows the group holds. */
  rowCount: number;
  /** Uncompressed bytes the projected card columns occupy in this group. */
  bytes: number;
}

/** What a shard's footer says about its contents. */
export interface DebateCardShardInfo {
  /** Rows the shard holds. */
  rowCount: number;
  /** Card columns the shard actually carries, in dataset order. */
  columns: string[];
  /** Column names present in the shard that the card table does not store. */
  extraColumns: string[];
  /** The shard's row groups, in file order. */
  rowGroups: DebateCardRowGroup[];
  /**
   * The parsed footer. Handed back to every window read so a shard's footer —
   * megabytes of it on a wide dump — is fetched and parsed once per import
   * rather than once per window.
   */
  metadata: unknown;
}

/**
 * Names the shard's top-level columns.
 *
 * The footer's `schema` is a flattened depth-first list, so a shard with any
 * nested column (an embedding stored as a list, a caselist stored as a
 * struct) carries that column's inner field names in the same array as its
 * real columns. Reading the flat list would offer the decoder a projection of
 * names that are not columns — and hyparquet answers an unknown column by
 * throwing `parquet column not found`, failing the whole import. The decoder's
 * own schema tree gives the root's direct children and nothing below them.
 *
 * @param decoder - The loaded decoder, for its schema walker.
 * @param metadata - The parsed footer.
 * @returns Top-level column names, in dataset order.
 */
function topLevelColumnNames(decoder: ParquetDecoder, metadata: any): string[] {
  const children = decoder.parquetSchema(metadata)?.children ?? [];
  return children
    .map((child: { element?: { name?: string } }) => child?.element?.name)
    .filter((name: unknown): name is string => typeof name === "string");
}

/**
 * Measures each row group: where it starts, how many rows it holds, and how
 * many uncompressed bytes the projected columns take up inside it.
 *
 * The byte figure is what sizes a read window. Cards vary from a tagline to
 * 40KB of HTML, so a row count alone says nothing about what one window costs
 * to hold in memory.
 *
 * @param metadata - The parsed footer.
 * @param columns - The projection, as top-level column names.
 * @returns The row groups, in file order.
 */
function measureRowGroups(metadata: any, columns: readonly string[]): DebateCardRowGroup[] {
  const projected = new Set(columns);
  const groups: DebateCardRowGroup[] = [];
  let startRow = 0;

  for (const rowGroup of metadata?.row_groups ?? []) {
    const rowCount = Number(rowGroup?.num_rows ?? 0);
    let bytes = 0;
    for (const column of rowGroup?.columns ?? []) {
      const path = column?.meta_data?.path_in_schema?.[0];
      if (typeof path === "string" && !projected.has(path)) continue;
      bytes += Number(column?.meta_data?.total_uncompressed_size ?? 0);
    }
    if (rowCount > 0) groups.push({ startRow, rowCount, bytes });
    startRow += rowCount;
  }

  return groups;
}

/**
 * Reads a shard's footer to learn how many rows it holds, which card columns
 * it carries, and how its rows are grouped.
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
 * @returns The shard's row count, card columns and row groups.
 * @throws If the file is not a readable Parquet file.
 */
export async function inspectDebateCardShard(source: ParquetSource): Promise<DebateCardShardInfo> {
  const decoder = await loadParquetDecoder();
  const metadata = await decoder.parquetMetadataAsync(source);
  const rows = metadata?.num_rows;
  const rowCount = typeof rows === "bigint" ? Number(rows) : Number(rows ?? 0);

  // Aliases are accepted, so match on the same spellings the normalizer reads.
  const present = topLevelColumnNames(decoder, metadata);
  const presentSet = new Set(present);

  const columns = DEBATE_CARD_PARQUET_COLUMN_ALIASES.filter((name) => presentSet.has(name));
  if (columns.length === 0) {
    throw new Error(
      `No debate-card columns found in this file — it has ${present.slice(0, 8).join(", ") || "no columns"}. Expected columns like id, tag, cite, fulltext.`,
    );
  }

  const known = new Set(DEBATE_CARD_PARQUET_COLUMN_ALIASES);
  // A footer that lists no row groups still has rows to read (a writer that
  // reports them differently, or a single implicit group). Reading none of
  // them would be a silent empty import, so fall back to one group spanning
  // the shard and let the byte budget size the windows inside it.
  const measured = measureRowGroups(metadata, columns);
  const rowGroups =
    measured.length > 0 || rowCount === 0
      ? measured
      : [{ startRow: 0, rowCount, bytes: source.byteLength }];

  return {
    rowCount,
    columns,
    extraColumns: present.filter((name) => !known.has(name)),
    rowGroups,
    metadata,
  };
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

/** One planned read: a half-open row range that lies inside one row group. */
export interface DebateCardReadWindow {
  rowStart: number;
  rowEnd: number;
}

/**
 * Plans the windows a read is cut into.
 *
 * Two rules, in this order:
 *
 *  1. A window never spans two row groups. A Parquet reader decodes whole
 *     column chunks, so a window that straddles a boundary pays for both
 *     groups, and consecutive straddling windows pay for every group twice.
 *  2. Inside a group, a window holds as many rows as {@link
 *     CARD_READ_WINDOW_BYTES} of decoded card text allows. A group small
 *     enough to fit is read in exactly one window, which is the case that
 *     matters: it makes the whole shard cost one pass instead of one pass per
 *     window.
 *
 * A group too large to fit in the budget is still read in several windows and
 * still decoded once per window — unavoidable without holding the group in
 * memory — but the budget is what decides that, not a fixed row count that
 * happens to be 250× too small.
 *
 * @param groups - The shard's row groups.
 * @param startRow - First row to read.
 * @param endRow - Stop before this row.
 * @param maxRows - Caller's ceiling on window size, when it set one.
 * @returns The windows to read, in shard order.
 */
export function planReadWindows(
  groups: readonly DebateCardRowGroup[],
  startRow: number,
  endRow: number,
  maxRows?: number,
): DebateCardReadWindow[] {
  const windows: DebateCardReadWindow[] = [];
  const ceiling = maxRows && maxRows > 0 ? Math.trunc(maxRows) : Infinity;

  for (const group of groups) {
    const from = Math.max(startRow, group.startRow);
    const to = Math.min(endRow, group.startRow + group.rowCount);
    if (from >= to) continue;

    const bytesPerRow = group.rowCount > 0 ? group.bytes / group.rowCount : 0;
    const budgetRows =
      bytesPerRow > 0 ? Math.floor(CARD_READ_WINDOW_BYTES / bytesPerRow) : group.rowCount;
    const windowRows = Math.max(
      1,
      Math.min(
        ceiling,
        group.rowCount,
        CARD_READ_MAX_WINDOW_ROWS,
        // The floor keeps a shard of unusually fat cards from being read a
        // handful of rows at a time, which would cost a request per handful.
        Math.max(budgetRows, CARD_READ_CHUNK_ROWS),
      ),
    );

    for (let rowStart = from; rowStart < to; rowStart += windowRows) {
      windows.push({ rowStart, rowEnd: Math.min(rowStart + windowRows, to) });
    }
  }

  return windows;
}

/**
 * Yields a shard's rows in windows, decoding only the card columns.
 *
 * @param source - The shard's bytes.
 * @param options - Row range, window ceiling and abort signal.
 * @yields One window of decoded rows at a time, in shard order.
 * @throws If the file cannot be decoded as Parquet.
 */
export async function* readDebateCardChunks(
  source: ParquetSource,
  options: ReadDebateCardOptions = {},
): AsyncGenerator<DebateCardRowChunk> {
  const { parquetReadObjects, compressors } = await loadParquetDecoder();
  const info = options.info ?? (await inspectDebateCardShard(source));
  const { rowCount: totalRows, columns, rowGroups, metadata } = info;

  const startRow = Math.max(0, Math.trunc(options.startRow ?? 0));
  const endRow = Math.min(totalRows, Math.trunc(options.endRow ?? totalRows));

  for (const window of planReadWindows(rowGroups, startRow, endRow, options.chunkRows)) {
    if (options.signal?.aborted) return;
    const rows = await parquetReadObjects({
      file: source,
      // The footer is parsed once per shard, not once per window: on a wide
      // dump it is megabytes, and re-reading it per window is a second copy of
      // the amplification the windowing itself is here to avoid.
      metadata,
      // Ask only for the card columns this shard actually has. A shard that
      // also carries embeddings or provenance blobs then costs nothing to
      // import, and one missing a column still imports the rest.
      columns,
      rowStart: window.rowStart,
      rowEnd: window.rowEnd,
      compressors,
      utf8: true,
      // Lets the decoder read just the pages a window covers when the shard
      // carries a page index, which is what makes a row group too big to hold
      // in one window cost one pass anyway.
      useOffsetIndex: true,
    });
    yield { rows, startIndex: window.rowStart };
  }
}
