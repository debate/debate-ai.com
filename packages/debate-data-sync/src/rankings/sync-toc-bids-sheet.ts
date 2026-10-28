/**
 * TOC Bids Sheet Sync
 *
 * Downloads the community-maintained Google Sheet of high school policy TOC
 * bids (published to the web) as CSV and parses it into one record per team,
 * then matches those records onto `debate-rankings-sync-data` entries so the policy
 * rankings table can show each team's bid count and where it earned them.
 *
 * The sheet's columns are `Bids, Team, Debaters, State, Bid 1 … Bid N`, where
 * Team is `"<School> <code>"` (e.g. `"Baltimore City HW"`) and Debaters is
 * `"Last & Last"`. Rows are hand-edited, so the parser tolerates a cell with
 * embedded newlines that swallows the next column (the sheet's Barack Obama
 * row has Team and Debaters typed into one cell), blank padding columns and a
 * Bids count that disagrees with the listed tournaments.
 *
 * @module rankings/sync-toc-bids-sheet
 */

/** The published sheet the policy rankings read bids from. */
export const TOC_BIDS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSNZ_xEvV0REWyAgYM1X2iuijLVwd-pAUxoYa8GEJB6ROsbJn2fwKEIZNlE8QOd5LHMsNRww3n8YDmm/pubhtml";

/** One team's row of the bids sheet. */
export interface TocBidTeam {
  /** Number of bids: the tournaments listed, or the Bids column when none are. */
  bids: number;
  /** The Team cell as written, e.g. `"Baltimore City HW"`. */
  team: string;
  /** School part of {@link team}, e.g. `"Baltimore City"`. */
  school: string;
  /** Team code part of {@link team}, e.g. `"HW"`; empty when the cell is one word. */
  code: string;
  /** Debaters as written, e.g. `"Hoard & Walter"`. */
  debaters: string;
  /** Two-letter state (or country) code. */
  state: string;
  /** Tournaments where the team earned a bid, in sheet order. */
  tournaments: string[];
}

/**
 * Turn a "Publish to the web" link into its CSV download link.
 *
 * `…/pubhtml`, `…/pubhtml?gid=…` and `…/pub?output=html` all become
 * `…/pub?output=csv` (keeping a `gid` so a specific tab still resolves). A link
 * that is already a CSV export is returned unchanged.
 */
export function toSheetCsvUrl(publishedUrl: string): string {
  const url = new URL(publishedUrl);
  if (url.searchParams.get("output") === "csv") return url.toString();
  const gid = url.searchParams.get("gid");
  url.pathname = url.pathname.replace(/\/pub(html)?\/?$/, "/pub");
  url.search = "";
  url.searchParams.set("output", "csv");
  if (gid) url.searchParams.set("gid", gid);
  return url.toString();
}

/**
 * Split delimited text into rows of cells, honouring double-quoted cells that
 * contain the delimiter, newlines or `""` escapes (RFC 4180).
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Split `"Baltimore City HW"` into school and team code at the last space. */
export function splitTeamName(team: string): { school: string; code: string } {
  const trimmed = team.trim();
  const at = trimmed.lastIndexOf(" ");
  if (at < 0) return { school: trimmed, code: "" };
  return { school: trimmed.slice(0, at).trim(), code: trimmed.slice(at + 1) };
}

/**
 * Replace each multi-line cell with its non-empty lines, in place, so a cell
 * that holds both Team and Debaters is read as those two columns.
 */
function unfoldCells(cells: string[]): string[] {
  return cells.flatMap((cell) =>
    /[\r\n]/.test(cell)
      ? cell
          .split(/\r?\n|\r/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [cell.trim()],
  );
}

/**
 * Parse the bids sheet (CSV as Google exports it, or tab-separated text copied
 * out of the sheet) into one record per team.
 *
 * The header row is found by its `Bids` and `Team` cells, so a title row above
 * it is skipped. Rows without a team are dropped, as are rows with neither a
 * bid count nor a tournament.
 */
export function parseTocBidsSheet(text: string): TocBidTeam[] {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rows = parseDelimited(text.replace(/^﻿/, ""), delimiter);

  const headerIndex = rows.findIndex((cells) => {
    const lower = cells.map((c) => c.trim().toLowerCase());
    return lower.includes("bids") && lower.includes("team");
  });
  if (headerIndex < 0) return [];

  const header = rows[headerIndex].map((c) => c.trim().toLowerCase());
  const col = (name: string, fallback: number) => {
    const i = header.indexOf(name);
    return i >= 0 ? i : fallback;
  };
  const bidsCol = col("bids", 0);
  const teamCol = col("team", 1);
  const debatersCol = col("debaters", 2);
  const stateCol = col("state", 3);
  const firstBidCol = Math.max(bidsCol, teamCol, debatersCol, stateCol) + 1;

  const teams: TocBidTeam[] = [];
  for (const raw of rows.slice(headerIndex + 1)) {
    const cells = unfoldCells(raw);
    const team = cells[teamCol] ?? "";
    if (!team) continue;

    const tournaments = cells
      .slice(firstBidCol)
      .map((c) => c.trim())
      .filter(Boolean);
    const listed = Number.parseInt(cells[bidsCol] ?? "", 10);
    const bids = tournaments.length || (Number.isFinite(listed) ? listed : 0);
    if (bids <= 0) continue;

    teams.push({
      bids,
      team,
      ...splitTeamName(team),
      debaters: cells[debatersCol] ?? "",
      state: (cells[stateCol] ?? "").toUpperCase(),
      tournaments,
    });
  }
  return teams;
}

/**
 * Download and parse the bids sheet.
 *
 * Plain `fetch` rather than grab: the body is CSV text, not JSON, and this runs
 * in the Cloudflare Worker behind `/api/toc-bids`, where fetch is the runtime's
 * own transport.
 *
 * @param publishedUrl - The sheet's "Publish to the web" link (any form).
 * @throws When the download fails or the sheet has no recognisable header.
 */
export async function fetchTocBidsSheet(
  publishedUrl: string = TOC_BIDS_SHEET_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<TocBidTeam[]> {
  const response = await fetchImpl(toSheetCsvUrl(publishedUrl), {
    headers: { Accept: "text/csv" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`TOC bids sheet download failed: HTTP ${response.status}`);
  }
  const text = await response.text();
  if (/^\s*</.test(text)) {
    // Google answers an unpublished or private sheet with an HTML sign-in page.
    throw new Error("TOC bids sheet did not return CSV (is it still published?)");
  }
  const teams = parseTocBidsSheet(text);
  if (teams.length === 0) {
    throw new Error("TOC bids sheet has no Bids/Team header or no rows");
  }
  return teams;
}

// ---------------------------------------------------------------------------
// Matching onto rankings entries
// ---------------------------------------------------------------------------

/** The two fields of a rankings entry the matcher reads. */
export interface RankedTeamRef {
  school: string;
  /** `"Last & Last"`. */
  name: string;
}

/** Words that carry no identity in a school name. */
const SCHOOL_STOPWORDS = new Set([
  "the",
  "of",
  "and",
  "hs",
  "high",
  "school",
  "academy",
  "prep",
  "preparatory",
]);

/** Lowercased, accent-free words of a school name, minus {@link SCHOOL_STOPWORDS}. */
function schoolTokens(school: string): string[] {
  return school
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !SCHOOL_STOPWORDS.has(t));
}

/**
 * How alike two school names are, from 0 (nothing shared) to 1.
 *
 * The rankings and the sheet spell schools differently (`"Barack Obama MLA
 * (HS)"` vs `"Barack Obama Male Leadership Academy"`), so this is the share of
 * the shorter name's words found in the longer, with a match on the first word
 * required. `"Blue Valley North"` scores 2/3 against `"Blue Valley West"`, so
 * callers that have only the school to go on should insist on 1.
 */
export function schoolSimilarity(a: string, b: string): number {
  const ta = schoolTokens(a);
  const tb = schoolTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  if (ta[0] !== tb[0]) return 0;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const longSet = new Set(long);
  return short.filter((t) => longSet.has(t)).length / short.length;
}

/** Order-free key of a `"Last & Last"` pair: `"hoard|walter"`. */
export function debatersKey(names: string): string {
  return names
    .split(/\s*(?:&|\band\b|\/|\+)\s*/i)
    .map((n) =>
      n
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, ""),
    )
    .filter(Boolean)
    .sort()
    .join("|");
}

/** Initials of a `"Last & Last"` pair, for comparing with a team code. */
function initials(names: string): string {
  return names
    .split(/\s*&\s*/)
    .map((n) => n.trim()[0] ?? "")
    .join("")
    .toLowerCase();
}

/** Lookup key for a rankings entry in the map {@link matchTocBids} returns. */
export const rankedTeamKey = (entry: RankedTeamRef): string =>
  `${entry.school}\u0000${entry.name}`;

/**
 * Match bid-sheet teams onto rankings entries.
 *
 * A sheet row matches an entry when the debaters are the same pair (in either
 * order) and the schools look alike — or, when only one ranked entry is that
 * pair, whatever the school: a team that also competes as an independent entry
 * (`"Cuttlefish Independent CG"` and `"Interlake CG"`) is still one team.
 * Failing that, a row whose school matches exactly and whose team code equals
 * the entry's initials matches the one such entry (a partner whose name is
 * spelled differently). When several rows land on one entry their bids are
 * combined, without double-counting a tournament.
 *
 * @returns Bids per entry, keyed by {@link rankedTeamKey}; unmatched entries are absent.
 */
export function matchTocBids(
  entries: readonly RankedTeamRef[],
  teams: readonly TocBidTeam[],
): Map<string, TocBidTeam> {
  const entriesByPair = new Map<string, RankedTeamRef[]>();
  for (const entry of entries) {
    const key = debatersKey(entry.name);
    if (!key) continue;
    const list = entriesByPair.get(key) ?? [];
    list.push(entry);
    entriesByPair.set(key, list);
  }

  const matched = new Map<string, TocBidTeam>();
  const add = (entry: RankedTeamRef, team: TocBidTeam) => {
    const key = rankedTeamKey(entry);
    const prior = matched.get(key);
    if (!prior) {
      matched.set(key, team);
      return;
    }
    const tournaments = [...prior.tournaments];
    for (const t of team.tournaments) if (!tournaments.includes(t)) tournaments.push(t);
    matched.set(key, {
      ...prior,
      tournaments,
      bids: tournaments.length || prior.bids + team.bids,
    });
  };

  for (const team of teams) {
    const pair = debatersKey(team.debaters);
    const candidates = (pair && entriesByPair.get(pair)) || [];

    let best: RankedTeamRef | undefined;
    let bestScore = 0;
    for (const entry of candidates) {
      const score = schoolSimilarity(entry.school, team.school);
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }
    if (!best && candidates.length === 1) {
      best = candidates[0];
    }

    if (!best && team.code) {
      const code = team.code.toLowerCase();
      const byCode = entries.filter(
        (e) => initials(e.name) === code && schoolSimilarity(e.school, team.school) === 1,
      );
      if (byCode.length === 1) best = byCode[0];
    }

    if (best) add(best, team);
  }
  return matched;
}
