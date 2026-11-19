/**
 * Looks a college policy round up in the College Debate Results database
 * (collegedebateresults.vercel.app), for the "Look up results" button in the
 * video edit dialog.
 *
 * The site is a client-rendered Next.js app over a public JSON backend, so
 * this reads that backend — the same requests the site's own Tournament
 * Search, "Elim Results" and "By Round" tabs make — instead of scraping
 * rendered HTML or running a headless browser (which a Worker can't do).
 *
 * It is deliberately conservative:
 * - a winner is reported only from the round's explicit AFF/NEG decision,
 *   never inferred from seeds, standings or table order;
 * - a tournament name that matches more than one tournament in the season is
 *   rejected with the candidates, not guessed;
 * - teams match on their code ("Michigan BS") or on every debater's last name
 *   ("Michigan Barrett & Song"), and a pairing that matches more than one
 *   debate is rejected.
 */

/** The JSON backend behind collegedebateresults.vercel.app. */
export const COLLEGE_RESULTS_API = "https://backend-production-4460.up.railway.app/api";
/** The public site, for links back to a tournament. */
export const COLLEGE_RESULTS_SITE = "https://collegedebateresults.vercel.app";

/** What the edit form knows about the round. */
export interface CollegeResultsQuery {
  tournament: string;
  roundLevel?: string | null;
  affTeam: string;
  negTeam: string;
  /** The video's season year: 2027 means the 2026-2027 season. */
  seasonYear?: number | null;
  /** `YYYY-MM-DD`; picks the season when `seasonYear` is missing and breaks tournament ties. */
  publishedAt?: string | null;
}

export interface CollegeTournament {
  id: number;
  name: string;
  display_name: string | null;
  host_school: string | null;
  tournament_type: string | null;
  season: string;
  start_date: string | null;
}

interface TournamentPage {
  results: CollegeTournament[];
  total_pages?: number;
}

interface RoundSummary {
  round_number: string;
  round_type: string;
}

/** One debate on a tournament's "By Round" tab. */
export interface RoundResultRow {
  aff_team: string | null;
  aff_team_id: number | null;
  aff_debaters: string | null;
  neg_team: string | null;
  neg_team_id: number | null;
  neg_debaters: string | null;
  judge: string | null;
  decision: string | null;
}

/** One debate on a tournament's "Elim Results" tab — carries the ballot count. */
interface ElimRow {
  round: string;
  round_name?: string | null;
  aff_team_id: number | null;
  neg_team_id: number | null;
  decision: string | null;
}

export type CollegeResultsStatus = "verified" | "winner_not_explicit" | "not_found" | "ambiguous";

export interface CollegeResultsLookup {
  status: CollegeResultsStatus;
  /** One sentence for the dialog. */
  message: string;
  tournament: {
    id: number;
    name: string;
    season: string;
    startDate: string | null;
    url: string;
  } | null;
  /** The site's round name, e.g. `"Finals"` or `"Round 3"`. */
  round: string | null;
  match: {
    affTeam: string;
    affDebaters: string;
    negTeam: string;
    negDebaters: string;
    judges: string | null;
    /** The site's decision, e.g. `"NEG"` or `"NEG 3-2"`. */
    decision: string | null;
  } | null;
  /** True when the site lists the form's aff team on the neg (sides need swapping). */
  sidesSwapped: boolean;
  /** The winning side on the site, only when the site says so explicitly. */
  winnerSide: "aff" | "neg" | null;
  /** The winning team, as the site names it. */
  winnerTeam: string | null;
  /** Elim ballot count such as `"3-2"`, when the site records one. */
  ballots: string | null;
  /** Tournaments the name could mean, when it is ambiguous. */
  candidates: { id: number; name: string; startDate: string | null }[];
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Lowercase ASCII words, accents and punctuation removed. */
export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokens = (value: string) => normalize(value).split(" ").filter(Boolean);

/**
 * The season (`"2026-2027"`) a video belongs to: from its season year when
 * set, else from its publish date (August onward starts the next season).
 */
export function seasonFor(seasonYear?: number | null, publishedAt?: string | null): string | null {
  if (seasonYear && seasonYear > 2000) return `${seasonYear - 1}-${seasonYear}`;
  const match = publishedAt?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

/** Shorthand the video library uses for tournament names, spelled the way the site does. */
const TOURNAMENT_ALIASES: [RegExp, string][] = [
  [/\bndt\b/g, "national debate tournament"],
  [/\bceda nats?\b/g, "ceda nationals"],
  [/\bceda\b(?! nationals)/g, "ceda nationals"],
  [/\bada nats?\b/g, "ada nationals"],
  [/\bkyrr\b/g, "kentucky round robin"],
  [/\buk\b/g, "kentucky"],
  [/\b([a-z]+)rr\b/g, "$1 round robin"],
  [/\brr\b/g, "round robin"],
  [/\bgsu\b/g, "georgia state"],
  [/\bnats\b/g, "nationals"],
];

/** The words a tournament name must contain, with the year and aliases resolved. */
export function tournamentTokens(name: string): string[] {
  let text = normalize(name).replace(/\b(19|20)\d{2}\b/g, " ");
  for (const [pattern, replacement] of TOURNAMENT_ALIASES) text = text.replace(pattern, replacement);
  return tokens(text).filter((word) => !["the", "at", "of"].includes(word));
}

/**
 * The season's tournaments the video's tournament name could mean. Returns one
 * when the name settles it, several when it is ambiguous, none when absent.
 */
export function pickTournament(
  query: string,
  tournaments: CollegeTournament[],
  publishedAt?: string | null,
): CollegeTournament[] {
  const wanted = tournamentTokens(query);
  if (wanted.length === 0) return [];
  const has = (haystack: string) => {
    const words = new Set(tokens(haystack));
    return wanted.every((word) => words.has(word));
  };
  // Prefer the tournament's own name over a match on its host school, so
  // "Houston" means the Houston tournament, not the NDT that Houston hosted.
  let matches = tournaments.filter((t) => has(`${t.name} ${t.display_name ?? ""}`));
  if (matches.length === 0) {
    matches = tournaments.filter((t) => has(`${t.name} ${t.display_name ?? ""} ${t.host_school ?? ""}`));
  }
  const wantsRoundRobin = wanted.includes("round") && wanted.includes("robin");
  const wantsQualifier = wanted.some((word) => /^(qualifier|district|d\d)$/.test(word));
  const narrow = (keep: (t: CollegeTournament) => boolean) => {
    const kept = matches.filter(keep);
    if (kept.length > 0) matches = kept;
  };
  if (!wantsRoundRobin) narrow((t) => t.tournament_type !== "round_robin" && !/round robin/i.test(t.name));
  if (!wantsQualifier) narrow((t) => t.tournament_type !== "qualifier");
  // Same-named entries (the NDT and its duplicated listing) collapse to one.
  const exact = matches.filter((t) => normalize(t.display_name ?? t.name) === wanted.join(" "));
  if (exact.length === 1) return exact;
  if (matches.length > 1 && publishedAt) {
    // A round is posted after it happens: keep tournaments that started in
    // the 60 days before the video, and only accept the answer if it's unique.
    const posted = Date.parse(publishedAt);
    const recent = matches.filter((t) => {
      const start = t.start_date ? Date.parse(t.start_date) : NaN;
      return Number.isFinite(start) && start <= posted + 86_400_000 && posted - start <= 60 * 86_400_000;
    });
    if (recent.length === 1) return recent;
  }
  return matches;
}

/**
 * A canonical round key: `final`, `semis`, `quarters`, `octas`, `doubles`,
 * `triples`, or `round N`. `null` for anything else (runoffs, junk).
 */
export function roundKey(value: string | null | undefined): string | null {
  const text = normalize(value ?? "");
  if (!text) return null;
  const prelim = text.match(/^(?:round|rd|r)\s*(\d{1,2})$/);
  if (prelim) return `round ${Number(prelim[1])}`;
  if (/^(triples?|triple octa?s?|triple octo?s?|triple octa?finals?|triple octofinals?)$/.test(text)) return "triples";
  if (/^(doubles?|double octa?s?|double octos?|double octa?finals?|double octofinals?|dubs)$/.test(text)) return "doubles";
  if (/^(octa?s?|octos?|octa?finals?|octofinals?|eighths)$/.test(text)) return "octas";
  if (/^(quarters?|quarter ?finals?|qtrs?|qf)$/.test(text)) return "quarters";
  if (/^(semis?|semi ?finals?|sf)$/.test(text)) return "semis";
  if (/^(finals?|championship)$/.test(text)) return "final";
  return null;
}

/** Last names from a site cell like `"Barrett (29.5), Song (-)"` or `"Eleanor Barrett, Ike Song"`. */
export function debaterLastNames(cell: string | null | undefined): string[] {
  if (!cell) return [];
  return cell
    .split(",")
    .map((part) => part.replace(/\([^)]*\)/g, "").trim())
    .filter(Boolean)
    .map((name) => {
      const words = tokens(name);
      return words[words.length - 1] ?? "";
    })
    .filter(Boolean);
}

/** `"msu"` / `"msuu"`-style acronyms: the initials of a multi-word school, a trailing U allowed. */
function isAcronym(short: string, long: string): boolean {
  const words = long.split(" ");
  if (short.includes(" ") || words.length < 2) return false;
  const initials = words.map((word) => word[0]).join("");
  return short === initials || short === `${initials}u`;
}

/** `"uc berkeley"` ≈ `"berkeley"`, `"msu"` ≈ `"michigan state"`, `"gmu"` ≈ `"george mason"`. */
function sameSchool(a: string, b: string): boolean {
  return a === b || a.endsWith(` ${b}`) || b.endsWith(` ${a}`) || isAcronym(a, b) || isAcronym(b, a);
}

/**
 * `"MSU LM"` vs `"Michigan State LM"`, `"Kansas UO"` vs `"Kansas OU"`: the
 * same school and the same team-code letters, in either order (the site
 * orders debaters alphabetically; video titles don't always).
 */
function sameSchoolAndCode(form: string, site: string): boolean {
  const formWords = form.split(" ");
  const siteWords = site.split(" ");
  if (formWords.length < 2 || siteWords.length < 2) return false;
  const formCode = formWords.pop()!;
  const siteCode = siteWords.pop()!;
  const letters = (code: string) => [...code].sort().join("");
  if (formCode.length > 4 || letters(formCode) !== letters(siteCode)) return false;
  return sameSchool(formWords.join(" "), siteWords.join(" "));
}

/**
 * Whether the form's team (`"Michigan BS"`, `"Michigan Barrett & Song"`,
 * `"Michigan #2 Barrett & Song"`) is the site's team. Seeds never count.
 */
export function teamMatches(formTeam: string, siteTeam: string | null, siteDebaters: string | null): boolean {
  if (!siteTeam) return false;
  const form = normalize(formTeam.replace(/#\s*\d+/g, " "));
  if (!form) return false;
  if (form === normalize(siteTeam)) return true;
  if (sameSchoolAndCode(form, normalize(siteTeam))) return true;
  const surnames = debaterLastNames(siteDebaters);
  if (surnames.length === 0) return false;
  const words = new Set(tokens(form));
  const named = surnames.every((surname) => words.has(surname));
  if (!named) return false;
  if (surnames.length >= 2) return true;
  // A single surname (a maverick) also needs the school.
  const school = tokens(siteTeam)[0];
  return !!school && words.has(school);
}

/** `"AFF"` / `"NEG 3-2"` → side and ballots; `null` side for byes and blanks. */
export function parseDecision(decision: string | null | undefined): { side: "aff" | "neg" | null; ballots: string | null } {
  const text = (decision ?? "").trim().toUpperCase();
  const side = /^AFF/.test(text) ? "aff" : /^NEG/.test(text) ? "neg" : null;
  const ballots = text.match(/(\d+)\s*-\s*(\d+)/);
  return { side, ballots: ballots ? `${ballots[1]}-${ballots[2]}` : null };
}

const empty = (status: CollegeResultsStatus, message: string): CollegeResultsLookup => ({
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
  const res = await fetcher(`${COLLEGE_RESULTS_API}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`College Debate Results returned ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/** Every tournament in one season, across the listing's pages. */
async function seasonTournaments(fetcher: FetchLike, season: string): Promise<CollegeTournament[]> {
  const first = await getJson<TournamentPage>(fetcher, `/tournaments?season=${encodeURIComponent(season)}&page=1`);
  const all = [...(first.results ?? [])];
  const pages = Math.min(first.total_pages ?? 1, 10);
  for (let page = 2; page <= pages; page++) {
    const next = await getJson<TournamentPage>(fetcher, `/tournaments?season=${encodeURIComponent(season)}&page=${page}`);
    all.push(...(next.results ?? []));
  }
  return all;
}

/** Looks the round up. Never throws for "not found"; network failures do throw. */
export async function lookupCollegeResult(
  query: CollegeResultsQuery,
  fetcher: FetchLike = fetch,
): Promise<CollegeResultsLookup> {
  if (!query.tournament.trim() || !query.affTeam.trim() || !query.negTeam.trim()) {
    return empty("not_found", "Fill in the tournament and both teams first.");
  }
  const season = seasonFor(query.seasonYear, query.publishedAt);
  if (!season) return empty("not_found", "Set the published date so the season is known.");

  const listed = await seasonTournaments(fetcher, season);
  const candidates = pickTournament(query.tournament, listed, query.publishedAt);
  if (candidates.length === 0) {
    return empty("not_found", `No ${season} tournament on College Debate Results matches "${query.tournament}".`);
  }
  if (candidates.length > 1) {
    return {
      ...empty("ambiguous", `"${query.tournament}" matches ${candidates.length} tournaments in ${season} — refusing to guess. Use the full tournament name.`),
      candidates: candidates.map((t) => ({ id: t.id, name: t.display_name ?? t.name, startDate: t.start_date })),
    };
  }
  const tournament = candidates[0];
  const tournamentInfo = {
    id: tournament.id,
    name: tournament.display_name ?? tournament.name,
    season: tournament.season,
    startDate: tournament.start_date,
    url: `${COLLEGE_RESULTS_SITE}/tournaments/${tournament.id}`,
  };

  const rounds = await getJson<RoundSummary[]>(fetcher, `/tournaments/${tournament.id}/rounds`);
  const wantedRound = roundKey(query.roundLevel);
  // A recognised round level narrows the search to that round; an unknown
  // one searches every round and only accepts a single pairing.
  const searched = wantedRound ? rounds.filter((r) => roundKey(r.round_number) === wantedRound) : rounds;
  if (searched.length === 0) {
    return {
      ...empty("not_found", `${tournamentInfo.name} (${season}) has no ${query.roundLevel} results on College Debate Results.`),
      tournament: tournamentInfo,
    };
  }

  const found: { round: RoundSummary; row: RoundResultRow; swapped: boolean }[] = [];
  const rows = await Promise.all(
    searched.map(async (round) => ({
      round,
      rows: await getJson<RoundResultRow[]>(
        fetcher,
        `/tournaments/${tournament.id}/rounds/${encodeURIComponent(round.round_number)}`,
      ),
    })),
  );
  for (const { round, rows: debates } of rows) {
    for (const row of debates) {
      const affIsAff = teamMatches(query.affTeam, row.aff_team, row.aff_debaters);
      const negIsNeg = teamMatches(query.negTeam, row.neg_team, row.neg_debaters);
      const affIsNeg = teamMatches(query.affTeam, row.neg_team, row.neg_debaters);
      const negIsAff = teamMatches(query.negTeam, row.aff_team, row.aff_debaters);
      if (affIsAff && negIsNeg) found.push({ round, row, swapped: false });
      else if (affIsNeg && negIsAff) found.push({ round, row, swapped: true });
    }
  }

  if (found.length === 0) {
    const where = wantedRound ? searched.map((r) => r.round_number).join(", ") : "any round";
    return {
      ...empty("not_found", `No debate between ${query.affTeam} and ${query.negTeam} in ${where} at ${tournamentInfo.name} (${season}).`),
      tournament: tournamentInfo,
    };
  }
  if (found.length > 1) {
    return {
      ...empty(
        "ambiguous",
        `${query.affTeam} and ${query.negTeam} met ${found.length} times (${found.map((f) => f.round.round_number).join(", ")}) — set the round level to pick one.`,
      ),
      tournament: tournamentInfo,
    };
  }

  const { round, row, swapped } = found[0];
  let { side, ballots } = parseDecision(row.decision);
  if (round.round_type === "elim" && !ballots) {
    // The "By Round" tab gives only the side; the "Elim Results" tab adds ballots.
    const elims = await getJson<ElimRow[]>(fetcher, `/tournaments/${tournament.id}/elims`).catch(() => []);
    const elim = elims.find(
      (e) =>
        (e.round_name ?? e.round) === round.round_number &&
        e.aff_team_id === row.aff_team_id &&
        e.neg_team_id === row.neg_team_id,
    );
    const parsed = parseDecision(elim?.decision);
    // Only take the ballots when both tabs agree on the side.
    if (parsed.side && parsed.side === side) ballots = parsed.ballots;
  }

  const affTeam = row.aff_team ?? "";
  const negTeam = row.neg_team ?? "";
  const winnerTeam = side === "aff" ? affTeam : side === "neg" ? negTeam : null;
  return {
    status: side ? "verified" : "winner_not_explicit",
    message: side
      ? `${round.round_number}: ${winnerTeam} won on the ${side.toUpperCase()}${ballots ? ` ${ballots}` : ""}.`
      : `${round.round_number}: found the debate, but the site records no decision.`,
    tournament: tournamentInfo,
    round: round.round_number,
    match: {
      affTeam,
      affDebaters: row.aff_debaters ?? "",
      negTeam,
      negDebaters: row.neg_debaters ?? "",
      judges: row.judge,
      decision: row.decision,
    },
    sidesSwapped: swapped,
    winnerSide: side,
    winnerTeam,
    ballots,
    candidates: [],
  };
}

/** A round's panel as the site lists it: `"Jacob Wilkus, Cade Blenden*, …"`. */
export interface JudgePanel {
  /** Every judge, the minority marker removed. */
  judges: string[];
  /**
   * The judges who voted against the winner ("squirrels"), `[]` for a
   * unanimous or one-judge decision, `null` when the site's markers don't
   * add up to the ballot count, so nobody is named on a guess.
   */
  squirrels: string[] | null;
}

/**
 * Splits the site's judge list. College Debate Results marks each judge in
 * the minority with a trailing `*` (the 2026 Shirley final, "NEG 3-2", marks
 * two of its five). Squirrels are only reported when the marks match the
 * ballot count's minority.
 */
export function parseJudgePanel(judges: string | null | undefined, ballots: string | null): JudgePanel {
  const entries = (judges ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const names = entries.map((name) => name.replace(/\*+$/, "").trim());
  const marked = entries.filter((name) => name.endsWith("*")).map((name) => name.replace(/\*+$/, "").trim());
  if (names.length === 0) return { judges: [], squirrels: null };
  const split = ballots?.match(/^(\d+)-(\d+)$/);
  if (split) {
    const minority = Math.min(Number(split[1]), Number(split[2]));
    return { judges: names, squirrels: marked.length === minority ? marked : null };
  }
  // No ballot count (a prelim): one judge can't squirrel; unmarked panels have none.
  return { judges: names, squirrels: marked.length === 0 ? [] : null };
}

/** Thrown by a {@link createBudgetedFetcher} fetcher once its request budget is spent. */
export class RequestBudgetExceeded extends Error {
  constructor() {
    super("College Debate Results request budget for this batch is spent");
    this.name = "RequestBudgetExceeded";
  }
}

/**
 * A fetcher for bulk lookups: answers repeat GETs from memory (a batch of
 * rounds from one tournament shares its season list, round list and elims),
 * spaces real requests `delayMs` apart so the results site isn't hammered,
 * and stops at `maxRequests` so one Worker invocation stays under its
 * subrequest limit.
 */
export function createBudgetedFetcher(
  fetcher: FetchLike,
  { maxRequests, delayMs = 0, sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)) }: {
    maxRequests: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<unknown>;
  },
): FetchLike & { requests: () => number } {
  const cache = new Map<string, Promise<{ status: number; body: string }>>();
  let requests = 0;
  const budgeted = (async (input: string, init?: RequestInit) => {
    let entry = cache.get(input);
    if (!entry) {
      if (requests >= maxRequests) throw new RequestBudgetExceeded();
      const wait = requests > 0 && delayMs > 0 ? sleep(delayMs) : Promise.resolve();
      requests++;
      entry = wait.then(async () => {
        const res = await fetcher(input, init);
        return { status: res.status, body: await res.text() };
      });
      cache.set(input, entry);
      entry.catch(() => cache.delete(input));
    }
    const { status, body } = await entry;
    return new Response(body, { status });
  }) as FetchLike & { requests: () => number };
  budgeted.requests = () => requests;
  return budgeted;
}

/** The stored fields of one college round, as the bulk fill reads them. */
export interface StoredRoundResult {
  affWin: boolean | null;
  judgeDecision: string | null;
}

/** What the bulk fill writes for one video. */
export interface CollegeResultUpdate {
  /**
   * `verified`, `winner_not_explicit`, `not_found`, `ambiguous`, `conflict`
   * (the site disagrees with a saved winner) or `error` (the lookup failed).
   */
  status: CollegeResultsStatus | "conflict" | "error";
  /** Set only when the video had no winner saved. */
  affWin?: boolean;
  /** Set only when the video had no decision saved. */
  judgeDecision?: string;
  /** Comma-separated judge names, or null when no debate was found. */
  judges: string | null;
  /** Comma-separated squirrels, `""` for none, null when unknown. */
  squirrels: string | null;
  /** The tournament's College Debate Results id, when one was settled. */
  tournamentId: number | null;
}

/**
 * Turns a lookup into the columns to write for a stored round. Fills only
 * what the video lacks: a saved winner the site contradicts is left alone and
 * flagged `conflict` for an editor, never overwritten. Sides are not swapped
 * in bulk; the winner is translated to the video's own aff/neg.
 */
export function planCollegeResultUpdate(stored: StoredRoundResult, lookup: CollegeResultsLookup): CollegeResultUpdate {
  const panel = lookup.match ? parseJudgePanel(lookup.match.judges, lookup.ballots) : null;
  const update: CollegeResultUpdate = {
    status: lookup.status,
    judges: panel && panel.judges.length > 0 ? panel.judges.join(", ") : null,
    squirrels: panel?.squirrels ? panel.squirrels.join(", ") : null,
    tournamentId: lookup.tournament?.id ?? null,
  };
  if (lookup.status !== "verified" || !lookup.winnerSide) return update;
  // The site's aff is the video's neg when the sides are swapped.
  const videoAffWon = (lookup.winnerSide === "aff") !== lookup.sidesSwapped;
  if (stored.affWin === null) update.affWin = videoAffWon;
  else if (stored.affWin !== videoAffWon) update.status = "conflict";
  if (!stored.judgeDecision?.trim() && lookup.ballots) update.judgeDecision = lookup.ballots;
  return update;
}
