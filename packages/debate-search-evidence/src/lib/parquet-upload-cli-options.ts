/**
 * @fileoverview Argument parsing and usage text for the card-upload CLI.
 *
 * Split from the CLI entry point so every flag — including the ones that
 * decide what gets written to a production library, like `--start-row` and
 * `--dry-run` — is unit-testable without a Parquet file, a network, or a
 * process to exit.
 *
 * @module lib/parquet-upload-cli-options
 */

import { CARD_READ_CHUNK_ROWS, CARD_UPLOAD_BATCH_ROWS } from "./parquet-card-import";

/** Default ingest endpoint when neither flag nor environment names one. */
export const DEFAULT_CARD_ENDPOINT = "http://localhost:3000/api/admin/debate-cards";

/** A parsed, validated invocation. */
export interface CardUploadCliOptions {
  /** Shard paths, imported one after another in this order. */
  files: string[];
  /** Ingest endpoint. */
  endpoint: string;
  /** Bearer token for the endpoint's `CARD_IMPORT_TOKEN` check. */
  token?: string;
  /** Cookie header, to reuse a signed-in admin session instead of a token. */
  cookie?: string;
  /** Cards per posted batch. */
  batchRows: number;
  /** Rows decoded per read window. */
  chunkRows: number;
  /** First row to import from each shard. */
  startRow: number;
  /** Stop each shard after this many rows; `undefined` means the whole file. */
  maxRows?: number;
  /** Read and normalize without posting anything. */
  dryRun: boolean;
  /** Import each shard independently instead of deduping ids across the run. */
  perFileDedupe: boolean;
  /** Suppress per-batch progress lines. */
  quiet: boolean;
}

/** Outcome of parsing `process.argv`. */
export type CardUploadCliParse =
  | { kind: "options"; options: CardUploadCliOptions }
  | { kind: "help" }
  | { kind: "error"; message: string };

/** Environment variables the CLI reads when a flag is omitted. */
export interface CardUploadCliEnv {
  DEBATE_CARDS_ENDPOINT?: string;
  CARD_IMPORT_TOKEN?: string;
  DEBATE_ADMIN_COOKIE?: string;
}

/** The `--help` text, also printed on a usage error. */
export const CARD_UPLOAD_CLI_USAGE = `debate-cards-upload — import debate-card Parquet shards into the card-search library.

Usage:
  debate-cards-upload <file.parquet> [more.parquet ...] [options]

Files are imported one at a time, in the order given: each shard is streamed,
normalized and posted in batches, and its own summary is printed before the
next one starts.

Options:
  --endpoint <url>    Ingest endpoint (env DEBATE_CARDS_ENDPOINT)
                      [default: ${DEFAULT_CARD_ENDPOINT}]
  --token <token>     Bearer token matching the server's CARD_IMPORT_TOKEN
                      (env CARD_IMPORT_TOKEN)
  --cookie <cookie>   Cookie header from a signed-in admin session, instead
                      of a token (env DEBATE_ADMIN_COOKIE)
  --batch <rows>      Cards per request [default: ${CARD_UPLOAD_BATCH_ROWS}]
  --chunk <rows>      Rows decoded per read [default: ${CARD_READ_CHUNK_ROWS}]
  --start-row <n>     Skip the first n rows of each shard, to resume a run
  --max-rows <n>      Import at most n rows per shard
  --per-file-dedupe   Dedupe ids within each shard only, not across the run
  --dry-run           Read and normalize, post nothing
  --quiet             Only print each shard's final summary
  -h, --help          Show this message

Examples:
  # One shard, against a locally running dev server
  debate-cards-upload cards-0000.parquet

  # A whole directory, one file at a time, against production
  CARD_IMPORT_TOKEN=... debate-cards-upload shards/*.parquet \\
    --endpoint https://debate-ai.com/api/admin/debate-cards

  # Check a shard parses and see what would be skipped, writing nothing
  debate-cards-upload cards-0000.parquet --dry-run`;

/** Flags that take a value. */
const VALUE_FLAGS = new Set([
  "--endpoint",
  "--token",
  "--cookie",
  "--batch",
  "--chunk",
  "--start-row",
  "--max-rows",
]);

/** Flags that take no value. */
const BOOLEAN_FLAGS = new Set(["--dry-run", "--per-file-dedupe", "--quiet"]);

/**
 * Parses a positive integer flag value.
 *
 * @param raw - The value as typed.
 * @param flag - The flag it belongs to, for the error message.
 * @param minimum - Smallest accepted value.
 * @returns The number, or an error message.
 */
function parseCount(
  raw: string,
  flag: string,
  minimum: number,
): { value: number } | { error: string } {
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < minimum) {
    return { error: `${flag} expects an integer of at least ${minimum}, got "${raw}".` };
  }
  return { value };
}

/**
 * Parses CLI arguments into {@link CardUploadCliOptions}.
 *
 * @param argv - Arguments after the script name.
 * @param env - Environment used for defaults.
 * @returns The parsed options, a request for help, or a usage error.
 */
export function parseCardUploadArgs(
  argv: readonly string[],
  env: CardUploadCliEnv = {},
): CardUploadCliParse {
  const files: string[] = [];
  const values: Record<string, string> = {};
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") return { kind: "help" };

    if (VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { kind: "error", message: `${arg} needs a value.` };
      }
      values[arg] = value;
      index++;
      continue;
    }

    // `--flag=value` is as natural to type as `--flag value`, and silently
    // treating it as a file path would import nothing and say nothing.
    const equals = arg.indexOf("=");
    if (arg.startsWith("--") && equals > 2) {
      const name = arg.slice(0, equals);
      if (VALUE_FLAGS.has(name)) {
        values[name] = arg.slice(equals + 1);
        continue;
      }
    }

    if (BOOLEAN_FLAGS.has(arg)) {
      flags.add(arg);
      continue;
    }

    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown option "${arg}".` };
    }

    files.push(arg);
  }

  if (files.length === 0) {
    return { kind: "error", message: "Name at least one .parquet file to import." };
  }

  const counts: Record<string, number> = {};
  for (const [flag, minimum] of [
    ["--batch", 1],
    ["--chunk", 1],
    ["--start-row", 0],
    ["--max-rows", 1],
  ] as const) {
    if (values[flag] === undefined) continue;
    const parsed = parseCount(values[flag], flag, minimum);
    if ("error" in parsed) return { kind: "error", message: parsed.error };
    counts[flag] = parsed.value;
  }

  const endpoint = values["--endpoint"] ?? env.DEBATE_CARDS_ENDPOINT ?? DEFAULT_CARD_ENDPOINT;
  try {
    new URL(endpoint);
  } catch {
    return { kind: "error", message: `--endpoint is not a valid URL: "${endpoint}".` };
  }

  return {
    kind: "options",
    options: {
      files,
      endpoint,
      token: values["--token"] ?? env.CARD_IMPORT_TOKEN,
      cookie: values["--cookie"] ?? env.DEBATE_ADMIN_COOKIE,
      batchRows: counts["--batch"] ?? CARD_UPLOAD_BATCH_ROWS,
      chunkRows: counts["--chunk"] ?? CARD_READ_CHUNK_ROWS,
      startRow: counts["--start-row"] ?? 0,
      maxRows: counts["--max-rows"],
      dryRun: flags.has("--dry-run"),
      perFileDedupe: flags.has("--per-file-dedupe"),
      quiet: flags.has("--quiet"),
    },
  };
}
