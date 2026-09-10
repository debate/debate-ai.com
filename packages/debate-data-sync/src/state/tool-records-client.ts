/**
 * @fileoverview Network calls for the shared tool-record sync — the
 * `/api/tool-records/[collection]` route pair backing every collection in
 * `state/toolRecordCollections.ts`.
 *
 * Kept separate from that module's pure helpers so those stay unit-testable
 * without mocking `fetch`, mirroring `tournament-results-client.ts`'s split
 * from `savedTournamentResults.ts`.
 *
 * `listToolRecords` resolves to `null` (rather than throwing) on a `401`, so
 * a signed-out browser falls back to localStorage-only rather than showing an
 * error — the same contract `listSavedTournamentResults` has. The write calls
 * throw a {@link ToolRecordSyncError}, since their caller has already applied
 * the change locally: a failed cloud sync is reported but never blocks local
 * saving. That error carries the HTTP `status` rather than only a message, so
 * the mirror can tell "your session expired" (stop trying) from "D1 hiccuped"
 * (the next write is worth attempting) without pattern-matching prose.
 *
 * @module state/tool-records-client
 */

const BASE_ENDPOINT = "/api/tool-records";

/** A failed tool-record sync request, carrying the response status. */
export class ToolRecordSyncError extends Error {
  constructor(
    message: string,
    /** HTTP status of the refusing response. */
    readonly status: number,
  ) {
    super(message);
    this.name = "ToolRecordSyncError";
  }
}

/** The route for one collection. */
function collectionEndpoint(collection: string, base = BASE_ENDPOINT): string {
  return `${base}/${encodeURIComponent(collection)}`;
}

async function syncError(res: Response, fallback: string): Promise<ToolRecordSyncError> {
  let message = fallback;
  try {
    const payload = (await res.json()) as { error?: string };
    if (payload?.error) message = payload.error;
  } catch {
    // An error response with no JSON body keeps the fallback message.
  }
  return new ToolRecordSyncError(message, res.status);
}

/**
 * Lists every record the current user's account holds for one collection,
 * oldest first.
 *
 * @param collection - A key from `TOOL_RECORD_COLLECTIONS`.
 * @param base - Endpoint override, for tests.
 * @returns The records, or `null` when signed out (a `401` response).
 */
export async function listToolRecords(
  collection: string,
  base = BASE_ENDPOINT,
): Promise<unknown[] | null> {
  const res = await fetch(collectionEndpoint(collection, base));
  if (res.status === 401) return null;
  if (!res.ok) {
    throw await syncError(res, "Failed to load your synced tool data.");
  }
  const payload = (await res.json()) as unknown;
  return Array.isArray(payload) ? payload : [];
}

/**
 * Upserts one record into the current user's account, keyed by its id within
 * the collection. Throws on failure, `401` included.
 *
 * @param collection - A key from `TOOL_RECORD_COLLECTIONS`.
 * @param recordId - The record's id, as `toolRecordId` reads it.
 * @param record - The record to store.
 * @param base - Endpoint override, for tests.
 */
export async function saveToolRecordToAccount(
  collection: string,
  recordId: string,
  record: unknown,
  base = BASE_ENDPOINT,
): Promise<void> {
  const res = await fetch(
    `${collectionEndpoint(collection, base)}/${encodeURIComponent(recordId)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ record }),
    },
  );
  if (!res.ok) {
    throw await syncError(res, "Failed to sync this to your account.");
  }
}

/**
 * Upserts many records at once — what a first sign-in uses to push a browser's
 * existing store up, rather than one request per record. Throws on failure.
 *
 * @param collection - A key from `TOOL_RECORD_COLLECTIONS`.
 * @param records - The records to store.
 * @param base - Endpoint override, for tests.
 */
export async function saveToolRecordsToAccount(
  collection: string,
  records: readonly unknown[],
  base = BASE_ENDPOINT,
): Promise<void> {
  if (records.length === 0) return;
  const res = await fetch(collectionEndpoint(collection, base), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records }),
  });
  if (!res.ok) {
    throw await syncError(res, "Failed to sync this tool's data to your account.");
  }
}

/**
 * Removes one synced record from the current user's account. Throws on
 * failure, `401` included.
 *
 * @param collection - A key from `TOOL_RECORD_COLLECTIONS`.
 * @param recordId - The record's id.
 * @param base - Endpoint override, for tests.
 */
export async function deleteToolRecordFromAccount(
  collection: string,
  recordId: string,
  base = BASE_ENDPOINT,
): Promise<void> {
  const res = await fetch(
    `${collectionEndpoint(collection, base)}/${encodeURIComponent(recordId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw await syncError(res, "Failed to remove this from your account.");
  }
}

/**
 * Removes every one of the current user's synced records for a collection —
 * what a tool's own "clear history" action mirrors. Throws on failure.
 *
 * @param collection - A key from `TOOL_RECORD_COLLECTIONS`.
 * @param base - Endpoint override, for tests.
 */
export async function clearToolRecordsInAccount(
  collection: string,
  base = BASE_ENDPOINT,
): Promise<void> {
  const res = await fetch(collectionEndpoint(collection, base), { method: "DELETE" });
  if (!res.ok) {
    throw await syncError(res, "Failed to clear this tool's synced data.");
  }
}
