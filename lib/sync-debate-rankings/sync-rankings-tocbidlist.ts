/**
 * TOC Bid List Scraper
 * Fetches JSON directly from tocbidlist.com's internal API for CX, PF, and LD.
 */

import axios from "axios";
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

export async function scrapeToc(event: TocEvent): Promise<LeaderboardEntry[]> {
  const response = await axios.get(`${API_BASE}${event}`, { timeout: 20_000 });

  if (!response.data || !Array.isArray(response.data.rows)) {
    throw new Error(
      `Invalid TOC API response for ${event}: 'rows' array not found`,
    );
  }

  return parseRows(response.data.rows);
}

export const scrapeVCX = () => scrapeToc("CX");
export const scrapeVPF = () => scrapeToc("PF");
export const scrapeVLD = () => scrapeToc("LD");
