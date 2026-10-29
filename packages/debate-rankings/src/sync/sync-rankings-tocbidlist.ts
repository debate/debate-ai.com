/**
 * TOC Bid List Scraper
 * Fetches JSON directly from tocbidlist.com's internal API for CX, PF, and LD.
 */

import grab from "grab-url";
import { LeaderboardEntry } from "./sync-rankings-debatedrills";

const API_BASE = "https://tocbidlist.com/api/enriched-leaderboard?event=";

type TocEvent = "CX" | "PF" | "LD";

function parseRows(rows: any[]): LeaderboardEntry[] {
  return rows
    .map((row: any) => ({
      rank: row.rank,
      teamName: row.schoolOrTeam,
      tocScore: row.totalScore,
      bids: row.bids,
      students: row.students,
      state: row.state,
      details:
        row.hasDetails && Array.isArray(row.details)
          ? row.details.map((d: any) => ({
              tournament: d.tournament,
              placement: d.placement,
              placementNormalized: d.placementNormalized,
              bidTier: d.bidTier,
              score: d.score,
            }))
          : undefined,
    }))
    .sort(
      (a: any, b: any) => (Number(a.rank) || 999) - (Number(b.rank) || 999),
    );
}

/**
 * Pull the `rows` array out of a grab response.
 *
 * grab lifts a JSON body onto the root of its result object, so the array
 * normally arrives as `result.rows`. It also mirrors the body under `.data`,
 * which is where a non-JSON content type (or a `data`-wrapped envelope) ends
 * up, so check both before giving up.
 */
function extractRows(result: any): any[] | null {
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.data?.rows)) return result.data.rows;
  return null;
}

export async function scrapeToc(event: TocEvent): Promise<LeaderboardEntry[]> {
  // `grab` rather than axios: this runs inside the Cloudflare Worker that
  // serves /api/leaderboard, where axios is a liability — it picks its
  // transport at import time and reaches for XMLHttpRequest or node:http,
  // neither of which is the runtime's real fetch. Every other scraper in this
  // folder already goes through grab; this was the last axios holdout.
  //
  // `cancelOngoingIfNew` is off because grab defaults it on and keys it by
  // path: on the server two visitors asking for the same division at the same
  // moment would otherwise cancel each other, turning a fine request into a
  // failed one. Cancellation only makes sense for the browser's one-user-at-a
  // -time assumption.
  const result = await grab(`${API_BASE}${event}`, {
    headers: { Accept: "application/json" },
    timeout: 20,
    cancelOngoingIfNew: false,
  });

  if (result?.error) {
    throw new Error(`TOC API request failed for ${event}: ${result.error}`);
  }

  const rows = extractRows(result);
  if (!rows) {
    throw new Error(
      `Invalid TOC API response for ${event}: 'rows' array not found`,
    );
  }

  return parseRows(rows);
}

export const scrapeVCX = () => scrapeToc("CX");
export const scrapeVPF = () => scrapeToc("PF");
export const scrapeVLD = () => scrapeToc("LD");
