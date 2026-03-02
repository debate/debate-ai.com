/**
 * Configuration for a debate division dataset
 */
interface DatasetConfig {
  division: string;
  url: string;
}

/**
 * Extracted rank and team information from a table cell
 */
interface RankAndTeam {
  rank: number | null;
  rankRaw: string;
  teamSchool: string;
}

/**
 * Leaderboard entry for a debate team
 */
export interface LeaderboardEntry {
  /** The rank of the team in the leaderboard */
  rank: number | string;
  /** The school or name of the team */
  teamSchool: string;
  /** The debate division (e.g., VPF, VLD) */
  division?: string | undefined;
  /** The statistical values associated with the team's performance */
  values: (number | string)[];
}

/**
 * Gets the dataset configurations for debate divisions
 */
function getDatasets(year = "2026"): DatasetConfig[] {
  return [
    {
      division: "VPF",
      url: `https://www.debate.land/datasets/${year}-national-varsity-public-forum/leaderboard?page=1&size=100`,
    },
    {
      division: "VLD",
      url: `https://www.debate.land/datasets/${year}-national-varsity-lincoln-douglas/leaderboard?page=1&size=100`,
    },
    // {
    //   division: "VCX",
    //   url: `https://www.debate.land/datasets/${year}-national-varsity-policy/leaderboard?page=1&size=100`,
    // },
  ];
}

/**
 * Extracts rank and team information from a table cell
 */
function extractRankAndTeam(firstTd: Element | null): RankAndTeam {
  if (!firstTd) return { rank: null, rankRaw: "", teamSchool: "" };

  const raw = firstTd.textContent || "";
  const text = raw.replace(/\s+/g, " ").trim();

  console.log("[v0] Extracting from text:", text);

  let rank: number | null = null;
  let rankRaw = "";
  let teamSchool = "";

  // Match pattern: # followed by number, then optionally whitespace, then capture everything after
  const hashMatch = text.match(/#(\d+)\s*(.+)/);
  if (hashMatch) {
    rankRaw = `#${hashMatch[1]}`;
    rank = Number(hashMatch[1]);
    teamSchool = hashMatch[2].trim();
  } else {
    // fallback: first integer as rank, more flexible pattern
    const numMatch = text.match(/^(\d+)\s*(.+)/);
    if (numMatch) {
      rankRaw = numMatch[1];
      rank = Number(numMatch[1]);
      teamSchool = numMatch[2].trim();
    } else {
      teamSchool = text;
    }
  }

  // Pattern: \s*TOC (with optional space before) OR direct TOC at end (like JKTOC)
  teamSchool = teamSchool
    .replace(/\s*(SUTOC|TOC|NSD|NSDA|TOC Bid).*$/gi, "") // Remove with space
    .replace(/(SUTOC|TOC|NSD|NSDA)$/gi, "") // Remove at end without space
    .replace(/\s+/g, " ")
    .trim();

  console.log("[v0] Extracted - Rank:", rank, "Team:", teamSchool);

  return { rank, rankRaw, teamSchool };
}

/**
 * Scrapes leaderboard data for a specific debate division
 */
async function scrapeDivision({
  division,
  url,
}: DatasetConfig): Promise<LeaderboardEntry[]> {
  try {
    console.log("[v0] Scraping division:", division, "from:", url);

    // Use native fetch instead of grab-url
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log("[v0] Fetched HTML length:", html.length);

    // Dynamic import of linkedom
    const { parseHTML } = await import("linkedom");
    const { document } = parseHTML(html);

    const rows = document.querySelectorAll("tbody tr.group");
    console.log("[v0] Found rows:", rows.length);

    const out = Array.from(rows)
      .map((tr: Element) => {
        const tds = Array.from(tr.querySelectorAll("td"));
        if (tds.length === 0) return null;

        const firstTd = tds[0];
        const { rank, rankRaw, teamSchool } = extractRankAndTeam(firstTd);

        const valueTds = tds.slice(1);
        const values = valueTds
          .map((td) => {
            const txt = td.textContent?.trim() || "";
            if (!txt || txt === "--") return null;

            const numericCandidate = txt.replace(/[^\d.-]/g, "");
            const num = Number(numericCandidate);

            if (txt.includes("%") || txt.includes("-") || Number.isNaN(num)) {
              return txt;
            }
            return num;
          })
          .filter((v): v is number | string => v !== null);

        return {
          rank: rank ?? rankRaw,
          teamSchool: teamSchool || "Unknown Team",
          division,
          values,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null && entry.values.length > 0) as LeaderboardEntry[];

    console.log("[v0] Scraped entries:", out.length);
    return out;
  } catch (error) {
    console.error("[v0] Error scraping division:", division, error);
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
      console.error(`[v0] Error scraping ${cfg.division}:`, error);
      // Continue with other divisions even if one fails
    }
  }

  return all;
}

export { getDatasets, scrapeDivision };
export type { DatasetConfig, RankAndTeam };
