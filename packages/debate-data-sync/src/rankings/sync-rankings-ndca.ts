/**
 * NDCA Standings Scraper
 * Fetches the NDCA Baker Standings from Tabroom.com for CX (policy).
 * Requires a TABROOM_API_KEY cookie for authentication.
 */

import grab from "grab-url";
import { parseHTML } from "linkedom";
import type { LeaderboardEntry } from "./sync-rankings-debatedrills";

const NDCA_URL = "https://www.tabroom.com/index/results/ndca_standings.mhtml";

/**
 * Extracts the Tabroom authentication token from TABROOM_API_KEY env var.
 * Returns the URL-encoded cookie value suitable for a Cookie header.
 */
function getTabroomCookie(): string {
  const apiKey = process.env.TABROOM_API_KEY;
  if (!apiKey) return "";
  return `TabroomToken=${encodeURIComponent(apiKey)}`;
}

/**
 * Parses a single table row into a LeaderboardEntry.
 *
 * The NDCA table structure:
 * - td[0]: Rank number
 * - td[1]: Entry div containing school name (first .full div) and team names (second .full div)
 * - td[2]: Points
 * - td[3]: Tournaments div with tournament names and team points
 */
function parseRow(tr: Element): LeaderboardEntry | null {
  const tds = Array.from(tr.querySelectorAll("td"));
  if (tds.length < 4) return null;

  // Rank
  const rankText = tds[0].textContent?.trim() ?? "";
  const rank = parseInt(rankText, 10);
  const rankStr = isNaN(rank) ? rankText : rank;

  // Entry: school name and team names from nested divs
  const entryDiv = tds[1];
  const fullDivs = entryDiv.querySelectorAll(".full.marno");
  const school = fullDivs[0]?.textContent?.trim() ?? "Unknown School";
  const teamNames = fullDivs[1]?.textContent?.trim() ?? "";
  const teamName = teamNames
    ? `${school} (${teamNames})`
    : school;

  // Points
  const pointsText = tds[2].textContent?.trim() ?? "0";
  const points = parseInt(pointsText, 10);

  // Tournaments: extract tournament names from span.fivesixth.nowrap elements
  const tournamentsDiv = tds[3];
  const tournamentSpans = tournamentsDiv.querySelectorAll("span.fivesixth.nowrap");
  const tournaments: string[] = [];
  tournamentSpans.forEach((span) => {
    const name = span.textContent?.trim();
    if (name) tournaments.push(name);
  });

  return {
    rank: rankStr,
    teamName,
    tocScore: points,
    students: school,
    bids: tournaments.length,
    state: undefined,
    debateElo: undefined,
    eloRank: undefined,
    details: tournaments.length > 0
      ? tournaments.map((tournament, index) => ({
          tournament,
          placement: `Tournament ${index + 1}`,
          placementNormalized: `t${index + 1}`,
          bidTier: "Regular",
          score: points,
        }))
      : undefined,
  };
}

/**
 * Scrapes NDCA standings for CX (policy) from Tabroom.com.
 */
export async function scrapeNdca(): Promise<LeaderboardEntry[]> {
  const cookie = getTabroomCookie();
  const headers: Record<string, string> = {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
  };
  if (cookie) {
    headers["Cookie"] = cookie;
    headers["Referer"] =
      "https://www.tabroom.com/index/results/debate_stats_ada.mhtml?circuit_id=103&level=Open";
  }

  const result = await grab(NDCA_URL, {
    headers,
    timeout: 30,
  });

  if (result.error) {
    throw new Error(`NDCA scrape failed: ${result.error}`);
  }

  const html = typeof result.data === "string" ? result.data : "";
  if (!html) return [];

  const { document } = parseHTML(html);

  const table = document.querySelector("table#ndca");
  if (!table) return [];

  const rows = table.querySelectorAll("tbody tr");
  const entries: LeaderboardEntry[] = [];

  rows.forEach((tr) => {
    const entry = parseRow(tr as Element);
    if (entry) entries.push(entry);
  });

  return entries;
}

export { NDCA_URL };
