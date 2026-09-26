/**
 * @fileoverview Network orchestration for `MySavedItems`' "recent cloud
 * items" widget (`apps/debate-ai.com/app/tools/MySavedItems.tsx`).
 *
 * The widget used to fetch `/api/doc/documents`, `/api/flows`, and
 * `/api/rounds` itself with a bare `Promise.all(...).then(r => r.json())`
 * and no error handling. `/api/flows` and `/api/rounds` both 401 with an
 * `{ error }` body whenever `getUserId()` can't resolve a session server-side
 * (a stale/expired session the client's own `useSession()` hasn't noticed
 * yet, or a transient auth-backend error) — `buildRecentCloudItems` would
 * then be called with an error object where an array was expected, throwing
 * inside the widget's fire-and-forget async effect and becoming an unhandled
 * promise rejection. The widget's `items` state stayed `null` forever after
 * that, so the section silently rendered nothing (indistinguishable from "no
 * saved items") instead of ever recovering.
 *
 * `fetchRecentCloudItems` fetches every source independently and lets any
 * one of them fail (network error, non-2xx, a signed-out `401`) without
 * taking the others down with it — mirroring `round/saved-flows-client.ts`/
 * `round/saved-rounds-client.ts`'s existing "401 means no items, not an
 * error" convention, and catching everything else instead of throwing, since
 * this widget's whole job is best-effort discoverability, not surfacing
 * sync errors the way `FlowHistoryDialog` does.
 *
 * Word-count rounds (`/api/word-count-rounds`) join documents/flows/rounds
 * the same way `listCloudDocuments` does below — a local raw `fetch` rather
 * than importing `debate-practice-drills`'s own
 * `round/word-count-rounds-client.ts`, since that package depends on
 * `debate-round` (per the monorepo's documented dependency edges), not the
 * other way round; importing it here would invert that edge.
 *
 * Practice vs AI debates (`/api/vsbot/history`) join the same way for the
 * same reason: `debate-practice-vs-ai` doesn't depend on `debate-round`
 * either, so `listCloudDebates` below is a local raw `fetch` against the
 * route's `{ debates: [...] }` body rather than importing that package's
 * own `listDebateHistory` client.
 *
 * Video speech-outcome runs (`/api/tool-records/speechOutcomeRuns`) join the
 * same way, for the same reason again: `debate-videos` doesn't depend on
 * `debate-round`. `listCloudSpeechOutcomes` below is a local raw `fetch`
 * against the generic tool-records route, which — unlike the other four
 * sources — returns every field a synced `CachedSpeechOutcome` record has
 * (including its `simulation` payload), so this trims each row down to the
 * `id`/`speechKey`/`savedAt` triple `buildRecentCloudItems` actually needs
 * rather than shipping the whole simulation through this widget's state.
 *
 * Practice Drills' generated drill sets (`/api/drill-sets`) join the same
 * way, for the same reason as word-count rounds and Practice vs AI debates:
 * `debate-practice-drills` doesn't depend on `debate-round` either, so
 * `listCloudDrillSets` below is a local raw `fetch` against that route's
 * bare `DrillSetRecord[]` body rather than importing that package's own
 * `round/drill-sets-client.ts`.
 *
 * @module state/cloudLibraryClient
 */

import { listSavedFlows } from "../round/saved-flows-client";
import { listSavedRounds } from "../round/saved-rounds-client";
import {
  buildRecentCloudItems,
  type BuildRecentCloudItemsOptions,
  type CloudDebateSummary,
  type CloudDocumentSummary,
  type CloudDrillSetSummary,
  type CloudLibraryItem,
  type CloudSpeechOutcomeSummary,
  type CloudWordCountRoundSummary,
} from "./cloudLibrary";

/**
 * Lists the current user's REASON editor documents. Unlike `/api/flows`/
 * `/api/rounds`, `GET /api/doc/documents` never 401s (it falls back to
 * anonymous rows when signed out), but it can still fail on a network error
 * or a server error — both resolve to `null` here rather than throwing, so a
 * caller merging it with other sources can just treat it as "no documents".
 */
async function listCloudDocuments(endpoint = "/api/doc/documents"): Promise<CloudDocumentSummary[] | null> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as CloudDocumentSummary[];
  } catch {
    return null;
  }
}

/**
 * Lists the current user's account-synced word-count rounds. Degrades to
 * `null` on a signed-out `401`, a non-2xx response, or a network error —
 * same "no items of that kind" convention as `listCloudDocuments` above,
 * rather than `round/word-count-rounds-client.ts`'s own
 * `listSavedWordCountRounds`, which throws on a non-401 failure since its
 * caller (`useWordCountRounds`) needs to distinguish that from "nothing
 * synced yet".
 */
async function listCloudWordCountRounds(
  endpoint = "/api/word-count-rounds",
): Promise<CloudWordCountRoundSummary[] | null> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as CloudWordCountRoundSummary[];
  } catch {
    return null;
  }
}

/**
 * Lists the current user's Practice vs AI debate history. Degrades to `null`
 * on a signed-out `401` (matching `GET /api/vsbot/history`'s own auth
 * behavior), a non-2xx response, or a network error — same "no items of
 * that kind" convention as the other sources above.
 */
async function listCloudDebates(endpoint = "/api/vsbot/history"): Promise<CloudDebateSummary[] | null> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const { debates } = (await res.json()) as { debates: CloudDebateSummary[] };
    return debates;
  } catch {
    return null;
  }
}

/**
 * Lists the current user's synced video speech-outcome simulation runs.
 * Degrades to `null` on a signed-out `401` (matching
 * `GET /api/tool-records/[collection]`'s own auth behavior), a non-2xx
 * response (including the 404 an unrecognized collection key would 404
 * with), or a network error — same "no items of that kind" convention as
 * the other sources above.
 */
async function listCloudSpeechOutcomes(
  endpoint = "/api/tool-records/speechOutcomeRuns",
): Promise<CloudSpeechOutcomeSummary[] | null> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as CloudSpeechOutcomeSummary[];
  } catch {
    return null;
  }
}

/**
 * Lists the current user's synced Practice Drills drill sets. Degrades to
 * `null` on a signed-out `401` (matching `GET /api/drill-sets`'s own auth
 * behavior), a non-2xx response, or a network error — same "no items of
 * that kind" convention as the other sources above.
 */
async function listCloudDrillSets(endpoint = "/api/drill-sets"): Promise<CloudDrillSetSummary[] | null> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as CloudDrillSetSummary[];
  } catch {
    return null;
  }
}

/**
 * Fetches documents/flows/rounds/word-count-rounds/debates/speech-outcome-runs/
 * drill-sets and merges them via `buildRecentCloudItems`. Each source
 * resolves independently and degrades to "no items of that kind" on any
 * failure — a network error, a non-2xx response, or a signed-out `401` —
 * rather than rejecting the whole call, so one flaky endpoint never blanks a
 * widget that had perfectly good data from the others.
 */
export async function fetchRecentCloudItems(opts?: BuildRecentCloudItemsOptions): Promise<CloudLibraryItem[]> {
  const [documents, flows, rounds, wordCountRounds, debates, speechOutcomes, drillSets] = await Promise.all([
    listCloudDocuments(),
    listSavedFlows().catch(() => null),
    listSavedRounds().catch(() => null),
    listCloudWordCountRounds(),
    listCloudDebates(),
    listCloudSpeechOutcomes(),
    listCloudDrillSets(),
  ]);
  return buildRecentCloudItems(
    {
      documents: documents ?? undefined,
      flows: flows ?? undefined,
      rounds: rounds ?? undefined,
      wordCountRounds: wordCountRounds ?? undefined,
      debates: debates ?? undefined,
      speechOutcomes: speechOutcomes ?? undefined,
      drillSets: drillSets ?? undefined,
    },
    opts,
  );
}
