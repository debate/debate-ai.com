/**
 * @fileoverview Network calls for the server-backed reuse index behind the
 * "On Page Card Reuse Search" idea (see `shared-evidence-library.ts` and
 * TODO.md idea #7, follow-up (a): "an actual browser extension that calls
 * this same check automatically against the current tab's URL"). The
 * existing `checkPageForExistingCards`/`checkPersistedPageForExistingCards`
 * only see one browser's own `localStorage` entries, so they can't answer
 * "has anyone on the team cut this" across devices — this client calls the
 * app's `/api/evidence-reuse-check` route instead, mirroring
 * `lib/team-brainstorm-client.ts`'s fetch-based, endpoint-overridable
 * convention (kept separate from pure logic so a caller like the future
 * browser extension can call it without pulling in `localStorage`-backed
 * state modules).
 *
 * @module lib/evidence-reuse-check-client
 */

import type { EvidenceEntryKind } from "./shared-evidence-library";

const DEFAULT_ENDPOINT = "/api/evidence-reuse-check";

/** One shared-index match returned by a reuse check, e.g. for rendering in a panel or extension popup. */
export interface RemoteReuseMatch {
  id: string;
  sourceUrl: string;
  cite: string;
  argBlock: string;
  topic: string;
}

/** The server's answer to "has this page already been cut?" */
export interface RemotePageReuseCheckResult {
  url: string;
  alreadyCut: boolean;
  matches: RemoteReuseMatch[];
}

/** The fields needed to register a newly-cut card's source URL into the shared index. */
export interface RegisterReuseEntryRequest {
  id: string;
  sourceUrl: string;
  cite?: string;
  argBlock?: string;
  topic?: string;
  contributorId?: string;
  /** Accepted for call-site symmetry with `EvidenceLibraryEntry`; not sent (the index only tracks "cut", not kind). */
  kind?: EvidenceEntryKind;
}

async function readErrorDetail(res: Response, fallback: string): Promise<never> {
  let detail = "";
  try {
    const payload = (await res.json()) as { error?: string };
    detail = payload?.error ?? "";
  } catch {
    // Body wasn't JSON.
  }
  throw new Error(detail || fallback);
}

/**
 * Checks the shared server-backed reuse index for `url`, via GET
 * `/api/evidence-reuse-check?url=` (or `endpoint`, if overridden — the
 * browser extension configures this to a full origin since it has no
 * same-origin default).
 */
export async function checkRemotePageForExistingCards(
  url: string,
  endpoint = DEFAULT_ENDPOINT,
): Promise<RemotePageReuseCheckResult> {
  const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`, { method: "GET" });

  if (!res.ok) {
    return readErrorDetail(res, `Reuse check request failed (${res.status}).`);
  }

  return (await res.json()) as RemotePageReuseCheckResult;
}

/** One page's aggregated "flagged as already-cut" reuse pattern, as returned by the dashboard endpoint. */
export interface RemoteFlaggedPageReuseSummary {
  normalizedUrl: string;
  url: string;
  timesFlagged: number;
  lastFlaggedAt: number;
  sources: string[];
}

/**
 * Fetches idea #7's ("On Page Card Reuse Search") team dashboard of pages
 * flagged as already-cut, most frequently flagged first, via GET
 * `/api/evidence-reuse-check/dashboard`.
 */
export async function fetchReuseCheckDashboard(
  endpoint = `${DEFAULT_ENDPOINT}/dashboard`,
): Promise<RemoteFlaggedPageReuseSummary[]> {
  const res = await fetch(endpoint, { method: "GET" });

  if (!res.ok) {
    return readErrorDetail(res, `Reuse dashboard request failed (${res.status}).`);
  }

  const payload = (await res.json()) as { dashboard?: RemoteFlaggedPageReuseSummary[] };
  return payload.dashboard ?? [];
}

/**
 * Registers a cut card's source URL into the shared reuse index, via POST
 * `/api/evidence-reuse-check`. Upserted by `request.id` on the server, so
 * re-registering the same entry (e.g. after an edit) is a no-op rather than
 * a duplicate.
 */
export async function registerRemoteReuseEntry(
  request: RegisterReuseEntryRequest,
  endpoint = DEFAULT_ENDPOINT,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: request.id,
      sourceUrl: request.sourceUrl,
      cite: request.cite ?? "",
      argBlock: request.argBlock ?? "",
      topic: request.topic ?? "",
      contributorId: request.contributorId ?? "",
    }),
  });

  if (!res.ok) {
    return readErrorDetail(res, `Reuse registration request failed (${res.status}).`);
  }
}
