/**
 * Looks a high school Policy, PF or LD round up on Tabroom, for the "Look up
 * results" button in the video edit dialog and the admin bulk fill — the
 * high school twin of `college-results.ts` (College Debate Results).
 *
 * It reads Tabroom's JSON API (`https://api.tabroom.com/v1`, the API behind
 * beta.tabroom.com):
 * - `GET /rest/tourns?startAfter=&startBefore=` — the season's tournaments
 *   (public);
 * - `GET /rest/tourns/:id/invite` — the tournament's events (public);
 * - `GET /rest/tourns/:id/rounds` — its published rounds (signed in);
 * - `GET /pages/invite/:id/:event/:round/results` — one round's sections:
 *   both entries with their side, school, code and debaters, every judge,
 *   and each judge's W/L ballot (signed in).
 *
 * The last two answer 401 to signed-out requests, so the server passes a
 * `fetch` that sends the site's `TabroomToken` cookie (`tabroomFetch`: the
 * Tabroom login saved under Admin → Service logins, re-logging in once when
 * Tabroom rejects its session, else the `TABROOM_API_KEY` secret).
 *
 * Same rules as the college lookup: a winner only from the judges' recorded
 * ballots (never seeds or brackets), ambiguous tournaments and pairings are
 * refused with the candidates rather than guessed, and the answer has the
 * college lookup's shape so the dialog and bulk fill handle both alike.
 */

import {
  debaterLastNames,
  normalize,
  roundKey,
  sameSchool,
  seasonFor,
  teamMatches,
  type CollegeResultsLookup,
  type CollegeResultsStatus,
} from "./college-results";

/** Tabroom's JSON API. */
export const TABROOM_API = "https://api.tabroom.com/v1";
/** Classic Tabroom, for links back to a tournament or round. */
export const TABROOM_SITE = "https://www.tabroom.com";

/** The video styles Tabroom covers: high school Policy, PF and LD. */
export const HS_STYLES = ["1", "2", "3"] as const;

/** What the edit form knows about the round. */
export interface HsResultsQuery {
  /** The video's style: 1 Policy, 2 PF, 3 LD. */
  style: number | string;
  tournament: string;
  roundLevel?: string | null;
  affTeam: string;
  negTeam: string;
  /** The video's season year: 2025 means the 2024-2025 season. */
  seasonYear?: number | null;
  /** `YYYY-MM-DD`; narrows the tournament search and picks the season when `seasonYear` is missing. */
  publishedAt?: string | null;
}

export interface TabroomTourn {
  id: number;
  name: string;
  start: string | null;
  state?: string | null;
}

export interface TabroomEvent {
  id: number;
  abbr: string;
  name: string;
  type: string;
  NSDACategory?: { name?: string | null } | null;
}

export interface TabroomRound {
  id: number;
  type: string | null;
  name: number;
  label: string | null;
  Event?: { abbr?: string | null } | null;
}

interface TabroomEntry {
  id?: number;
  code?: string | null;
  name?: string | null;
  side?: string | number | null;
  schoolName?: string | null;
  Speakers?: Record<string, { first?: string | null; last?: string | null }>;
  Ballots?: Record<string, { winloss?: string | null }>;
}

interface TabroomSection {
  id?: number;
  bye?: number | boolean | null;
  Entries?: Record<string, TabroomEntry>;
  Judges?: Record<string, { first?: string | null; last?: string | null; chair?: number | null }>;
}

/** `GET /pages/invite/:tourn/:event/:round/results`. */
export interface TabroomRoundResults {
  id: number;
  name: number;
  label?: string | null;
  Event?: { Settings?: { affLabel?: string | null; negLabel?: string | null } | null } | null;
  Sections?: Record<string, TabroomSection>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Thrown when Tabroom refuses a read that needs the site's Tabroom session. */
export class TabroomAuthError extends Error {
  constructor(
    path: string,
    readonly status = 401,
  ) {
    super(
      `Tabroom answered ${status} for ${path}: round results need a signed-in session — save a Tabroom login under Admin → Service logins (or set the TABROOM_API_KEY secret).`,
    );
    this.name = "TabroomAuthError";
  }
}

class TabroomNotFound extends Error {}

async function getJson<T>(fetcher: FetchLike, path: string): Promise<T> {
  const res = await fetcher(`${TABROOM_API}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 || res.status === 403) throw new TabroomAuthError(path, res.status);
  if (res.status === 404) throw new TabroomNotFound(path);
  if (!res.ok) throw new Error(`Tabroom returned ${res.status} for ${path}`);
  return (await res.json()) as T;
}

const words = (value: string) => normalize(value).split(" ").filter(Boolean);

/** Shorthand video titles use for high school tournaments, spelled the way Tabroom does. */
const HS_TOURNAMENT_ALIASES: [RegExp, string][] = [
  [/\bnsda (nationals?|nats)\b/g, "national speech debate tournament"],
  [/\bnsda\b/g, "national speech debate tournament"],
  [/\btoc\b/g, "tournament of champions"],
  [/\bndca\b/g, "national debate coaches association"],
  [/\bglenbrook\b/g, "glenbrooks"],
  [/\bnats\b/g, "nationals"],
  [/\b([a-z]+)rr\b/g, "$1 round robin"],
  [/\brr\b/g, "round robin"],
];

/** Words that never distinguish one tournament from another. */
const FILLER = new Set(["the", "at", "of", "and", "for", "annual", "a"]);

/** A tournament name's distinguishing words: no years, ordinals ("53rd") or filler. */
function nameWords(name: string): string[] {
  return words(name.replace(/\b(19|20)\d{2}\b/g, " ")).filter((w) => !FILLER.has(w) && !/^\d+(st|nd|rd|th)$/.test(w));
}

/** The words a Tabroom tournament name must contain, with the year and aliases resolved. */
export function hsTournamentTokens(name: string): string[] {
  let text = normalize(name).replace(/\b(19|20)\d{2}\b/g, " ");
  for (const [pattern, replacement] of HS_TOURNAMENT_ALIASES) text = text.replace(pattern, replacement);
  return nameWords(text);
}

/** Tabroom tournaments a high school varsity round is never from, unless the title says so. */
const NOT_VARSITY = /\b(middle school|ms|mstoc|elementary|novice|jv|scrimmage|practice|warm ?up|async)\b/;

/**
 * The tournaments the video's tournament name could mean: one when the name
 * settles it, several when it is ambiguous, none when absent.
 */
export function pickHsTournament(query: string, tourns: TabroomTourn[], publishedAt?: string | null): TabroomTourn[] {
  const wanted = hsTournamentTokens(query);
  if (wanted.length === 0) return [];
  const wantedText = wanted.join(" ");
  let matches = tourns.filter((t) => {
    const have = new Set(words(t.name));
    return wanted.every((w) => have.has(w));
  });
  if (!NOT_VARSITY.test(wantedText)) {
    const varsity = matches.filter((t) => !NOT_VARSITY.test(normalize(t.name)));
    if (varsity.length > 0) matches = varsity;
  }
  if (!/\bround robin\b/.test(wantedText)) {
    const notRr = matches.filter((t) => !/\bround robin\b/.test(normalize(t.name)));
    if (notRr.length > 0) matches = notRr;
  }
  if (matches.length <= 1) return matches;
  // "TOC" is "53rd Annual Tournament of Champions", not "TOC Digital Speech
  // Tournament of Champions": prefer names with no words beyond the query's.
  const wantedSet = new Set(wanted);
  const exact = matches.filter((t) => nameWords(t.name).every((w) => wantedSet.has(w)));
  if (exact.length === 1) return exact;
  if (exact.length > 1) matches = exact;
  if (publishedAt) {
    // A round is posted after it happens: tournaments that started in the 75 days before.
    const posted = Date.parse(publishedAt);
    const recent = matches.filter((t) => {
      const start = t.start ? Date.parse(t.start) : NaN;
      return Number.isFinite(start) && start <= posted + 86_400_000 && posted - start <= 75 * 86_400_000;
    });
    if (recent.length === 1) return recent;
  }
  return matches;
}

/** How each style's events are named on Tabroom (event name, abbreviation or NSDA category). */
const STYLE_EVENTS: Record<string, RegExp> = {
  "1": /\b(policy|cx)\b/,
  "2": /\b(public forum|pf|pfd)\b/,
  "3": /\b(lincoln douglas|lincoln|ld|lde)\b/,
};

/** Divisions a varsity round isn't from. */
const LOWER_DIVISION = /\b(novice|nov|jv|junior varsity|middle school|ms|elementary|silver|bronze|beginner|rookie)\b/;

/**
 * The tournament's events of the video's style: the varsity/open divisions
 * when there are any. More than one (Gold and Open, say) are all searched,
 * and only a single matching debate across them is accepted.
 */
export function pickEvents(style: number | string, events: TabroomEvent[]): TabroomEvent[] {
  const pattern = STYLE_EVENTS[String(style)];
  if (!pattern) return [];
  const ofStyle = events.filter(
    (e) => e.type === "debate" && pattern.test(normalize(`${e.name} ${e.abbr} ${e.NSDACategory?.name ?? ""}`)),
  );
  const varsity = ofStyle.filter((e) => !LOWER_DIVISION.test(normalize(`${e.name} ${e.abbr}`)));
  return varsity.length > 0 ? varsity : ofStyle;
}

const ELIM_ORDER = ["final", "semis", "quarters", "octas", "doubles", "triples"];

/**
 * Each round's canonical key (`round 3`, `quarters`, `final`) for one event.
 * Elims Tabroom left unlabelled ("Round 9") are named by counting back from
 * the last elim: the last is the final, the one before it semis, and so on.
 */
export function eventRoundKeys(rounds: TabroomRound[]): Map<number, string | null> {
  const keys = new Map<number, string | null>();
  const elims = rounds
    .filter((r) => r.type === "elim" || r.type === "final")
    .sort((a, b) => b.name - a.name);
  for (const round of rounds) {
    const labelled = roundKey(round.label);
    if (labelled) keys.set(round.id, labelled);
    else if (round.type === "elim" || round.type === "final") {
      keys.set(round.id, ELIM_ORDER[elims.indexOf(round)] ?? null);
    } else keys.set(round.id, `round ${round.name}`);
  }
  return keys;
}

/** The round's name as the dialog shows it: its label, or "Round N". */
const roundTitle = (round: TabroomRound) => round.label?.trim() || `Round ${round.name}`;

/** An entry's debaters, `"Ann Lee, Bo Kim"`, from its speakers or its `"Lee & Kim"` name. */
export function entryDebaters(entry: TabroomEntry): string {
  const speakers = Object.values(entry.Speakers ?? {})
    .map((s) => [s.first, s.last].filter(Boolean).join(" ").trim())
    .filter(Boolean);
  if (speakers.length > 0) return speakers.join(", ");
  return (entry.name ?? "").replace(/\s*(?:&|\band\b|\/)\s*/gi, ", ").trim();
}

/**
 * Whether the form's team is this Tabroom entry: its code ("Harker AB"), its
 * debaters' last names, or its school plus its debaters' initials (which is
 * how video titles write a team when the tournament used numeric codes).
 */
export function entryMatches(formTeam: string, entry: TabroomEntry): boolean {
  const debaters = entryDebaters(entry);
  if (teamMatches(formTeam, entry.code ?? null, debaters)) return true;
  const school = normalize(entry.schoolName ?? "");
  if (!school) return false;
  if (teamMatches(formTeam, `${entry.schoolName}`, debaters)) return true;
  const form = normalize(formTeam.replace(/#\s*\d+/g, " ")).split(" ");
  if (form.length < 2) return false;
  const code = form.pop()!;
  const initials = debaterLastNames(debaters).map((name) => name[0]).join("");
  const sorted = (s: string) => [...s].sort().join("");
  if (initials.length < 1 || code.length !== initials.length || sorted(code) !== sorted(initials)) return false;
  return sameSchoolName(form.join(" "), school);
}

/** `"harker"` ≈ `"the harker school"`: the form's school words all in Tabroom's school name. */
function sameSchoolName(form: string, school: string): boolean {
  const core = school.replace(/^the /, "").replace(/ (high school|school|schools|hs|academy)$/, "");
  if (sameSchool(form, core)) return true;
  const have = new Set(school.split(" "));
  return form.split(" ").every((word) => have.has(word));
}

/** What one section's ballots say. */
export interface SectionDecision {
  side: "aff" | "neg" | null;
  /** `"2-1"`, winner's ballots first; `"1-0"` for one judge. */
  ballots: string | null;
  /** Every judge, the ones who voted for the loser starred: `"Ann Lee, Bo Kim*"`. */
  judges: string | null;
}

/**
 * The winner from the judges' W/L ballots. Only a complete, unanimous-or-
 * majority set of ballots counts: a bye, forfeit, missing ballot or split
 * panel with no majority leaves the winner unknown.
 */
export function sectionDecision(section: TabroomSection, aff: TabroomEntry, neg: TabroomEntry): SectionDecision {
  const judgeIds = Object.keys(section.Judges ?? {});
  for (const id of [...Object.keys(aff.Ballots ?? {}), ...Object.keys(neg.Ballots ?? {})]) {
    if (!judgeIds.includes(id)) judgeIds.push(id);
  }
  const name = (id: string) => {
    const judge = section.Judges?.[id];
    return [judge?.first, judge?.last].filter(Boolean).join(" ").trim();
  };
  const votes = new Map<string, "aff" | "neg" | null>();
  let explicit = judgeIds.length > 0;
  for (const id of judgeIds) {
    const a = aff.Ballots?.[id]?.winloss ?? null;
    const n = neg.Ballots?.[id]?.winloss ?? null;
    const vote = a === "W" && n !== "W" ? "aff" : n === "W" && a !== "W" ? "neg" : null;
    if (!vote) explicit = false;
    votes.set(id, vote);
  }
  const affVotes = [...votes.values()].filter((v) => v === "aff").length;
  const negVotes = [...votes.values()].filter((v) => v === "neg").length;
  const side = explicit && affVotes !== negVotes ? (affVotes > negVotes ? "aff" : "neg") : null;
  const named = judgeIds.filter((id) => name(id));
  const judges = named.length
    ? named.map((id) => `${name(id)}${side && votes.get(id) && votes.get(id) !== side ? "*" : ""}`).join(", ")
    : null;
  return {
    side,
    ballots: side ? `${Math.max(affVotes, negVotes)}-${Math.min(affVotes, negVotes)}` : null,
    judges,
  };
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

/** Tournaments starting between two dates, across the listing's pages. */
async function tournsBetween(fetcher: FetchLike, after: string, before: string): Promise<TabroomTourn[]> {
  const all: TabroomTourn[] = [];
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      startAfter: `${after}T00:00:00.000Z`,
      startBefore: `${before}T00:00:00.000Z`,
      limit: "500",
      offset: String(page * 500),
      fields: "id,name,start,state",
    });
    const batch = await getJson<TabroomTourn[]>(fetcher, `/rest/tourns?${params}`);
    all.push(...batch);
    if (batch.length < 500) break;
  }
  return all;
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Looks the round up on Tabroom. Never throws for "not found"; network and auth failures do throw. */
export async function lookupHsResult(query: HsResultsQuery, fetcher: FetchLike = fetch): Promise<CollegeResultsLookup> {
  if (!STYLE_EVENTS[String(query.style)]) {
    return empty("not_found", "Tabroom lookups cover high school Policy, PF and LD rounds.");
  }
  if (!query.tournament.trim() || !query.affTeam.trim() || !query.negTeam.trim()) {
    return empty("not_found", "Fill in the tournament and both teams first.");
  }
  const season = seasonFor(query.seasonYear, query.publishedAt);
  if (!season) return empty("not_found", "Set the published date so the season is known.");
  const startYear = Number(season.slice(0, 4));
  const seasonStart = `${startYear}-08-01`;
  const seasonEnd = `${startYear + 1}-08-01`;

  // The weeks before the video was posted first (one request), then the season.
  let candidates: TabroomTourn[] = [];
  const posted = query.publishedAt ? Date.parse(query.publishedAt) : NaN;
  if (Number.isFinite(posted)) {
    const from = Math.max(posted - 75 * 86_400_000, Date.parse(seasonStart));
    const to = Math.min(posted + 2 * 86_400_000, Date.parse(seasonEnd));
    if (from < to) candidates = pickHsTournament(query.tournament, await tournsBetween(fetcher, isoDay(from), isoDay(to)), query.publishedAt);
  }
  if (candidates.length !== 1) {
    candidates = pickHsTournament(query.tournament, await tournsBetween(fetcher, seasonStart, seasonEnd), query.publishedAt);
  }
  if (candidates.length === 0) {
    return empty("not_found", `No ${season} tournament on Tabroom matches "${query.tournament}".`);
  }
  if (candidates.length > 1) {
    return {
      ...empty("ambiguous", `"${query.tournament}" matches ${candidates.length} Tabroom tournaments in ${season} — refusing to guess. Use the full tournament name.`),
      candidates: candidates.slice(0, 12).map((t) => ({ id: t.id, name: t.name, startDate: t.start?.slice(0, 10) ?? null })),
    };
  }
  const tourn = candidates[0];
  const tournamentInfo = {
    id: tourn.id,
    name: tourn.name,
    season,
    startDate: tourn.start?.slice(0, 10) ?? null,
    url: `${TABROOM_SITE}/index/tourn/index.mhtml?tourn_id=${tourn.id}`,
  };

  const invite = await getJson<{ Events?: TabroomEvent[] }>(fetcher, `/rest/tourns/${tourn.id}/invite`);
  const events = pickEvents(query.style, invite.Events ?? []);
  if (events.length === 0) {
    return { ...empty("not_found", `${tourn.name} (${season}) has no ${styleName(query.style)} event on Tabroom.`), tournament: tournamentInfo };
  }

  const rounds = await getJson<TabroomRound[]>(fetcher, `/rest/tourns/${tourn.id}/rounds`);
  const wantedRound = roundKey(query.roundLevel);
  const searched: { event: TabroomEvent; round: TabroomRound }[] = [];
  for (const event of events) {
    const ofEvent = rounds.filter((r) => r.Event?.abbr === event.abbr);
    const keys = eventRoundKeys(ofEvent);
    // A recognised round level narrows the search; an unknown one searches every round.
    for (const round of ofEvent) if (!wantedRound || keys.get(round.id) === wantedRound) searched.push({ event, round });
  }
  if (searched.length === 0) {
    return {
      ...empty("not_found", `${tourn.name} (${season}) has no published ${query.roundLevel || ""} ${styleName(query.style)} round on Tabroom.`.replace(/\s+/g, " ")),
      tournament: tournamentInfo,
    };
  }

  const found: { event: TabroomEvent; round: TabroomRound; results: TabroomRoundResults; section: TabroomSection; aff: TabroomEntry; neg: TabroomEntry; swapped: boolean }[] = [];
  const pages = await Promise.all(
    searched.map(async ({ event, round }) => ({
      event,
      round,
      results: await getJson<TabroomRoundResults>(
        fetcher,
        `/pages/invite/${tourn.id}/${encodeURIComponent(event.abbr)}/${round.name}/results`,
      ).catch((error) => {
        // A round whose results aren't public yet is just empty.
        if (error instanceof TabroomNotFound) return null;
        throw error;
      }),
    })),
  );
  for (const { event, round, results } of pages) {
    if (!results) continue;
    const affLabel = normalize(results.Event?.Settings?.affLabel || "Aff");
    const negLabel = normalize(results.Event?.Settings?.negLabel || "Neg");
    for (const section of Object.values(results.Sections ?? {})) {
      if (section.bye) continue;
      const entries = Object.values(section.Entries ?? {});
      const aff = entries.find((e) => normalize(String(e.side ?? "")) === affLabel || String(e.side) === "1");
      const neg = entries.find((e) => normalize(String(e.side ?? "")) === negLabel || String(e.side) === "2");
      if (!aff || !neg) continue;
      if (entryMatches(query.affTeam, aff) && entryMatches(query.negTeam, neg)) {
        found.push({ event, round, results, section, aff, neg, swapped: false });
      } else if (entryMatches(query.affTeam, neg) && entryMatches(query.negTeam, aff)) {
        found.push({ event, round, results, section, aff, neg, swapped: true });
      }
    }
  }

  if (found.length === 0) {
    const where = wantedRound ? [...new Set(searched.map((s) => roundTitle(s.round)))].join(", ") : "any round";
    return {
      ...empty("not_found", `No debate between ${query.affTeam} and ${query.negTeam} in ${where} at ${tourn.name} (${season}).`),
      tournament: tournamentInfo,
    };
  }
  if (found.length > 1) {
    return {
      ...empty(
        "ambiguous",
        `${query.affTeam} and ${query.negTeam} met ${found.length} times (${found.map((f) => roundTitle(f.round)).join(", ")}) — set the round level to pick one.`,
      ),
      tournament: tournamentInfo,
    };
  }

  const { event, round, section, aff, neg, swapped } = found[0];
  const decision = sectionDecision(section, aff, neg);
  const affTeam = aff.code?.trim() || aff.name || "";
  const negTeam = neg.code?.trim() || neg.name || "";
  const winnerTeam = decision.side === "aff" ? affTeam : decision.side === "neg" ? negTeam : null;
  const title = events.length > 1 ? `${event.abbr} ${roundTitle(round)}` : roundTitle(round);
  return {
    status: decision.side ? "verified" : "winner_not_explicit",
    message: decision.side
      ? `${title}: ${winnerTeam} won on the ${decision.side.toUpperCase()} ${decision.ballots}.`
      : `${title}: found the debate, but Tabroom shows no complete decision.`,
    tournament: {
      ...tournamentInfo,
      url: `${TABROOM_SITE}/index/tourn/results/round_results.mhtml?tourn_id=${tourn.id}&round_id=${round.id}`,
    },
    round: roundTitle(round),
    match: {
      affTeam,
      affDebaters: entryDebaters(aff),
      negTeam,
      negDebaters: entryDebaters(neg),
      judges: decision.judges,
      decision: decision.side ? `${decision.side.toUpperCase()} ${decision.ballots}` : null,
    },
    sidesSwapped: swapped,
    winnerSide: decision.side,
    winnerTeam,
    ballots: decision.ballots,
    candidates: [],
  };
}

function styleName(style: number | string): string {
  return String(style) === "1" ? "Policy" : String(style) === "2" ? "Public Forum" : "Lincoln-Douglas";
}
