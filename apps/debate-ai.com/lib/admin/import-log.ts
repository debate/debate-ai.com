/**
 * @fileoverview Structured logging for admin bulk imports.
 *
 * Import failures are reported by an operator hours after the fact ("the DOCX
 * upload isn't working"), so the log has to answer *which file*, *which
 * stage*, and *why* without a reproduction. Every line is a single JSON object
 * on one line, prefixed with a stable tag so `wrangler tail` and the
 * Cloudflare dashboard can filter to `[admin-import]`, and each line carries
 * the same `importId` the uploader shows the operator — so a screenshot of the
 * admin panel is enough to find the matching server logs.
 *
 * @module lib/admin/import-log
 */

/** Prefix every import log line carries, for log-search filtering. */
export const IMPORT_LOG_TAG = "[admin-import]";

/** Where in the import an event happened. */
export type ImportStage =
  /** Upload received and accepted for processing. */
  | "received"
  /** Upload refused before any file was read. */
  | "rejected"
  /** One file inside the upload could not be converted. */
  | "file-failed"
  /** Every file imported. */
  | "succeeded"
  /** Some files imported, some failed. */
  | "partial"
  /** No file imported. */
  | "failed"
  /** The handler itself threw. */
  | "crashed";

export interface ImportLogEvent {
  /** Correlates every line of one import run, and is shown to the operator. */
  importId: string;
  stage: ImportStage;
  /** Admin email, when the request carried a session. */
  admin?: string | null;
  fileName?: string;
  fileSize?: number;
  contentType?: string | null;
  /** Machine-readable failure cause from the importer. */
  code?: string;
  /** Operator-facing explanation. */
  reason?: string;
  counts?: { found: number; imported: number; failed: number };
  durationMs?: number;
  /** The thrown value, if any — serialized to name, message and stack. */
  error?: unknown;
}

/** Stages that represent something going wrong. */
const FAILURE_STAGES = new Set<ImportStage>(["rejected", "file-failed", "failed", "crashed"]);

/**
 * Serializes a thrown value into something JSON can carry.
 *
 * `Error` is not JSON-serializable — `JSON.stringify(new Error("x"))` yields
 * `{}` — which is exactly how a stack trace goes missing from production logs.
 *
 * @param error - The value a `catch` received.
 * @returns A plain object describing it, or `undefined` when there was none.
 */
export function serializeError(
  error: unknown,
): { name: string; message: string; stack?: string } | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: typeof error, message: String(error) };
}

/**
 * Builds the JSON payload for one import log line.
 *
 * Split out from {@link logImportEvent} so the shape can be asserted without
 * capturing console output.
 *
 * @param event - What happened.
 * @returns The object that gets serialized to the log.
 */
export function buildImportLogPayload(event: ImportLogEvent): Record<string, unknown> {
  const { error, ...rest } = event;
  const payload: Record<string, unknown> = { ...rest, at: new Date().toISOString() };
  const serialized = serializeError(error);
  if (serialized) payload.error = serialized;
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }
  return payload;
}

/**
 * Writes one import event to the server log.
 *
 * Failures go to `console.error` so they surface in error-only log views;
 * progress goes to `console.info`.
 *
 * @param event - What happened.
 */
export function logImportEvent(event: ImportLogEvent): void {
  const line = `${IMPORT_LOG_TAG} ${JSON.stringify(buildImportLogPayload(event))}`;
  if (FAILURE_STAGES.has(event.stage)) console.error(line);
  else console.info(line);
}

/**
 * Mints an id that ties the operator's screen to the server logs.
 *
 * @returns A short, sortable, collision-resistant run id.
 */
export function newImportId(): string {
  return `imp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
