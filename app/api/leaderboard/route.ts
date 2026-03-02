import { NextResponse } from "next/server";
import {
  scrapeDivision,
  getDatasets,
  LeaderboardEntry,
} from "@/lib/third-party-sync/sync-rankings-debatedrills";
import {
  scrapeVCX,
  scrapeVPF,
  scrapeVLD,
} from "@/lib/third-party-sync/sync-rankings-tocbidlist";

const tocScrapers: Record<string, () => Promise<LeaderboardEntry[]>> = {
  VCX: scrapeVCX,
  VPF: scrapeVPF,
  VLD: scrapeVLD,
};

/**
 * Normalize a team name for fuzzy matching:
 * lowercase, strip punctuation/extra spaces, collapse whitespace.
 */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract initials from a student name, e.g. "Alex Gul" -> "AG"
 */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/**
 * For PF team names like "Strake Jesuit MS", swap the trailing initials
 * to also try "Strake Jesuit SM". Returns null if no trailing initials found.
 */
function swapTrailingInitials(normalized: string): string | null {
  const match = normalized.match(/^(.+\s)([a-z])([a-z])$/);
  if (!match) return null;
  return `${match[1]}${match[3]}${match[2]}`;
}

/**
 * Merge DebateDrills Elo ratings into TOC bid list entries by team name.
 * 1. Direct normalized match
 * 2. For LD: append student initials, then direct match
 * 3. For PF: try swapped trailing initials
 * 4. Fallback: Fuse.js fuzzy match (threshold 0.3)
 */
function mergeElo(
  tocEntries: LeaderboardEntry[],
  drillsEntries: LeaderboardEntry[],
  division: string,
): LeaderboardEntry[] {
  // Build exact-match map
  const eloMap = new Map<string, number | string>();
  for (const entry of drillsEntries) {
    if (entry.debateElo !== undefined) {
      eloMap.set(normalizeTeamName(entry.teamName), entry.debateElo);
    }
  }

  return tocEntries.map((entry) => {
    let key = normalizeTeamName(entry.teamName);

    // For LD, append student initials to match DebateDrills naming convention
    if (division === "VLD" && entry.students) {
      const initials = getInitials(entry.students);
      if (initials) {
        key = normalizeTeamName(`${entry.teamName} ${initials}`);
      }
    }

    // 1. Try direct match
    let elo = eloMap.get(key);

    // 2. For PF, try swapped trailing initials (e.g. "school ms" -> "school sm")
    if (elo === undefined && division === "VPF") {
      const swapped = swapTrailingInitials(key);
      if (swapped) {
        elo = eloMap.get(swapped);
      }
    }

    return elo !== undefined ? { ...entry, debateElo: elo } : entry;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || "2026";
  const division = (searchParams.get("division") || "VPF").toUpperCase();
  const isCurrentYear = year === "2026";

  console.log(
    "[v0] Leaderboard API called with year:",
    year,
    "division:",
    division,
  );

  try {
    // Prior years (2021-2025): DebateDrills Elo only for VPF/VLD
    if (!isCurrentYear) {
      if (division !== "VPF" && division !== "VLD") {
        return NextResponse.json([]);
      }

      const datasets = getDatasets(year);
      const config = datasets.find(
        (d) => d.division.toUpperCase() === division,
      );

      if (!config) {
        return NextResponse.json([]);
      }

      const drillsData = await scrapeDivision(config);
      console.log("[v0] DebateDrills historical data count:", drillsData.length);
      return NextResponse.json(drillsData);
    }

    // Current year (2025-2026): TOC bid list + DebateDrills Elo merge
    const tocScraper = tocScrapers[division];
    if (!tocScraper) {
      return NextResponse.json({ error: "Invalid division" }, { status: 400 });
    }

    const tocData = await tocScraper();
    console.log("[v0] Scraped TOC data count:", tocData.length);

    // For VPF/VLD, also fetch DebateDrills Elo and merge
    if (division === "VPF" || division === "VLD") {
      const datasets = getDatasets(year);
      const config = datasets.find(
        (d) => d.division.toUpperCase() === division,
      );

      if (config) {
        try {
          const drillsData = await scrapeDivision(config);
          console.log(
            "[v0] DebateDrills Elo entries for merge:",
            drillsData.length,
          );
          const merged = mergeElo(tocData, drillsData, division);
          const matchCount = merged.filter((e) => e.debateElo !== undefined).length;
          console.log("[v0] Merged Elo matches:", matchCount);
          return NextResponse.json(merged);
        } catch (err) {
          console.warn("[v0] DebateDrills fetch failed, returning TOC-only:", err);
        }
      }
    }

    return NextResponse.json(tocData);
  } catch (error) {
    console.error("[v0] Error in leaderboard API:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch leaderboard data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
