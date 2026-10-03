/**
 * @fileoverview Adapts the Flow workspace's `speech-doc-links` store — a map
 * of `"<scope>:<SPEECH>"` to `{ docId, title, linkedAt }`, see
 * `debate-round`'s `state/speechDocLinks.ts` — to the array-of-records shape
 * `TOOL_RECORD_COLLECTIONS` syncs.
 *
 * Each link becomes one record whose `id` is the map key, so a link made on
 * one device (a speech pointed at a REASON `documents` row) reaches the
 * account row-by-row and a re-link on another device only touches its own
 * speech. `docId` is the user's own `documents.id`, which is why the link is
 * worth carrying to the account at all: the flow that references it already
 * syncs through `saved_flows`.
 *
 * Pure — no storage or network — so the sync, the route's tests and the
 * catalog test can all import it.
 *
 * @module state/speech-doc-links-codec
 */

/** One synced link: the map key as `id`, plus the link's own fields. */
export interface SpeechDocLinkRecord {
  id: string;
  docId: number;
  title: string;
  linkedAt: number;
}

/**
 * Flattens the stored map into records, dropping any entry that isn't a
 * well-formed link (anything else in a hand-edited or older store stays out
 * of the sync rather than failing it).
 *
 * @param raw - The parsed `speech-doc-links` value.
 */
export function decodeSpeechDocLinks(raw: unknown): SpeechDocLinkRecord[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  const records: SpeechDocLinkRecord[] = [];
  for (const [id, value] of Object.entries(raw)) {
    if (id.trim().length === 0 || typeof value !== "object" || value === null) continue;
    const { docId, title, linkedAt } = value as Record<string, unknown>;
    if (typeof docId !== "number" || !Number.isFinite(docId)) continue;
    records.push({
      id,
      docId,
      title: typeof title === "string" ? title : "",
      linkedAt: typeof linkedAt === "number" && Number.isFinite(linkedAt) ? linkedAt : 0,
    });
  }
  return records;
}

/**
 * Rebuilds the stored map from records (the inverse of
 * {@link decodeSpeechDocLinks}), in the exact shape `getSpeechDocLink` reads.
 *
 * @param records - Records merged from the account and this browser.
 */
export function encodeSpeechDocLinks(
  records: readonly unknown[],
): Record<string, { docId: number; title: string; linkedAt: number }> {
  const map: Record<string, { docId: number; title: string; linkedAt: number }> = {};
  for (const record of decodeSpeechDocLinkRecords(records)) {
    map[record.id] = { docId: record.docId, title: record.title, linkedAt: record.linkedAt };
  }
  return map;
}

function decodeSpeechDocLinkRecords(records: readonly unknown[]): SpeechDocLinkRecord[] {
  const byId: Record<string, unknown> = {};
  for (const record of records) {
    if (typeof record !== "object" || record === null) continue;
    const { id, ...link } = record as Record<string, unknown>;
    if (typeof id === "string") byId[id] = link;
  }
  return decodeSpeechDocLinks(byId);
}
