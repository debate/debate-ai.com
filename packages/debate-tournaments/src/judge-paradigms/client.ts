/**
 * @fileoverview The browser half of `/api/judge-paradigms`: the judge
 * lookup `/tournaments` hands to `<TournamentsApp lookupJudgeProfile>`, and
 * the paradigm editor's reads and writes.
 *
 * Same contract as `../judge-pool/client.ts`: a typed result, or an `Error`
 * whose message is fit to show; a signed-out read resolves to `null`.
 *
 * @module debate-tournaments/judge-paradigms/client
 */

import type { JudgeProfile, JudgeProfileLookup, JudgeProfileQuery } from "../ui/index";
import type { OwnParadigm, OwnParadigmInput } from "./types";

export const JUDGE_PARADIGMS_API = "/api/judge-paradigms";
/** Where a judge edits their own paradigm. */
export const PARADIGM_EDITOR_PATH = "/practice/paradigm";

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload?.error === "string" && payload.error.length > 0) return new Error(payload.error);
  } catch {
    // A non-JSON error body: the fallback says enough.
  }
  return new Error(fallback);
}

/** `?personId=N`, or `?first=&last=` for a judge with no id yet. */
export function judgeProfileUrl(query: JudgeProfileQuery, api = JUDGE_PARADIGMS_API): string | null {
  const params = new URLSearchParams();
  if (query.personId) params.set("personId", String(query.personId));
  else if (query.first.trim() && query.last.trim()) {
    params.set("first", query.first.trim());
    params.set("last", query.last.trim());
  } else return null;
  return `${api}?${params}`;
}

/**
 * A judge lookup for `<TournamentsApp lookupJudgeProfile>`: each judge is
 * asked for once per page load, and a failure resolves to `null` (the dialog
 * then says nothing was found) rather than throwing.
 */
export function createJudgeProfileLookup(api = JUDGE_PARADIGMS_API, fetchImpl: typeof fetch = (...args) => fetch(...args)): JudgeProfileLookup {
  const cache = new Map<string, Promise<JudgeProfile | null>>();
  return (query) => {
    const url = judgeProfileUrl(query, api);
    if (!url) return Promise.resolve(null);
    let pending = cache.get(url);
    if (!pending) {
      pending = fetchImpl(url, { headers: { accept: "application/json" } })
        .then(async (res) => (res.ok ? (((await res.json()) as { profile?: JudgeProfile | null }).profile ?? null) : null))
        .catch(() => null);
      // A failure is not remembered, so reopening the dialog tries again.
      pending.then((profile) => profile === null && cache.delete(url));
      cache.set(url, pending);
    }
    return pending;
  };
}

/** The viewer's own paradigm, or `null` when signed out. */
export async function fetchOwnParadigm(fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<OwnParadigm | null> {
  const res = await fetchImpl(`${JUDGE_PARADIGMS_API}/me`, { headers: { accept: "application/json" } });
  if (res.status === 401) return null;
  if (!res.ok) throw await errorFrom(res, "Could not load your paradigm.");
  return (await res.json()) as OwnParadigm;
}

/** Saves the viewer's paradigm and returns it as stored. */
export async function saveOwnParadigm(input: OwnParadigmInput, fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<OwnParadigm> {
  const res = await fetchImpl(`${JUDGE_PARADIGMS_API}/me`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFrom(res, "Could not save your paradigm.");
  return (await res.json()) as OwnParadigm;
}

/** Asks the server to check the viewer's Tabroom paradigm for their code. */
export async function verifyOwnParadigm(fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<OwnParadigm> {
  const res = await fetchImpl(`${JUDGE_PARADIGMS_API}/me/verify`, { method: "POST" });
  if (!res.ok) throw await errorFrom(res, "Could not verify your Tabroom account.");
  return (await res.json()) as OwnParadigm;
}
