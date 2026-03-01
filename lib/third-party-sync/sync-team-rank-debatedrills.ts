/**
 * Precision to use for debate Elo calculations
 */
const ELO_PRECISION = 0;

/**
 * Configuration for a debate division dataset
 */
export interface DatasetConfig {
  division: string;
  url: string;
  fallbackUrl?: string;
}

/**
 * Leaderboard entry for a debate team
 */
export interface LeaderboardEntry {
  /** The rank of the team in the leaderboard */
  rank: number | string;
  /** The school or name of the team */
  teamName: string;
  /** The statistical values associated with the team's performance */
  debateElo: number | string;
}

const ELO_PERCISION = 0;

/**
 * Gets the dataset configurations for debate divisions from Debate Drills rankings
 * The input year is the ending year of the season (e.g. "2026" for 2025-2026).
 */
export function getDatasets(year = "2026"): DatasetConfig[] {
  const yearNum = parseInt(year, 10);
  const startYear = yearNum - 1;
  const academicYear = `${startYear}-${yearNum}`;

  return [
    {
      division: "VPF",
      url: `https://raw.githubusercontent.com/skumar-ml/debate-rankings/master/${academicYear}/PF/PFRankings_top500.csv`,
      fallbackUrl: `https://raw.githubusercontent.com/skumar-ml/debate-rankings/master/${academicYear}/PF/Rankings_top500.csv`,
    },
    {
      division: "VLD",
      url: `https://raw.githubusercontent.com/skumar-ml/debate-rankings/master/${academicYear}/LD/LDRankings_top500.csv`,
      fallbackUrl: `https://raw.githubusercontent.com/skumar-ml/debate-rankings/master/${academicYear}/LD/Rankings_top500.csv`,
    },
  ];
}

/**
 * Parses a simple CSV string.
 * This is a basic parser that correctly handles quoted strings containing commas.
 */
function parseCSVRow(text: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Scrapes leaderboard data for a specific debate division from Debate Drills CSV
 */
export async function scrapeDivision({
  division,
  url,
  fallbackUrl,
}: DatasetConfig): Promise<LeaderboardEntry[]> {
  try {
    const fetchOptions = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: {
        revalidate: 3600, // Cache for 1 hour
      },
    };

    let response = await fetch(url, fetchOptions);

    if (!response.ok && fallbackUrl && response.status === 404) {
      console.log(
        `[v0] No dataset found at ${url} (404), trying fallback: ${fallbackUrl}`,
      );
      response = await fetch(fallbackUrl, fetchOptions);
    }

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status} for ${url}`);
    }

    const csvText = await response.text();
    const lines = csvText
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    // Check if we have headers + at least one row
    if (lines.length <= 1) return [];

    const entries: LeaderboardEntry[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVRow(lines[i]);
      if (row.length < 4) continue;

      const rankStr = row[0].trim();
      const schoolStr = row[1].trim();
      const nameStr = row[2].trim();
      const eloStr = row[3].trim();

      let rank: number | string = parseInt(rankStr, 10);
      if (isNaN(rank)) {
        rank = rankStr;
      }

      const cleanSchool = schoolStr.replace(/^"|"$/g, "").trim();
      // Option to include Name if preferred, but School contains the main team name (e.g. "Strake Stratton & Murthy")

      const elo = parseFloat(eloStr);
      const debateElo = isNaN(elo)
        ? eloStr
        : Number(elo.toFixed(ELO_PRECISION));
      entries.push({
        rank,
        teamName: cleanSchool,
        debateElo,
      });
    }

    return entries;
  } catch (error) {
    throw error;
  }
}

/**
 * Scrapes leaderboard data for all configured debate divisions
 */
export async function scrapeAll(year = "2026"): Promise<LeaderboardEntry[]> {
  const datasets = getDatasets(year);
  const all: LeaderboardEntry[] = [];

  for (const cfg of datasets) {
    try {
      const entries = await scrapeDivision(cfg);
      all.push(...entries);
    } catch (error) {
      // Continue with other divisions even if one fails
    }
  }

  return all;
}
