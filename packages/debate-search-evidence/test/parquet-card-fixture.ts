/**
 * @fileoverview Builds real Parquet shards for the importer's tests.
 *
 * The importer's job is reading Parquet, so its tests read Parquet: these
 * helpers write an actual file — Snappy-compressed, multiple row groups, int64
 * columns as `BigInt` exactly as the published dump has them — rather than
 * faking the decoder. A stub reader would pass while the real one fails on the
 * first column that isn't a plain string.
 */

import { parquetWriteBuffer } from "hyparquet-writer";
import type { ParquetSource } from "../src/lib/parquet-card-reader";

/** How one row of the fixture shard differs from the default card. */
export interface FixtureRowOverrides {
  /** Blank every text column, making the row an unimportable artifact. */
  empty?: boolean;
  /** Force a specific card id, e.g. to repeat one. */
  id?: number;
}

/** Options for {@link buildCardShard}. */
export interface BuildCardShardOptions {
  /** Rows to write. */
  rowCount?: number;
  /** Per-row overrides, keyed by row index. */
  rows?: Record<number, FixtureRowOverrides>;
  /** Rows per row group, so multi-group reads are exercised. */
  rowGroupSize?: number;
  /** Card columns to leave out entirely. */
  omitColumns?: string[];
  /** Extra non-card columns to include, as the real dump exports do. */
  extraColumns?: string[];
  /** Write `snake_case` column names instead of camelCase. */
  snakeCase?: boolean;
}

/** camelCase → snake_case for the columns the dump renames. */
const SNAKE_CASE_NAMES: Record<string, string> = {
  textLength: "text_length",
  bucketId: "bucket_id",
  duplicateCount: "duplicate_count",
  caselistDisplayName: "caselist_display_name",
};

/**
 * Writes a Parquet shard shaped like the published card dump.
 *
 * @param options - Row count, per-row overrides and schema variations.
 * @returns The shard's bytes.
 */
export function buildCardShard(options: BuildCardShardOptions = {}): ArrayBuffer {
  const {
    rowCount = 10,
    rows = {},
    rowGroupSize = 4,
    omitColumns = [],
    extraColumns = [],
    snakeCase = false,
  } = options;

  const strings: Record<string, string[]> = {
    tag: [],
    cite: [],
    fullcite: [],
    summary: [],
    spoken: [],
    fulltext: [],
    markup: [],
    pocket: [],
    hat: [],
    block: [],
    side: [],
    caselistDisplayName: [],
    event: [],
    level: [],
  };
  const numbers: Record<string, bigint[]> = {
    id: [],
    textLength: [],
    bucketId: [],
    duplicateCount: [],
    year: [],
  };

  for (let index = 0; index < rowCount; index++) {
    const override = rows[index] ?? {};
    const empty = override.empty ?? false;

    numbers.id.push(BigInt(override.id ?? index + 1));
    numbers.textLength.push(BigInt(empty ? 0 : 2_957));
    numbers.bucketId.push(BigInt(5_339 + index));
    numbers.duplicateCount.push(BigInt(index % 7));
    numbers.year.push(BigInt(2_020 + (index % 3)));

    strings.tag.push(empty ? "" : `Warming causes extinction ${index}`);
    strings.cite.push(empty ? "" : `Ng ${19 + (index % 5)}`);
    strings.fullcite.push(empty ? "" : `Yew-Kwang Ng, Professor of Economics, row ${index}`);
    strings.summary.push(empty ? "" : `climate causing extinction ${index}`);
    strings.spoken.push(empty ? "" : `Catastrophic climate change row ${index}`);
    strings.fulltext.push(empty ? "" : `Full body text for card ${index}. `.repeat(4));
    strings.markup.push(empty ? "" : `<h4>Warming causes extinction ${index}</h4>`);
    strings.pocket.push("1nc");
    strings.hat.push("OFF");
    strings.block.push("DA");
    strings.side.push(index % 2 ? "n" : "a");
    strings.caselistDisplayName.push("HS Policy 2020-21");
    strings.event.push(index % 2 ? "CX" : "LD");
    strings.level.push(index % 2 ? "hs" : "college");
  }

  const omitted = new Set(omitColumns);
  const rename = (name: string) => (snakeCase ? (SNAKE_CASE_NAMES[name] ?? name) : name);

  const columnData: Array<{ name: string; data: unknown[]; type?: "INT64" }> = [];
  for (const [name, data] of Object.entries(numbers)) {
    if (omitted.has(name)) continue;
    columnData.push({ name: rename(name), data, type: "INT64" });
  }
  for (const [name, data] of Object.entries(strings)) {
    if (omitted.has(name)) continue;
    columnData.push({ name: rename(name), data });
  }
  for (const name of extraColumns) {
    columnData.push({
      name,
      data: Array.from({ length: rowCount }, (_, index) => `ignored-${index}`),
    });
  }

  // The writer's default codec is SNAPPY, so the fixture exercises the
  // decompression path the real shards need rather than plain pages.
  return parquetWriteBuffer({ columnData, rowGroupSize });
}

/** Wraps an in-memory buffer as the random-access source the reader takes. */
export function shardSource(buffer: ArrayBuffer): ParquetSource {
  return {
    byteLength: buffer.byteLength,
    slice: (start: number, end?: number) => buffer.slice(start, end ?? buffer.byteLength),
  };
}
