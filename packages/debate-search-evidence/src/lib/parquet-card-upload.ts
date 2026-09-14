/**
 * @fileoverview Drives one Parquet shard from bytes to the card library.
 *
 * Reads the shard in windows ({@link readDebateCardChunks}), normalizes each
 * window ({@link normalizeDebateCardRows}), drops ids already sent in this
 * run, and hands the rest to a sender in fixed-size batches — reporting
 * progress after every batch so a half-hour import is never a blank screen.
 *
 * The sender is injected rather than assumed, because the two callers post
 * the same batches with different credentials: the CLI with a bearer token
 * over the network, the admin panel with the operator's own session cookie.
 * {@link createCardBatchSender} builds the HTTP one both of them use.
 *
 * Shards are imported one at a time on purpose. Concurrent shards would
 * multiply peak memory by the number of files and interleave failures from
 * different shards in the same report, and the bottleneck is the ingest
 * endpoint anyway — so a run over ten files is ten sequential imports, each
 * with its own summary.
 *
 * @module lib/parquet-card-upload
 */

import {
  CARD_UPLOAD_BATCH_ROWS,
  chunkForUpload,
  dedupeCardsById,
  emptyCardImportProgress,
  normalizeDebateCardRows,
  type CardImportProgress,
  type DebateCardRecord,
  type DebateCardRowFailure,
} from "./parquet-card-import";
import {
  inspectDebateCardShard,
  readDebateCardChunks,
  type ParquetSource,
} from "./parquet-card-reader";

/** What the ingest endpoint reports back for one posted batch. */
export interface CardBatchResult {
  /** Rows written to the library. */
  imported: number;
  /** Rows the server itself rejected. */
  skipped?: number;
  /** Why the server rejected them. */
  failures?: DebateCardRowFailure[];
}

/** Posts one batch of cards and resolves with what the server did. */
export type CardBatchSender = (
  cards: DebateCardRecord[],
  context: { fileName: string; batchIndex: number },
) => Promise<CardBatchResult>;

/** Inputs for {@link uploadDebateCardShard}. */
export interface UploadDebateCardShardOptions {
  /** The shard's bytes. */
  source: ParquetSource;
  /** File name, used in progress lines and stored as the row's origin. */
  fileName: string;
  /** How batches reach the library. */
  send: CardBatchSender;
  /** Called after each batch, and once before the first read. */
  onProgress?: (progress: CardImportProgress) => void;
  /** First row to import; used to resume an interrupted run. */
  startRow?: number;
  /** Stop before this row; defaults to the end of the shard. */
  endRow?: number;
  /** Cards per posted batch. */
  batchRows?: number;
  /** Rows decoded per read window. */
  chunkRows?: number;
  /** Aborts between batches. */
  signal?: { aborted: boolean };
  /**
   * Ids already imported. Shared across a multi-file run so a card that
   * appears in two shards is written once; pass a fresh set to import each
   * shard independently.
   */
  seenIds?: Set<number>;
  /** Read and normalize, but post nothing. */
  dryRun?: boolean;
  /** How many rejected rows to keep for the report. */
  maxReportedFailures?: number;
}

/** What one shard's import did. */
export interface DebateCardShardOutcome {
  fileName: string;
  progress: CardImportProgress;
  /** The first {@link UploadDebateCardShardOptions.maxReportedFailures} rejections. */
  failures: DebateCardRowFailure[];
  /** Batches posted (zero for a dry run). */
  batches: number;
  /** Shard columns that carry no card field, worth naming once in the log. */
  extraColumns: string[];
}

/** Rejections kept per shard; enough to spot a pattern, bounded for memory. */
const DEFAULT_MAX_REPORTED_FAILURES = 50;

/**
 * Imports one Parquet shard into the card library.
 *
 * @param options - Shard bytes, sender, and range/batching controls.
 * @returns Row totals, the batches posted, and the first rejected rows.
 * @throws If the file cannot be read as a card shard, or a batch fails to
 *   post — a failed batch stops the shard rather than silently continuing,
 *   so the operator can fix the cause and resume from the reported row.
 */
export async function uploadDebateCardShard(
  options: UploadDebateCardShardOptions,
): Promise<DebateCardShardOutcome> {
  const {
    source,
    fileName,
    send,
    onProgress,
    startRow = 0,
    endRow,
    batchRows = CARD_UPLOAD_BATCH_ROWS,
    chunkRows,
    signal,
    seenIds = new Set<number>(),
    dryRun = false,
    maxReportedFailures = DEFAULT_MAX_REPORTED_FAILURES,
  } = options;

  const info = await inspectDebateCardShard(source);
  const { rowCount, extraColumns } = info;
  // Progress is measured against the range actually being imported, so a
  // resumed run (`--start-row`) or a capped one reads to 100%, not to the
  // fraction of the shard the range happens to cover.
  const lastRow = Math.min(rowCount, endRow ?? rowCount);
  const progress = emptyCardImportProgress(Math.max(0, lastRow - Math.min(startRow, lastRow)));
  onProgress?.({ ...progress });

  const failures: DebateCardRowFailure[] = [];
  let batches = 0;

  for await (const chunk of readDebateCardChunks(source, {
    startRow,
    endRow,
    chunkRows,
    signal,
    info,
  })) {
    if (signal?.aborted) break;

    const normalized = normalizeDebateCardRows(chunk.rows, chunk.startIndex);
    progress.read += chunk.rows.length;
    progress.skipped += normalized.failures.length;
    for (const failure of normalized.failures) {
      if (failures.length < maxReportedFailures) failures.push(failure);
    }

    const { cards, duplicates } = dedupeCardsById(normalized.cards, seenIds);
    progress.duplicates += duplicates;

    for (const batch of chunkForUpload(cards, batchRows)) {
      if (signal?.aborted) break;
      if (dryRun) {
        progress.imported += batch.length;
        onProgress?.({ ...progress });
        continue;
      }

      const result = await send(batch, { fileName, batchIndex: batches });
      batches++;
      progress.imported += result.imported;
      progress.skipped += result.skipped ?? 0;
      for (const failure of result.failures ?? []) {
        if (failures.length < maxReportedFailures) failures.push(failure);
      }
      onProgress?.({ ...progress });
    }
  }

  return { fileName, progress: { ...progress }, failures, batches, extraColumns };
}

/** Credentials and target for the HTTP sender. */
export interface CardBatchSenderOptions {
  /** Ingest endpoint, e.g. `https://debate-ai.com/api/admin/debate-cards`. */
  endpoint: string;
  /** Bearer token for `CARD_IMPORT_TOKEN`; omit when using a session cookie. */
  token?: string;
  /** Cookie header, for reusing a signed-in admin session from the CLI. */
  cookie?: string;
  /** Correlates every batch of one run in the server logs. */
  importId?: string;
  /** Injected for tests and for browsers that need credentialed requests. */
  fetchImpl?: typeof fetch;
  /** Attempts per batch before giving up. */
  maxAttempts?: number;
  /** Base delay between retries, doubled per attempt. */
  retryDelayMs?: number;
  /** Sleep hook, so tests need not wait out the backoff. */
  sleep?: (ms: number) => Promise<void>;
}

/** HTTP statuses worth retrying: transient server and rate-limit errors. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Builds the sender that posts batches to the ingest endpoint.
 *
 * Retries with exponential backoff, because a shard is thousands of requests
 * and one 500 partway through should not cost the whole import — batches are
 * upserts keyed by card id, so re-posting one is safe.
 *
 * @param options - Endpoint, credentials and retry policy.
 * @returns A {@link CardBatchSender}.
 */
export function createCardBatchSender(options: CardBatchSenderOptions): CardBatchSender {
  const {
    endpoint,
    token,
    cookie,
    importId,
    fetchImpl = fetch,
    maxAttempts = 4,
    retryDelayMs = 1_000,
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  return async (cards, context) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    if (cookie) headers.cookie = cookie;

    let lastError = "";
    for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers,
          credentials: cookie ? undefined : "include",
          body: JSON.stringify({
            importId,
            fileName: context.fileName,
            cards,
          }),
        });
      } catch (error) {
        // A dropped connection mid-shard is the common case on a long import;
        // treat it exactly like a 5xx rather than ending the run.
        lastError = `${(error as Error).message}`;
        if (attempt < maxAttempts) await sleep(retryDelayMs * 2 ** (attempt - 1));
        continue;
      }

      if (response.ok) {
        const body = (await response.json().catch(() => ({}))) as CardBatchResult;
        return {
          imported: Number(body.imported ?? 0),
          skipped: Number(body.skipped ?? 0),
          failures: Array.isArray(body.failures) ? body.failures : [],
        };
      }

      const text = await response.text().catch(() => "");
      lastError = `HTTP ${response.status}${text ? `: ${text.slice(0, 300)}` : ""}`;
      if (!isRetryableStatus(response.status) || attempt >= maxAttempts) break;
      await sleep(retryDelayMs * 2 ** (attempt - 1));
    }

    throw new Error(
      `Batch ${context.batchIndex + 1} of ${context.fileName} failed after ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"} — ${lastError}`,
    );
  };
}
