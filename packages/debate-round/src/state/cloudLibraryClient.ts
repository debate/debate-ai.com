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
 * `fetchRecentCloudItems` fetches all three sources independently and lets
 * any one of them fail (network error, non-2xx, a signed-out `401`) without
 * taking the other two down with it — mirroring `round/saved-flows-client.ts`/
 * `round/saved-rounds-client.ts`'s existing "401 means no items, not an
 * error" convention, and catching everything else instead of throwing, since
 * this widget's whole job is best-effort discoverability, not surfacing
 * sync errors the way `FlowHistoryDialog` does.
 *
 * @module state/cloudLibraryClient
 */

import { listSavedFlows } from "../round/saved-flows-client";
import { listSavedRounds } from "../round/saved-rounds-client";
import {
  buildRecentCloudItems,
  type BuildRecentCloudItemsOptions,
  type CloudDocumentSummary,
  type CloudLibraryItem,
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
 * Fetches documents/flows/rounds and merges them via `buildRecentCloudItems`.
 * Each source resolves independently and degrades to "no items of that
 * kind" on any failure — a network error, a non-2xx response, or a
 * signed-out `401` — rather than rejecting the whole call, so one flaky
 * endpoint never blanks a widget that had perfectly good data from the
 * other two.
 */
export async function fetchRecentCloudItems(opts?: BuildRecentCloudItemsOptions): Promise<CloudLibraryItem[]> {
  const [documents, flows, rounds] = await Promise.all([
    listCloudDocuments(),
    listSavedFlows().catch(() => null),
    listSavedRounds().catch(() => null),
  ]);
  return buildRecentCloudItems(
    {
      documents: documents ?? undefined,
      flows: flows ?? undefined,
      rounds: rounds ?? undefined,
    },
    opts,
  );
}
