/**
 * Looks a high-school debate round up on Tabroom.com's public API
 * (`https://api.tabroom.com/v1`), for the "Look up results" button in the
 * video edit dialog (Policy, PF, LD, Parliamentary).
 *
 * Mirrors {@link ./college-results.ts}: same conservative rules (explicit
 * win/loss only, ambiguous tournaments and pairings refused) and the same
 * lookup shape so the edit dialog can reuse "Use this result".
 *
 * Data path (the same endpoints `/tournament` already proxies):
 * - `GET /rest/tourns?publishedResults&startAfter&startBefore` — season list
 * - `GET /rest/tourns/{id}/rounds` — published rounds
 * - `GET /pages/invite/{id}/{eventAbbr}/{roundName}/results` — ballots
 *
 * The last two need a signed-in session: the app passes `tabroomFetch` (the
 * Tabroom login saved under Admin → Service logins, else `TABROOM_API_KEY`).
 * A 401/403 throws {@link TabroomAuthError} rather than reading as "no
 * results", so a lost session is reported instead of hidden.
 */

import {
  createBudgetedFetcher,
  normalize,
  planCollegeResultUpdate,
  RequestBudgetExceeded,
  roundKey,
  seasonFor,
  teamMatches,
  type CollegeResultUpdate,
  type CollegeResultsLookup,
  type CollegeResultsStatus,
  type StoredRoundResult,
} from "./college-results";
import { TabroomAuthError } from "./hs-results";

/** Live Tabroom API root (same as `TABROOM_BETA_API` in the webview proxy). */
export const TABROOM_RESULTS_API = "https://api.tabroom.com/v1";
/** Classic Tabroom invite URL for links back to a tournament. */
export const TABROOM_RESULTS_SITE = "https://www.tabroom.com";

export { createBudgetedFetcher, RequestBudgetExceeded, roundKey, seasonFor, TabroomAuthError };

/** What the edit form knows about the round. */
export interface TabroomResultsQuery {
  tournament: string;
  roundLevel?: string | null;
  affTeam: string;
  negTeam: string;
  /** The video's season year: 2027 means the 2026-2027 season. */
  seasonYear?: number | null;
  /** `YYYY-MM-DD`; picks the season when `seasonYear` is missing and breaks tournament ties. */
  publishedAt?: string | null;
  /**
   * Video style: `1` Policy, `2` PF, `3` LD, `8` Parliamentary. Narrows which
   * Tabroom events are searched when a tournament runs several formats.
   */
  style?: number | null;
}

/** A row of `GET /rest/tourns` as this lookup reads it. */
export interface TabroomTournament {
  id: number;
  name: string;
  start: string | null;
  end?: string | null;
  city?: string | null;
  state?: string | null;
  webname?: string | null;
}

/** A row of `GET /rest/tourns/{id}/rounds`. */
export interface TabroomPublishedRound {
  id: number;
  type: string;
  name: number;
  label: string | null;
  Event: { id: number; name: string | null; abbr: string | null; type?: string | null };
}

/** One entry on a Tabroom round-results section. */
interface TabroomResultEntry {
  id: number;
  code?: string;
  name?: string | null;
  schoolName?: string | null;
  side?: number | string;
  Ballots?: Record<string, { winloss?: string | null; point?: number | null; rank?: number | null }>;
}

/** Public results for one round (`/pages/invite/.../results`). */
export interface TabroomRoundResults {
  id: number;
  name: number;
  label: string;
  Event: {
    id: number;
    abbr?: string;
    name?: string;
    type?: string;
    Settings?: { affLabel?: string; negLabel?: string };
  };
  Sections: Record<
    string,
    {
      id: number;
      letter?: string;
      bye?: number;
      Judges?: Record<string, { first?: string; last?: string; chair?: number }>;
      Entries?: Record<string, TabroomResultEntry>;
    }
  >;
}

export type TabroomResultsStatus = CollegeResultsStatus;

/** Same shape as {@link CollegeResultsLookup} so the edit dialog can reuse apply/plan helpers. */
export type TabroomResultsLookup = CollegeResultsLookup;

export type TabroomResultUpdate = CollegeResultUpdate;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Shorthand the video library uses for high-school tournament names. */
const TOURNAMENT_ALIASES: [RegExp, string][] = [
  [/\btoc\b/g, "tournament of champions"],
  [/\bglenbrooks?\b/g, "glenbrooks"],
  [/\bgreenhill\b/g, "greenhill"],
  [/\bbarkley\b/g, "emory barkley"],
  [/\bemory\b(?! barkley)/g, "emory barkley"],
  [/\bharvard\b/g, "harvard"],
  [/\byale\b/g, "yale"],
  [/\bberkeley\b/g, "berkeley"],
  [/\bcal\b/g, "berkeley"],
  [/\bloyola\b/g, "loyola"],
  [/\bgrapevine\b/g, "grapevine"],
  [/\bukso\b/g, "university of kentucky"],
  [/\bucla\b/g, "ucla"],
  [/\b([a-z]+)rr\b/g, "$1 round robin"],
  [/\brr\b/g, "round robin"],
  [/\bnats\b/g, "nationals"],
];

const tokens = (value: string) => normalize(value).split(" ").filter(Boolean);

/** The words a tournament name must contain, with aliases resolved. */
export function tournamentTokens(name: string): string[] {
  let text = normalize(name).replace(/\b(19|20)\d{2}\b/g, " ");
  for (const [pattern, replacement] of TOURNAMENT_ALIASES) text = text.replace(pattern, replacement);
  return tokens(text).filter((word) => !["the", "at", "of", "high", "school", "invitational", "tournament"].includes(word));
}

/**
 * Season window for Tabroom's `startAfter` / `startBefore`: Aug 1 of the
 * start year through Aug 1 of the end year (exclusive).
 */
export function seasonDateRange(season: string): { startAfter: string; startBefore: string } | null {
  const match = season.match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  return {
    startAfter: new Date(Date.UTC(startYear, 7, 1) - 1).toISOString(),
    startBefore: new Date(Date.UTC(endYear, 7, 1)).toISOString(),
  };
}

/**
 * The season's tournaments the video's tournament name could mean. Returns one
 * when the name settles it, several when it is ambiguous, none when absent.
 */
export function pickTabroomTournament(
  query: string,
  tournaments: TabroomTournament[],
  publishedAt?: string | null,
): TabroomTournament[] {
  const wanted = tournamentTokens(query);
  if (wanted.length === 0) return [];
  const has = (haystack: string) => {
    const words = new Set(tokens(haystack));
    return wanted.every((word) => words.has(word) || [...words].some((w) => w.includes(word) || word.includes(w)));
  };
  let matches = tournaments.filter((t) => has(t.name));
  const wantsRoundRobin = wanted.includes("round") && wanted.includes("robin");
  if (!wantsRoundRobin) {
    const withoutRr = matches.filter((t) => !/round robin/i.test(t.name));
    if (withoutRr.length > 0) matches = withoutRr;
  } else {
    const onlyRr = matches.filter((t) => /round robin/i.test(t.name));
    if (onlyRr.length > 0) matches = onlyRr;
  }
  const exact = matches.filter((t) => {
    const nameTokens = tournamentTokens(t.name);
    return nameTokens.length === wanted.length && wanted.every((w) => nameTokens.includes(w));
  });
  if (exact.length === 1) return exact;
  if (matches.length > 1 && publishedAt) {
    const posted = Date.parse(publishedAt);
    const recent = matches.filter((t) => {
      const start = t.start ? Date.parse(t.start.includes("T") || t.start.includes("Z") ? t.start : `${t.start.replace(" ", "T")}Z`) : NaN;
      return Number.isFinite(start) && start <= posted + 86_400_000 && posted - start <= 60 * 86_400_000;
    });
    if (recent.length === 1) return recent;
  }
  return matches;
}

/**
 * Whether a Tabroom event matches the video's debate style. Unknown /
 * missing style accepts any debate-like event.
 */
export function eventMatchesStyle(
  event: { name?: string | null; abbr?: string | null; type?: string | null },
  style?: number | null,
): boolean {
  const hay = `${event.abbr ?? ""} ${event.name ?? ""}`.toLowerCase();
  if (style === 1) return /\b(cx|policy|cross[\s-]?x)\b/.test(hay) || /policy/.test(hay);
  if (style === 2) return /\b(pf|pufo|public[\s-]?forum)\b/.test(hay);
  if (style === 3) return /\b(ld|lincoln)\b/.test(hay);
  if (style === 8) return /\b(parli|npdl|parliamentary)\b/.test(hay);
  // No style: skip speech / congress / interp events.
  if (event.type && !/debate|congress|speech/i.test(event.type)) return false;
  return !/\b(di|hi|duo|oo|oi|info|extemp|congress|house|senate|interp)\b/.test(hay);
}

/** Aff/Neg from a Tabroom side label or numeric side (1 = aff, 2 = neg). */
export function entrySide(side: number | string | null | undefined, affLabel = "Aff", negLabel = "Neg"): "aff" | "neg" | null {
  if (side === 1 || side === "1") return "aff";
  if (side === 2 || side === "2") return "neg";
  const text = String(side ?? "").trim().toLowerCase();
  if (!text) return null;
  if (text === affLabel.toLowerCase() || text === "aff" || text === "pro" || text === "gov") return "aff";
  if (text === negLabel.toLowerCase() || text === "neg" || text === "con" || text === "opp") return "neg";
  return null;
}

/** Whether the form's team matches a Tabroom entry (code, school+code, or surnames). */
export function tabroomTeamMatches(formTeam: string, entry: TabroomResultEntry): boolean {
  const code = entry.code ?? "";
  const debaters = entry.name ?? null;
  if (teamMatches(formTeam, code, debaters)) return true;
  // `"Westlake SS"` vs code `"Westlake SS"` already handled; also try school + last names.
  if (entry.schoolName && debaters) {
    const composed = `${entry.schoolName} ${debaters}`;
    if (teamMatches(formTeam, composed, debaters)) return true;
  }
  return false;
}

/**
 * Winner side and ballot count from a section's win/loss ballots. Only reports
 * a side when every deciding ballot agrees; otherwise `null` side.
 */
export function decisionFromSection(
  section: TabroomRoundResults["Sections"][string],
  affLabel = "Aff",
  negLabel = "Neg",
): { side: "aff" | "neg" | null; ballots: string | null; judges: string | null; squirrels: string[] | null } {
  const judges = Object.entries(section.Judges ?? {}).map(([id, j]) => ({
    id,
    name: [j.first, j.last].filter(Boolean).join(" ").trim() || id,
  }));
  const entries = Object.values(section.Entries ?? {});
  const aff = entries.find((e) => entrySide(e.side, affLabel, negLabel) === "aff");
  const neg = entries.find((e) => entrySide(e.side, affLabel, negLabel) === "neg");
  if (!aff || !neg) {
    return { side: null, ballots: null, judges: judges.map((j) => j.name).join(", ") || null, squirrels: null };
  }

  let affWins = 0;
  let negWins = 0;
  const minorityIds: string[] = [];
  for (const judge of judges) {
    const affBallot = aff.Ballots?.[judge.id]?.winloss?.toUpperCase();
    const negBallot = neg.Ballots?.[judge.id]?.winloss?.toUpperCase();
    const affWon = affBallot === "W" || negBallot === "L";
    const negWon = negBallot === "W" || affBallot === "L";
    if (affWon === negWon) continue;
    if (affWon) affWins++;
    else negWins++;
  }
  const total = affWins + negWins;
  if (total === 0) {
    return { side: null, ballots: null, judges: judges.map((j) => j.name).join(", ") || null, squirrels: null };
  }
  const side: "aff" | "neg" = affWins > negWins ? "aff" : negWins > affWins ? "neg" : null!;
  if (affWins === negWins) {
    return { side: null, ballots: null, judges: judges.map((j) => j.name).join(", ") || null, squirrels: null };
  }
  const winnerWins = side === "aff" ? affWins : negWins;
  const loserWins = side === "aff" ? negWins : affWins;
  for (const judge of judges) {
    const affBallot = aff.Ballots?.[judge.id]?.winloss?.toUpperCase();
    const negBallot = neg.Ballots?.[judge.id]?.winloss?.toUpperCase();
    if (!(affBallot || negBallot)) continue;
    const forWinner =
      (side === "aff" && (affBallot === "W" || negBallot === "L")) ||
      (side === "neg" && (negBallot === "W" || affBallot === "L"));
    if (!forWinner && (affBallot === "W" || affBallot === "L" || negBallot === "W" || negBallot === "L")) {
      minorityIds.push(judge.id);
    }
  }
  const squirrelNames = judges.filter((j) => minorityIds.includes(j.id)).map((j) => j.name);
  const ballots = `${winnerWins}-${loserWins}`;
  // Mark squirrels with a trailing `*` so parseJudgePanel / JudgeVotes work.
  const judgeList = judges
    .map((j) => (minorityIds.includes(j.id) ? `${j.name}*` : j.name))
    .join(", ");
  return {
    side,
    ballots: total === 1 ? "1-0" : ballots,
    judges: judgeList || null,
    squirrels: squirrelNames.length === loserWins ? squirrelNames : squirrelNames.length === 0 ? [] : null,
  };
}

const empty = (status: TabroomResultsStatus, message: string): TabroomResultsLookup => ({
  status,
  message,
  tournament: null,
  round: null,
  match: null,
  sidesSwapped: false,
  winnerSide: null,
  winnerTeam: null,
  ballots: null,
  candidates: [],
});

async function getJson<T>(fetcher: FetchLike, path: string): Promise<T> {
  const res = await fetcher(`${TABROOM_RESULTS_API}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 || res.status === 403) throw new TabroomAuthError(path, res.status);
  if (!res.ok) throw new Error(`Tabroom returned ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/** Every tournament with published results in one season, across pages. */
async function seasonTournaments(fetcher: FetchLike, season: string): Promise<TabroomTournament[]> {
  const range = seasonDateRange(season);
  if (!range) return [];
  const all: TabroomTournament[] = [];
  const pageSize = 500;
  for (let page = 0; page < 12; page++) {
    const query = new URLSearchParams({
      startAfter: range.startAfter,
      startBefore: range.startBefore,
      publishedResults: "true",
      limit: String(pageSize),
      offset: String(page * pageSize),
      fields: "id,name,start,end,city,state,webname",
    });
    const got = await getJson<TabroomTournament[]>(fetcher, `/rest/tourns?${query}`);
    if (!Array.isArray(got)) break;
    all.push(...got);
    if (got.length < pageSize) break;
  }
  return all;
}

/** Classic Tabroom results URL for a tournament. */
export function tabroomTournamentUrl(tourn: TabroomTournament): string {
  return `${TABROOM_RESULTS_SITE}/index/tourn/results/index.mhtml?tourn_id=${tourn.id}`;
}

/** Looks the round up. Never throws for "not found"; network and auth failures do throw. */
export async function lookupTabroomResult(
  query: TabroomResultsQuery,
  fetcher: FetchLike = fetch,
): Promise<TabroomResultsLookup> {
  if (!query.tournament.trim() || !query.affTeam.trim() || !query.negTeam.trim()) {
    return empty("not_found", "Fill in the tournament and both teams first.");
  }
  const season = seasonFor(query.seasonYear, query.publishedAt);
  if (!season) return empty("not_found", "Set the published date so the season is known.");

  const listed = await seasonTournaments(fetcher, season);
  const candidates = pickTabroomTournament(query.tournament, listed, query.publishedAt);
  if (candidates.length === 0) {
    return empty("not_found", `No ${season} tournament on Tabroom with published results matches "${query.tournament}".`);
  }
  if (candidates.length > 1) {
    return {
      ...empty(
        "ambiguous",
        `"${query.tournament}" matches ${candidates.length} tournaments in ${season} — refusing to guess. Use the full tournament name.`,
      ),
      candidates: candidates.map((t) => ({ id: t.id, name: t.name, startDate: t.start })),
    };
  }
  const tournament = candidates[0];
  const tournamentInfo = {
    id: tournament.id,
    name: tournament.name,
    season,
    startDate: tournament.start,
    url: tabroomTournamentUrl(tournament),
  };

  const rounds = await getJson<TabroomPublishedRound[]>(fetcher, `/rest/tourns/${tournament.id}/rounds`);
  if (!Array.isArray(rounds) || rounds.length === 0) {
    return {
      ...empty("not_found", `${tournamentInfo.name} (${season}) has no published rounds on Tabroom.`),
      tournament: tournamentInfo,
    };
  }

  const wantedRound = roundKey(query.roundLevel);
  const styleFiltered = rounds.filter((r) => eventMatchesStyle(r.Event, query.style));
  const pool = styleFiltered.length > 0 ? styleFiltered : rounds;
  const searched = wantedRound ? pool.filter((r) => roundKey(r.label) === wantedRound || roundKey(`Round ${r.name}`) === wantedRound) : pool;
  if (searched.length === 0) {
    return {
      ...empty(
        "not_found",
        `${tournamentInfo.name} (${season}) has no ${query.roundLevel ?? "matching"} results on Tabroom` +
          (query.style ? " for this event format" : "") +
          ".",
      ),
      tournament: tournamentInfo,
    };
  }

  type Found = {
    round: TabroomPublishedRound;
    results: TabroomRoundResults;
    section: TabroomRoundResults["Sections"][string];
    aff: TabroomResultEntry;
    neg: TabroomResultEntry;
    swapped: boolean;
  };
  const found: Found[] = [];

  const loaded = await Promise.all(
    searched.map(async (round) => {
      const abbr = round.Event.abbr;
      if (!abbr) return { round, results: null as TabroomRoundResults | null };
      try {
        const results = await getJson<TabroomRoundResults>(
          fetcher,
          `/pages/invite/${tournament.id}/${encodeURIComponent(abbr)}/${encodeURIComponent(String(round.name))}/results`,
        );
        return { round, results };
      } catch (error) {
        if (error instanceof TabroomAuthError) throw error;
        return { round, results: null };
      }
    }),
  );

  for (const { round, results } of loaded) {
    if (!results?.Sections) continue;
    const affLabel = results.Event.Settings?.affLabel ?? "Aff";
    const negLabel = results.Event.Settings?.negLabel ?? "Neg";
    for (const section of Object.values(results.Sections)) {
      if (section.bye) continue;
      const entries = Object.values(section.Entries ?? {});
      const aff = entries.find((e) => entrySide(e.side, affLabel, negLabel) === "aff");
      const neg = entries.find((e) => entrySide(e.side, affLabel, negLabel) === "neg");
      if (!aff || !neg) continue;
      const affIsAff = tabroomTeamMatches(query.affTeam, aff);
      const negIsNeg = tabroomTeamMatches(query.negTeam, neg);
      const affIsNeg = tabroomTeamMatches(query.affTeam, neg);
      const negIsAff = tabroomTeamMatches(query.negTeam, aff);
      if (affIsAff && negIsNeg) found.push({ round, results, section, aff, neg, swapped: false });
      else if (affIsNeg && negIsAff) found.push({ round, results, section, aff, neg, swapped: true });
    }
  }

  if (found.length === 0) {
    const where = wantedRound ? searched.map((r) => r.label || `Round ${r.name}`).join(", ") : "any round";
    return {
      ...empty("not_found", `No debate between ${query.affTeam} and ${query.negTeam} in ${where} at ${tournamentInfo.name} (${season}).`),
      tournament: tournamentInfo,
    };
  }
  if (found.length > 1) {
    return {
      ...empty(
        "ambiguous",
        `${query.affTeam} and ${query.negTeam} met ${found.length} times (${found.map((f) => f.round.label || `Round ${f.round.name}`).join(", ")}) — set the round level to pick one.`,
      ),
      tournament: tournamentInfo,
    };
  }

  const { round, results, section, aff, neg, swapped } = found[0];
  const affLabel = results.Event.Settings?.affLabel ?? "Aff";
  const negLabel = results.Event.Settings?.negLabel ?? "Neg";
  const decision = decisionFromSection(section, affLabel, negLabel);
  const roundLabel = results.label || round.label || `Round ${round.name}`;
  const affTeam = aff.code ?? aff.name ?? "";
  const negTeam = neg.code ?? neg.name ?? "";
  const winnerTeam = decision.side === "aff" ? affTeam : decision.side === "neg" ? negTeam : null;

  return {
    status: decision.side ? "verified" : "winner_not_explicit",
    message: decision.side
      ? `${roundLabel}: ${winnerTeam} won on the ${decision.side.toUpperCase()}${decision.ballots ? ` ${decision.ballots}` : ""}.`
      : `${roundLabel}: found the debate, but Tabroom records no decision.`,
    tournament: tournamentInfo,
    round: roundLabel,
    match: {
      affTeam,
      affDebaters: aff.name ?? "",
      negTeam,
      negDebaters: neg.name ?? "",
      judges: decision.judges,
      decision: decision.side ? decision.side.toUpperCase() : null,
    },
    sidesSwapped: swapped,
    winnerSide: decision.side,
    winnerTeam,
    ballots: decision.ballots,
    candidates: [],
  };
}

/** Turns a lookup into the columns to write for a stored round (same rules as college). */
export function planTabroomResultUpdate(stored: StoredRoundResult, lookup: TabroomResultsLookup): TabroomResultUpdate {
  return planCollegeResultUpdate(stored, lookup);
}
