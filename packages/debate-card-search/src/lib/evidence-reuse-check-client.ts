/**
 * @fileoverview Network calls for the server-backed reuse index behind the
 * "On Page Card Reuse Search" idea (see `shared-evidence-library.ts` and
 * TODO.md idea #7, follow-up (a): "an actual browser extension that calls
 * this same check automatically against the current tab's URL"). The
 * existing `checkPageForExistingCards`/`checkPersistedPageForExistingCards`
 * only see one browser's own `localStorage` entries, so they can't answer
 * "has anyone on the team cut this" across devices — this client calls the
 * app's `/api/evidence-reuse-check` route (via `debate-api-client`) instead,
 * mirroring `lib/team-brainstorm-client.ts`'s client-overridable convention
 * (kept separate from pure logic so a caller like the future browser
 * extension can call it without pulling in `localStorage`-backed state
 * modules).
 *
 * @module lib/evidence-reuse-check-client
 */

import { checkEvidenceReuse, registerEvidenceReuse, type Client } from "debate-api-client";
import { apiClient } from "./api-client";
import type { EvidenceEntryKind } from "./shared-evidence-library";

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

/**
 * Checks the shared server-backed reuse index for `url`, via GET
 * `/api/evidence-reuse-check?url=` (or `client`, if overridden — the
 * browser extension configures this to a full origin since it has no
 * same-origin default).
 */
export async function checkRemotePageForExistingCards(
  url: string,
  client: Client = apiClient,
): Promise<RemotePageReuseCheckResult> {
  const { data, error } = await checkEvidenceReuse({ query: { url } }, { client });

  if (error) {
    throw new Error("Reuse check request failed.");
  }

  return data as RemotePageReuseCheckResult;
}

/**
 * Registers a cut card's source URL into the shared reuse index, via POST
 * `/api/evidence-reuse-check`. Upserted by `request.id` on the server, so
 * re-registering the same entry (e.g. after an edit) is a no-op rather than
 * a duplicate.
 */
export async function registerRemoteReuseEntry(
  request: RegisterReuseEntryRequest,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await registerEvidenceReuse(
    {
      body: {
        id: request.id,
        sourceUrl: request.sourceUrl,
        cite: request.cite ?? "",
        argBlock: request.argBlock ?? "",
        topic: request.topic ?? "",
        contributorId: request.contributorId ?? "",
      },
    },
    { client },
  );

  if (error) {
    throw new Error("Reuse registration request failed.");
  }
}
