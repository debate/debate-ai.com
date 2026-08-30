/**
 * @fileoverview Shared "recent cloud items" merge logic for the account
 * discoverability widgets that surface a signed-in user's cloud-saved data
 * across all three D1-backed stores idea #17 named ("save flows docs and
 * debates in SQL and link to users" — TODO.md's Product Feature Ideas idea
 * #17): REASON editor `documents`, `saved_flows`, and `saved_rounds`.
 *
 * `apps/debate-ai.com`'s `app/tools/MySavedItems.tsx` widget previously
 * merged only documents and rounds inline — flows (the middle of the three
 * named data types) were never fetched or shown, so a user with only saved
 * flows saw an empty widget despite having cloud-saved data. This module
 * extracts that merge/sort/format logic into pure, unit-tested functions so
 * a widget can include all three without duplicating the "which kind maps
 * to which route/label/timestamp-shape" logic per caller.
 *
 * Kept framework/fetch-free, matching `state/savedFlows.ts`/
 * `state/savedRounds.ts`'s split — `apps/debate-ai.com` has no vitest
 * project of its own (see `vitest.config.ts`'s `projects` list), so any
 * behavior worth testing here needs to live in a package that does.
 *
 * @module state/cloudLibrary
 */

import type { SavedFlowSummary } from "./savedFlows";
import type { SavedRoundSummary } from "./savedRounds";

/** The subset of `documents` a caller needs to list one in the merged view — mirrors `GET /api/doc/documents`'s row shape. */
export type CloudDocumentSummary = {
  id: number;
  title: string;
  updatedAt: string | number;
};

export type CloudLibraryItemKind = "document" | "flow" | "round";

export interface CloudLibraryItem {
  kind: CloudLibraryItemKind;
  /** Stable React key: `${kind}-${id}`. */
  key: string;
  href: string;
  label: string;
  /** Milliseconds since epoch, normalized from whatever timestamp shape the source row used. */
  updatedAtMs: number;
}

/**
 * Normalizes a timestamp that may arrive as an ISO date string (documents/
 * flows/rounds all serialize their drizzle `timestamp`-mode columns this
 * way through `NextResponse.json`) or as a raw number in either seconds or
 * milliseconds (a defensive fallback for a caller passing a raw D1
 * `unixepoch()` value directly) into milliseconds since epoch. Returns `0`
 * for anything unparseable so a malformed row sorts last rather than
 * throwing.
 */
export function parseCloudTimestamp(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    // A unix-seconds value is at most ~13 digits shorter than the
    // millisecond epoch would be for any date in this app's lifetime;
    // 1e12 ms is September 2001, well before any real row's timestamp, so
    // anything smaller is assumed to be seconds.
    return value < 1e12 ? value * 1000 : value;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export interface BuildRecentCloudItemsInput {
  documents?: CloudDocumentSummary[];
  flows?: SavedFlowSummary[];
  rounds?: SavedRoundSummary[];
}

export interface BuildRecentCloudItemsOptions {
  /** Max items in the merged, sorted result. Default 6. */
  limit?: number;
  /** Max items taken from each kind before merging, so one prolific kind can't crowd out the others entirely. Default 5. */
  perKindLimit?: number;
  documentHref?: string;
  flowHref?: string;
  roundHref?: string;
}

/**
 * Merges documents/flows/rounds summaries into one list, newest-first,
 * capped to `opts.limit`. Each kind is independently capped to
 * `opts.perKindLimit` first (mirroring the original inline widget logic)
 * so, e.g., 20 recently-saved flows can't push every document and round out
 * of the merged result before the final sort/slice even runs.
 */
export function buildRecentCloudItems(
  input: BuildRecentCloudItemsInput,
  opts: BuildRecentCloudItemsOptions = {},
): CloudLibraryItem[] {
  const {
    limit = 6,
    perKindLimit = 5,
    documentHref = "/reason-editor",
    flowHref = "/debate",
    roundHref = "/debate",
  } = opts;

  const documentItems: CloudLibraryItem[] = (input.documents ?? []).slice(0, perKindLimit).map((doc) => ({
    kind: "document",
    key: `document-${doc.id}`,
    href: documentHref,
    label: doc.title.trim() || "Untitled",
    updatedAtMs: parseCloudTimestamp(doc.updatedAt),
  }));

  const flowItems: CloudLibraryItem[] = (input.flows ?? []).slice(0, perKindLimit).map((flow) => ({
    kind: "flow",
    key: `flow-${flow.clientId}`,
    href: flowHref,
    label: flow.label.trim() || "Untitled flow",
    updatedAtMs: parseCloudTimestamp(flow.updatedAt),
  }));

  const roundItems: CloudLibraryItem[] = (input.rounds ?? []).slice(0, perKindLimit).map((round) => ({
    kind: "round",
    key: `round-${round.clientId}`,
    href: roundHref,
    label: round.label.trim() || "Untitled round",
    updatedAtMs: parseCloudTimestamp(round.updatedAt),
  }));

  return [...documentItems, ...flowItems, ...roundItems]
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, limit);
}

/**
 * Formats a millisecond timestamp as "Today" / "Yesterday" / "Nd ago",
 * matching the original inline widget's relative-time copy. `now` is
 * injectable so callers (and tests) don't depend on the wall clock.
 */
export function formatRelativeCloudTime(updatedAtMs: number, now: number = Date.now()): string {
  if (!Number.isFinite(updatedAtMs)) return "";
  const days = Math.floor((now - updatedAtMs) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
