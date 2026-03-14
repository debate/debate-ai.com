import grab from "grab-url";

/**
 * Precision to use for debate Elo calculations
 */
const ELO_PRECISION = 0;

/**
 * Manual mappings for school name normalization
 * Maps non-standard names to their canonical form
 */
const SCHOOL_NAME_MAPPINGS: Record<string, string> = {
  "Strake Stratton & Murthy": "Strake Jesuit MS",
  "Campbell Hall Jared Bart & Alexandra Kosloff": "Campbell Hall BK",
  "National Debate Club": "National Debate Club (NDC)",
};

/**
 * Normalizes school names that contain full debater names to use last name initials
 * Example: "Campbell Hall Jared Bart & Alexandra Kosloff" -> "Campbell Hall BK"
 */
function normalizeSchoolName(schoolName: string): string {
  // First check manual mappings
  if (SCHOOL_NAME_MAPPINGS[schoolName]) {
    return SCHOOL_NAME_MAPPINGS[schoolName];
  }

  // Pattern: "School Name FirstName LastName & FirstName LastName"
  // Match: school name + full names with & separator
  const fullNamePattern =
    /^(.+?)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+&\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)$/;
  const match = schoolName.match(fullNamePattern);

  if (match) {
    const schoolBase = match[1].trim();
    const lastName1 = match[3]; // Last name of first debater
    const lastName2 = match[5]; // Last name of second debater
    const initials = lastName1.charAt(0) + lastName2.charAt(0);
    return `${schoolBase} ${initials}`;
  }

  // If doesn't match pattern, return as-is
  return schoolName;
}

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
  /** DebateDrills Elo rating */
  debateElo?: number | string;
  /** DebateDrills Elo rank */
  eloRank?: number | string;
  /** TOC bid list placement score (totalScore from tocbidlist) */
  tocScore?: number;
  /** The number of TOC bids the team received */
  bids?: number;
  /** Student names (e.g. "Jack Liu & Shangyu Wu") */
  students?: string;
  /** US state abbreviation */
  state?: string;
  /** Tournament detail breakdown */
  details?: {
    tournament: string;
    placement: string;
    placementNormalized: string;
    bidTier: string;
    score: number;
  }[];
}

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
      url: `https://raw.githubusercontent.com/skumar-ml/debate-rankings/master/${academicYear}/PF/PFRankings.csv`,
      fallbackUrl: `https://raw.githubusercontent.com/skumar-ml/debate-rankings/master/${academicYear}/PF/Rankings.csv`,
    },
    {
      division: "VLD",
      url: `https://raw.githubusercontent.com/skumar-ml/debate-rankings/master/${academicYear}/LD/LDRankings.csv`,
      fallbackUrl: `https://raw.githubusercontent.com/skumar-ml/debate-rankings/master/${academicYear}/LD/Rankings.csv`,
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
    const result = await grab(url, { headers: { Accept: "text/plain" } });
    let csvText = result.error ? null : result.data;

    if (!csvText && fallbackUrl) {
      const fallbackResult = await grab(fallbackUrl, {
        headers: { Accept: "text/plain" },
      });
      csvText = fallbackResult.data;
    }

    // grab returns a Blob for octet-stream responses (GitHub raw content);
    // also handle Buffer for safety
    if (typeof Blob !== "undefined" && csvText instanceof Blob) {
      csvText = await csvText.text();
    } else if (Buffer.isBuffer(csvText)) {
      csvText = csvText.toString("utf-8");
    }

    if (!csvText || typeof csvText !== "string") {
      return [];
    }

    const lines = csvText
      .split(/\r?\n/)
      .filter((line: string) => line.trim().length > 0);

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
      // Normalize school names with full debater names to use last name initials
      const normalizedSchool = normalizeSchoolName(cleanSchool);

      const elo = parseFloat(eloStr);
      const debateElo = isNaN(elo)
        ? eloStr
        : Number(elo.toFixed(ELO_PRECISION));
      entries.push({
        rank,
        teamName: normalizedSchool,
        debateElo,
        eloRank: rank,
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
