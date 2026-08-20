/**
 * @fileoverview Network calls for the server-backed page-reuse-check index —
 * closes the server-side half of follow-up (a) under the "On Page Card
 * Reuse Search" idea in TODO.md ("an actual browser extension that calls
 * this same check automatically against the current tab's URL"). Hits the
 * app's D1-backed `/api/page-reuse-check` route so a reuse check can run
 * outside the web app's own localStorage-persisted entries (e.g. a future
 * browser extension querying the deployed API directly). Kept separate from
 * any caller so these fetch calls can be unit-tested without mocking a
 * store, mirroring `debate-round`'s `flow/flow-sync-client.ts` split.
 *
 * @module lib/page-reuse-check-client
 */

import type { EvidenceLibraryEntry, PageReuseCheckResult } from "./shared-evidence-library";

const DEFAULT_ENDPOINT = "/api/page-reuse-check";

/** One server-indexed reuse-check match, as returned by `/api/page-reuse-check`. */
export interface RemotePageReuseMatch {
  id: string;
  sourceUrl: string;
  cite: string;
  argBlock: string;
  contributorId: string | null;
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? "";
  } catch {
    return "";
  }
}

/**
 * Checks the server-backed index for `url`, returning every previously
 * pushed entry whose `sourceUrl` normalizes to the same value.
 *
 * Throws a plain `Error` with a useful message on a non-OK response — the
 * caller is expected to treat the server check as best-effort (e.g. falling
 * back to the local-only `checkPageForExistingCards` result) rather than a
 * hard failure.
 */
export async function pullRemotePageReuseMatches(
  url: string,
  endpoint = DEFAULT_ENDPOINT,
): Promise<RemotePageReuseMatch[]> {
  const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail || `Page reuse check failed (${res.status}).`);
  }

  const json = (await res.json()) as { matches?: RemotePageReuseMatch[] };
  return Array.isArray(json.matches) ? json.matches : [];
}

/**
 * Pushes one locally-saved `EvidenceLibraryEntry` that carries a `sourceUrl`
 * to the server-backed index so other clients (or a future browser
 * extension) checking the same URL see it. Upserts by `entry.id`, so
 * pushing the same entry twice (e.g. after an edit, or a retry) updates it
 * in place rather than duplicating it. A no-op (resolves immediately,
 * pushes nothing) when `entry.sourceUrl` is blank.
 *
 * Throws a plain `Error` with a useful message on a non-OK response, same
 * caveat as {@link pullRemotePageReuseMatches}.
 */
export async function pushPageReuseEntry(
  entry: EvidenceLibraryEntry,
  endpoint = DEFAULT_ENDPOINT,
): Promise<void> {
  const sourceUrl = entry.sourceUrl?.trim();
  if (!sourceUrl) return;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: entry.id,
      sourceUrl,
      cite: entry.cite,
      argBlock: entry.argBlock,
    }),
  });

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail || `Page reuse push failed (${res.status}).`);
  }
}

/**
 * Merges a local `PageReuseCheckResult` (from `checkPageForExistingCards`)
 * with remote matches pulled from the server index, deduping by entry id —
 * a local entry (which carries the full `EvidenceLibraryEntry`) always wins
 * over a same-id remote match. `alreadyCut` is true if either side found a
 * match, so a page cut by a teammate on another device still shows as
 * already-cut even before this device's own local store has it.
 */
export function mergeRemotePageReuseMatches(
  local: PageReuseCheckResult,
  remote: RemotePageReuseMatch[],
): PageReuseCheckResult {
  const seenIds = new Set(local.matches.map((entry) => entry.id));
  const remoteOnly = remote.filter((match) => !seenIds.has(match.id));

  const remoteAsEntries: EvidenceLibraryEntry[] = remoteOnly.map((match) => ({
    id: match.id,
    kind: "card",
    text: "",
    cite: match.cite,
    sourceUrl: match.sourceUrl,
    argBlock: match.argBlock,
    topic: "",
    caseArea: "",
    tags: [],
    wordCount: 0,
  }));

  const matches = [...local.matches, ...remoteAsEntries];
  return { url: local.url, alreadyCut: matches.length > 0, matches };
}
