/**
 * @fileoverview The lookups `/tournaments` hands to `<TournamentsApp>` so
 * pairings and results show each entry's current-season ranking and link each
 * judge to their Tabroom paradigm (see `@debate/tournaments`' `ui/enrichment`).
 *
 * Both are cached per page load: every rankings dataset is fetched once and
 * matched locally, and judge names are queued for a tick and sent to
 * `/api/tabroom-paradigms` together, so a pairings page makes one request for
 * its judges rather than one per row.
 */

import {
  debaterLastNames,
  getRankingDatasetInfo,
  loadRankingDataset,
  matchTournamentEntry,
  rankingDatasetsForEvent,
  type RankingDataset,
  type RankingDatasetId,
  type RankingEntry,
} from "@debate/rankings-adapter";
import type { JudgeParadigmLookup, TeamRating, TeamRatingLookup, TeamRatingQuery } from "@debate/tournaments/ui";
import { getSchoolLogo } from "../schoolLogos";

/** The site's paradigm search over Tabroom (`app/api/tabroom-paradigms`). */
export const PARADIGM_SEARCH_API = "/api/tabroom-paradigms";

/** Most names one paradigm search request carries; the route caps it too. */
export const PARADIGM_BATCH_SIZE = 40;

/** A school's logo as an image URL, or `null`. */
function logoSrc(school: string): string | null {
  const logo = getSchoolLogo(school);
  if (!logo || typeof logo === "function") return null;
  return typeof logo === "string" ? logo : logo.src;
}

/** The ranking a matched row gives an entry. */
export function toTeamRating(entry: RankingEntry, datasetId: RankingDatasetId): TeamRating {
  const info = getRankingDatasetInfo(datasetId);
  return {
    names: debaterLastNames(entry.name),
    rating: entry.rating,
    rank: entry.rank,
    school: entry.school,
    rankingLabel: info?.label ?? datasetId,
    logoSrc: logoSrc(entry.school),
  };
}

/**
 * A team lookup over `load`'s datasets. The entry is looked up only in the
 * rankings of its event's format; when an event could be either high school
 * or college policy and both datasets match, it's left unmatched.
 */
export function createTeamRatingLookup(load: (id: RankingDatasetId) => Promise<RankingDataset> = loadRankingDataset): TeamRatingLookup {
  const datasets = new Map<RankingDatasetId, Promise<RankingDataset | null>>();
  const dataset = (id: RankingDatasetId) => {
    let pending = datasets.get(id);
    if (!pending) {
      pending = load(id).catch(() => null);
      datasets.set(id, pending);
    }
    return pending;
  };
  return async (query: TeamRatingQuery) => {
    const ids = rankingDatasetsForEvent(query.event);
    if (ids.length === 0) return null;
    const matches: TeamRating[] = [];
    for (const id of ids) {
      const loaded = await dataset(id);
      const entry = loaded ? matchTournamentEntry(loaded.entries, query) : null;
      if (entry) matches.push(toTeamRating(entry, id));
    }
    return matches.length === 1 ? matches[0] : null;
  };
}

/** `first last` as the paradigm search keys it. */
export const judgeKey = (first: string, last: string) => `${first.trim()} ${last.trim()}`.toLowerCase();

/**
 * A judge lookup that batches: names asked for in the same tick go to
 * `api` in one request (`?name=First|Last&name=…`), and each name is asked
 * at most once per page load. The route answers `{ "<first last>": personId | null }`.
 */
export function createJudgeParadigmLookup(api = PARADIGM_SEARCH_API, fetchImpl: typeof fetch = (...args) => fetch(...args)): JudgeParadigmLookup {
  const cache = new Map<string, Promise<number | null>>();
  let queue: Array<{ first: string; last: string; resolve: (id: number | null) => void }> = [];

  const flush = async () => {
    const batch = queue;
    queue = [];
    for (let i = 0; i < batch.length; i += PARADIGM_BATCH_SIZE) {
      const chunk = batch.slice(i, i + PARADIGM_BATCH_SIZE);
      const params = new URLSearchParams();
      for (const { first, last } of chunk) params.append("name", `${first}|${last}`);
      let found: Record<string, number | null> = {};
      try {
        const res = await fetchImpl(`${api}?${params}`, { headers: { accept: "application/json" } });
        if (res.ok) found = (await res.json()) as Record<string, number | null>;
      } catch {
        // Unreachable: every judge in the chunk stays a plain name.
      }
      for (const { first, last, resolve } of chunk) {
        const id = found[judgeKey(first, last)];
        resolve(typeof id === "number" && id > 0 ? id : null);
      }
    }
  };

  return (first: string, last: string) => {
    const key = judgeKey(first, last);
    let pending = cache.get(key);
    if (!pending) {
      pending = new Promise<number | null>((resolve) => {
        if (queue.length === 0) setTimeout(flush, 0);
        queue.push({ first: first.trim(), last: last.trim(), resolve });
      });
      cache.set(key, pending);
    }
    return pending;
  };
}
