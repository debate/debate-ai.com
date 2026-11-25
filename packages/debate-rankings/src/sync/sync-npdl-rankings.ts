/**
 * NPDL Parliamentary Rankings Sync
 *
 * Scrapes the National Parliamentary Debate League's national rankings
 * (parliamentarydebate.org). The season pages hold no data themselves: each
 * embeds a published Google Sheet in an iframe under an `id="team-rankings"`
 * or `id="school-rankings"` heading. This module finds those iframes, downloads
 * each sheet as CSV (falling back to the sheet's `pubhtml` table when the CSV
 * export is blocked) and normalizes the rows.
 *
 * Ranks are kept **exactly as published**: the sheets have ties (`9, 9, 11`)
 * and the rank column is never renumbered from row order.
 *
 * Runtime-agnostic (global `fetch` only), so the same code runs in the
 * Cloudflare Worker behind `/api/npdl-rankings` and in the
 * `bun run sync-npdl` CLI that refreshes the bundled
 * `data/npdl-rankings.json` snapshot.
 *
 * @module sync/sync-npdl-rankings
 */

import { parseDelimited } from "./sync-toc-bids-sheet";

/** The league's site. */
export const NPDL_BASE_URL = "https://www.parliamentarydebate.org";

/**
 * Generic client name: the site asks nothing of scrapers, and a personal
 * contact must not be sent to an outside service.
 */
export const NPDL_USER_AGENT = "Mozilla/5.0 (compatible; rankings-sync/1.0)";

/**
 * Season page paths, newest first. The site's slugs are inconsistent
 * (`/202324`, `/rankings-202526`), so they are listed rather than built.
 */
export const NPDL_SEASON_SLUGS = [
  "/rankings-2026-27",
  "/rankings-202526",
  "/rankings-2024-25",
  "/202324",
  "/rankings-2022-23",
  "/rankings-2021-22",
  "/rankings-2020-21",
  "/rankings-2019-20",
  "/rankings-2018-19",
  "/rankings-2017-18",
] as const;

/** Which of a season page's two sheets a row came from. */
export type NpdlTab = "team" | "school";

/** One ranked row, as published. */
export interface NpdlRankingRow {
  /** Published rank; ties repeat (`9, 9, 11`). */
  rank: number;
  /** School (school sheet) or school/team name (team sheet). */
  school: string;
  region: string | null;
  /** Team sheet only. */
  debater1: string | null;
  /** Team sheet only. */
  debater2: string | null;
  points: number;
}

/** A season's two tables. */
export interface NpdlSeasonRankings {
  /** `"2024-25"`. */
  season: string;
  /** The season page the sheets were found on. */
  pageUrl: string;
  /** ISO time of the scrape. */
  fetchedAt: string;
  teams: NpdlRankingRow[];
  schools: NpdlRankingRow[];
}

/** One embedded sheet found on a season page. */
export interface NpdlSheetTarget {
  tab: NpdlTab;
  /** CSV export of the sheet's tab. */
  csvUrl: string;
  /** The sheet's HTML view, read when the CSV export fails. */
  fallbackUrl: string;
}

/** `"/rankings-202526"` → `"2025-26"`, `"/rankings-2024-25"` → `"2024-25"`. */
export function npdlSeasonFromSlug(slug: string): string {
  const d = slug.replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(6, 8)}`;
  if (d.length === 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d || "unknown";
}

/** The page path for a season (`"2024-25"`), or `undefined` when unknown. */
export function npdlSlugForSeason(season: string): string | undefined {
  return NPDL_SEASON_SLUGS.find((slug) => npdlSeasonFromSlug(slug) === season);
}

/** Every season the scraper knows, newest first. */
export const NPDL_SEASONS: string[] = NPDL_SEASON_SLUGS.map(npdlSeasonFromSlug);

/**
 * The year a season ends in, as the rankings page's season select names it:
 * `"2026-27"` → `"2027"`.
 */
export function npdlSeasonEndYear(season: string): string {
  return String(Number(season.slice(0, 4)) + 1);
}

/** The season ending in `year` (`"2027"` → `"2026-27"`), or `undefined` when the league has none. */
export function npdlSeasonForYear(year: string): string | undefined {
  return NPDL_SEASONS.find((s) => npdlSeasonEndYear(s) === year);
}

/** {@link NPDL_SEASONS} as end years (`"2027"`, `"2026"`, …), newest first. */
export const NPDL_SEASON_YEARS: string[] = NPDL_SEASONS.map(npdlSeasonEndYear);

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const EMBED_RE =
  /<iframe[^>]+src="(https:\/\/docs\.google\.com\/spreadsheets\/d\/(?:e\/)?([\w-]+)\/(?:pubhtml|pub|gviz\/tq)[^"]*)"/gi;
const GID_RE = /[?&](?:amp;)?gid=(\d+)/;
const HEADING_RE = /id="(team|school)-rankings"/gi;

/** CSV and HTML links for one tab (`gid`) of a sheet. */
export function npdlSheetUrls(sheetUrl: string): { csvUrl: string; fallbackUrl: string } | null {
  const sid = /\/spreadsheets\/d\/(?:e\/)?([\w-]+)/.exec(sheetUrl)?.[1];
  const gid = GID_RE.exec(sheetUrl)?.[1];
  if (!sid || !gid) return null;
  const published = sheetUrl.includes("/d/e/");
  const stem = published
    ? `https://docs.google.com/spreadsheets/d/e/${sid}`
    : `https://docs.google.com/spreadsheets/d/${sid}`;
  return {
    csvUrl: published
      ? `${stem}/pub?gid=${gid}&single=true&output=csv`
      : `${stem}/gviz/tq?tqx=out:csv&gid=${gid}`,
    fallbackUrl: `${stem}/pubhtml?gid=${gid}&single=true&widget=true&headers=false`,
  };
}

/**
 * Find the embedded sheets on a season page. Each iframe takes the tab of the
 * last `team-rankings` / `school-rankings` heading above it (team when none),
 * and a sheet tab embedded twice is listed once.
 */
export function discoverNpdlSheets(html: string): NpdlSheetTarget[] {
  const headings = [...html.matchAll(HEADING_RE)].map((m) => ({
    pos: m.index ?? 0,
    tab: m[1].toLowerCase() as NpdlTab,
  }));

  const out: NpdlSheetTarget[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(EMBED_RE)) {
    const src = m[1];
    const urls = npdlSheetUrls(src);
    if (!urls || seen.has(urls.csvUrl)) continue;
    seen.add(urls.csvUrl);

    let tab: NpdlTab = "team";
    for (const h of headings) if (h.pos < (m.index ?? 0)) tab = h.tab;
    out.push({ tab, ...urls });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** First number in a cell (`"T-9"` → 9, `"1,204.5"` → 1204.5), or null. */
function toNum(raw: string, allowNegative: boolean): number | null {
  const m = (allowNegative ? /-?\d+(?:\.\d+)?/ : /\d+(?:\.\d+)?/).exec(raw.replace(/,/g, ""));
  return m ? Number(m[0]) : null;
}

type Field = "rank" | "school" | "region" | "points" | "d1" | "d2";

const ALIASES: Record<Field, Set<string>> = {
  rank: new Set(["rank"]),
  school: new Set(["school", "team"]),
  region: new Set(["region"]),
  points: new Set(["points", "score"]),
  d1: new Set(["debater1", "debaterone", "speaker1"]),
  d2: new Set(["debater2", "debatertwo", "speaker2"]),
};

function mapColumns(header: string[]): Partial<Record<Field, number>> {
  const idx: Partial<Record<Field, number>> = {};
  header.forEach((cell, i) => {
    const n = norm(cell);
    for (const field of Object.keys(ALIASES) as Field[]) {
      if (idx[field] === undefined && ALIASES[field].has(n)) idx[field] = i;
    }
  });
  return idx;
}

/** Rows parsed from one sheet, plus counts for the sync log. */
export interface NpdlParsedTable {
  rows: NpdlRankingRow[];
  /** Rows with a school or rank but no points: footnotes, headings. */
  notes: string[];
  /** Blank rows. */
  skipped: number;
}

/**
 * Read a sheet's cells into ranked rows. The header row (the first of the top
 * ten with both a Rank and a School/Team column) is found by name, so title
 * rows above it are skipped. A row needs a school, a rank and points.
 *
 * @throws When no header row is found.
 */
export function parseNpdlTable(cells: string[][]): NpdlParsedTable {
  const headerRow = cells.slice(0, 10).findIndex((r) => {
    const c = mapColumns(r);
    return c.rank !== undefined && c.school !== undefined;
  });
  if (headerRow === -1) throw new Error("no header row with Rank + School found");

  const cols = mapColumns(cells[headerRow]);
  const rows: NpdlRankingRow[] = [];
  const notes: string[] = [];
  let skipped = 0;

  for (const r of cells.slice(headerRow + 1)) {
    const get = (f: Field) => {
      const i = cols[f];
      return i !== undefined ? (r[i] ?? "").trim() : "";
    };
    const rank = toNum(get("rank"), false);
    const points = toNum(get("points"), true);
    const school = get("school");

    if (school && rank !== null && points !== null) {
      rows.push({
        rank: Math.trunc(rank),
        school,
        region: get("region") || null,
        debater1: get("d1") || null,
        debater2: get("d2") || null,
        points,
      });
    } else if (school || rank !== null) {
      notes.push(r.filter((c) => c.trim()).join(" "));
    } else {
      skipped++;
    }
  }
  return { rows, notes, skipped };
}

/** Parse a sheet's CSV export. */
export function parseNpdlCsv(text: string): NpdlParsedTable {
  return parseNpdlTable(parseDelimited(text.replace(/^﻿/, ""), ","));
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};
const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m]);

/**
 * Parse a sheet's `pubhtml` view (used when the CSV export is blocked). The
 * viewer's own leading row-number cell is dropped.
 *
 * @throws When the page has no table or the table no header row.
 */
export function parseNpdlHtmlTable(html: string): NpdlParsedTable {
  const table = /<table[\s\S]*?<\/table>/i.exec(html)?.[0];
  if (!table) throw new Error("no <table> in fallback page");

  const cells = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((tr) => {
    const row = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      decode(c[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(),
    );
    return row[0] && /^\d+$/.test(row[0]) ? row.slice(1) : row;
  });
  return parseNpdlTable(cells);
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/** Options for {@link fetchNpdlSeason}. */
export interface NpdlFetchOptions {
  fetchImpl?: typeof fetch;
  /** Per-request timeout in ms (default 45 s). */
  timeoutMs?: number;
  /** Tries per request on network errors, 429 and 5xx (default 3). */
  retries?: number;
  /** Called with progress lines (the CLI prints them). */
  log?: (line: string) => void;
}

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

async function fetchText(url: string, opts: NpdlFetchOptions): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const retries = Math.max(1, opts.retries ?? 3);
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: { "User-Agent": NPDL_USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
        redirect: "follow",
      });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`);
        if (!RETRY_STATUSES.has(res.status)) throw Object.assign(err, { final: true });
        throw err;
      }
      return await res.text();
    } catch (err) {
      lastError = err;
      if ((err as { final?: boolean }).final || attempt === retries - 1) break;
      await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * 1000, 8000)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Download one sheet: CSV first, then the HTML view. */
async function fetchSheet(target: NpdlSheetTarget, opts: NpdlFetchOptions): Promise<NpdlParsedTable> {
  try {
    const text = await fetchText(target.csvUrl, opts);
    // A private or unpublished sheet answers with an HTML sign-in page.
    if (/^\s*</.test(text)) throw new Error("CSV export returned HTML");
    return parseNpdlCsv(text);
  } catch (err) {
    opts.log?.(`  ! ${target.tab} csv failed (${(err as Error).message}); trying pubhtml`);
    return parseNpdlHtmlTable(await fetchText(target.fallbackUrl, opts));
  }
}

/**
 * Scrape one season's team and school tables.
 *
 * @param season - `"2024-25"`; must be in {@link NPDL_SEASONS}.
 * @throws When the season is unknown, the page cannot be read or no sheet on
 *   it yields rows.
 */
export async function fetchNpdlSeason(
  season: string,
  opts: NpdlFetchOptions = {},
): Promise<NpdlSeasonRankings> {
  const slug = npdlSlugForSeason(season);
  if (!slug) throw new Error(`unknown NPDL season ${season}`);
  const pageUrl = NPDL_BASE_URL + slug;
  const targets = discoverNpdlSheets(await fetchText(pageUrl, opts));
  if (targets.length === 0) throw new Error(`no embedded sheets on ${pageUrl}`);

  const result: NpdlSeasonRankings = {
    season,
    pageUrl,
    fetchedAt: new Date().toISOString(),
    teams: [],
    schools: [],
  };
  for (const target of targets) {
    const { rows, skipped } = await fetchSheet(target, opts);
    opts.log?.(`  ${season}/${target.tab}: ${rows.length} rows (skipped ${skipped})`);
    // A page with two team sheets (e.g. a varsity and a novice tab) keeps the first.
    const key = target.tab === "team" ? "teams" : "schools";
    if (result[key].length === 0) result[key] = rows;
  }
  if (result.teams.length === 0 && result.schools.length === 0) {
    throw new Error(`no ranked rows on ${pageUrl}`);
  }
  return result;
}
