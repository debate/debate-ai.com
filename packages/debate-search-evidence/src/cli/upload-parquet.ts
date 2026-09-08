#!/usr/bin/env bun
/**
 * @fileoverview `debate-cards-upload` — imports debate-card Parquet shards
 * into the card-search library, one file at a time.
 *
 * The published card dump comes as a set of Parquet shards, each hundreds of
 * megabytes of card HTML. This CLI streams one shard at a time out of the
 * file, normalizes its rows, and posts them to the admin ingest endpoint in
 * batches — so importing a corpus larger than the machine's memory is a
 * matter of naming the files, and a shard that fails partway through can be
 * resumed from the row it stopped at (`--start-row`) rather than restarted.
 *
 * Everything but the file and console I/O lives in `lib/`, shared verbatim
 * with the admin panel's uploader: same normalization, same batching, same
 * ingest endpoint. A row this CLI skips is a row the admin panel skips.
 *
 * Usage:
 *   bun run packages/debate-search-evidence/src/cli/upload-parquet.ts \
 *     shards/cards-0000.parquet --endpoint https://debate-ai.com/api/admin/debate-cards
 *
 * Run with `--help` for the full flag list.
 *
 * @module cli/upload-parquet
 */

import { open, stat } from "node:fs/promises";
import { basename } from "node:path";
import {
  cardImportPercent,
  formatCardImportSummary,
  type CardImportProgress,
} from "../lib/parquet-card-import";
import type { ParquetSource } from "../lib/parquet-card-reader";
import {
  createCardBatchSender,
  uploadDebateCardShard,
  type DebateCardShardOutcome,
} from "../lib/parquet-card-upload";
import {
  CARD_UPLOAD_CLI_USAGE,
  parseCardUploadArgs,
  type CardUploadCliOptions,
} from "../lib/parquet-upload-cli-options";

/** Ties every batch of this run together in the server's import log. */
const IMPORT_ID = `cli_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Erases the current terminal line before printing a final summary over it. */
const CLEAR_LINE = "\r\u001b[K";

/**
 * Opens a local Parquet file as a random-access byte source.
 *
 * The decoder reads a footer and then individual column chunks, so the file
 * is held open for the length of the import and read by offset — never
 * loaded whole, which is the point: shards are routinely larger than the
 * heap the CLI runs in.
 *
 * @param path - Path to the shard.
 * @returns The byte source and a `close` to release the handle.
 */
async function openParquetFile(
  path: string,
): Promise<{ source: ParquetSource; close: () => Promise<void> }> {
  const { size } = await stat(path);
  const handle = await open(path, "r");
  return {
    source: {
      byteLength: size,
      async slice(start: number, end?: number): Promise<ArrayBuffer> {
        const from = Math.max(0, Math.min(start, size));
        const to = Math.max(from, Math.min(end ?? size, size));
        const length = to - from;
        if (length === 0) return new ArrayBuffer(0);
        const buffer = Buffer.allocUnsafe(length);
        let read = 0;
        // A single positional read can come back short; looping is what makes
        // a multi-gigabyte shard read correctly rather than fail as a corrupt
        // page somewhere past the first short read.
        while (read < length) {
          const { bytesRead } = await handle.read(buffer, read, length - read, from + read);
          if (bytesRead === 0) break;
          read += bytesRead;
        }
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + read);
      },
    },
    close: () => handle.close(),
  };
}

/** Formats a byte count for the per-file header line. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/** Renders a live progress line for one shard. */
export function formatProgressLine(fileName: string, progress: CardImportProgress): string {
  const percent = cardImportPercent(progress);
  const scale = percent === null ? "" : ` ${percent}%`;
  const skipped = progress.skipped + progress.duplicates;
  const skippedNote = skipped > 0 ? `, ${skipped.toLocaleString()} skipped` : "";
  return `  ${fileName}${scale} — ${progress.imported.toLocaleString()} imported${skippedNote}`;
}

/**
 * Imports one shard and prints its progress and summary.
 *
 * @param path - Path to the shard.
 * @param options - Parsed CLI options.
 * @param seenIds - Ids already imported in this run.
 * @returns The shard's outcome.
 */
async function importOneShard(
  path: string,
  options: CardUploadCliOptions,
  seenIds: Set<number>,
): Promise<DebateCardShardOutcome> {
  const fileName = basename(path);
  const { source, close } = await openParquetFile(path);

  try {
    console.log(`\n${fileName} (${formatBytes(source.byteLength)})`);

    const isTty = Boolean(process.stdout.isTTY);
    let lastPrintedAt = 0;

    const outcome = await uploadDebateCardShard({
      source,
      fileName,
      seenIds,
      startRow: options.startRow,
      endRow: options.maxRows === undefined ? undefined : options.startRow + options.maxRows,
      batchRows: options.batchRows,
      chunkRows: options.chunkRows,
      dryRun: options.dryRun,
      send: createCardBatchSender({
        endpoint: options.endpoint,
        token: options.token,
        cookie: options.cookie,
        importId: IMPORT_ID,
      }),
      onProgress: (progress) => {
        if (options.quiet) return;
        // On a TTY the line is rewritten in place; piped to a file or a CI log
        // it would otherwise be thousands of near-identical lines, so there it
        // is throttled to one every few seconds.
        if (isTty) {
          process.stdout.write(`\r${formatProgressLine(fileName, progress)}   `);
          return;
        }
        const now = Date.now();
        if (now - lastPrintedAt > 5_000) {
          lastPrintedAt = now;
          console.log(formatProgressLine(fileName, progress));
        }
      },
    });

    if (!options.quiet && isTty) process.stdout.write(CLEAR_LINE);
    console.log(
      `  ${formatCardImportSummary(fileName, outcome.progress)}${options.dryRun ? " (dry run — nothing written)" : ""}`,
    );

    if (outcome.extraColumns.length > 0) {
      console.log(
        `  Ignored ${outcome.extraColumns.length} non-card column(s): ${outcome.extraColumns.slice(0, 6).join(", ")}`,
      );
    }

    for (const failure of outcome.failures.slice(0, 10)) {
      console.warn(
        `  row ${failure.rowIndex}${failure.id ? ` (id ${failure.id})` : ""}: ${failure.code} — ${failure.reason}`,
      );
    }
    if (outcome.failures.length > 10) {
      console.warn(`  …and ${outcome.failures.length - 10} more skipped rows.`);
    }

    return outcome;
  } finally {
    await close();
  }
}

/**
 * CLI entry point.
 *
 * Imports each named shard in turn, and keeps going after a shard fails so
 * one bad file in a directory glob does not abandon the rest — the exit code
 * still reports that something failed.
 *
 * @param argv - Arguments after the script name.
 * @returns The process exit code.
 */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const parsed = parseCardUploadArgs(argv, process.env as Record<string, string>);

  if (parsed.kind === "help") {
    console.log(CARD_UPLOAD_CLI_USAGE);
    return 0;
  }
  if (parsed.kind === "error") {
    console.error(`${parsed.message}\n\n${CARD_UPLOAD_CLI_USAGE}`);
    return 2;
  }

  const options = parsed.options;
  if (!options.dryRun && !options.token && !options.cookie) {
    console.error(
      "No credentials: pass --token (or set CARD_IMPORT_TOKEN) for a deployed endpoint, or --cookie with a signed-in admin session. Use --dry-run to parse a shard without writing.",
    );
    return 2;
  }

  console.log(
    `Importing ${options.files.length} file${options.files.length === 1 ? "" : "s"} into ${options.endpoint}${options.dryRun ? " (dry run)" : ""}`,
  );
  console.log(`Import id ${IMPORT_ID} — quote it when searching the server logs.`);

  const seenIds = new Set<number>();
  const totals = { imported: 0, skipped: 0, duplicates: 0, read: 0 };
  const failedFiles: Array<{ file: string; error: string }> = [];

  for (const path of options.files) {
    try {
      const outcome = await importOneShard(
        path,
        options,
        options.perFileDedupe ? new Set<number>() : seenIds,
      );
      totals.imported += outcome.progress.imported;
      totals.skipped += outcome.progress.skipped;
      totals.duplicates += outcome.progress.duplicates;
      totals.read += outcome.progress.read;
    } catch (error) {
      const message = (error as Error).message;
      failedFiles.push({ file: basename(path), error: message });
      console.error(`  ${basename(path)} failed: ${message}`);
    }
  }

  const importedFiles = options.files.length - failedFiles.length;
  console.log(
    `\nDone: ${totals.imported.toLocaleString()} cards imported from ${importedFiles}/${options.files.length} file(s); ${totals.read.toLocaleString()} rows read, ${totals.skipped.toLocaleString()} skipped, ${totals.duplicates.toLocaleString()} duplicate ids.`,
  );

  if (failedFiles.length > 0) {
    console.error(`\n${failedFiles.length} file(s) failed:`);
    for (const failure of failedFiles) console.error(`  ${failure.file}: ${failure.error}`);
    return 1;
  }
  return 0;
}

// `import.meta.main` is set by Bun; the `process.argv` check covers `node`
// and `tsx`, so the module stays importable by tests under either runtime.
const isDirectRun =
  (import.meta as { main?: boolean }).main ??
  process.argv[1]?.endsWith("upload-parquet.ts") ??
  false;

if (isDirectRun) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}
