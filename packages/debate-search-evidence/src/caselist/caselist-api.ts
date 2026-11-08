/**
 * @fileoverview Scraper for openCaselist team pages, over the same JSON API the
 * openCaselist React client calls (`api.opencaselist.com/v1`, source in
 * github.com/debate/debate-shared-research under `server/v1`).
 *
 * The caselist is a tree — caselist → school → team → rounds + cites — and a
 * team page is two lists:
 *
 * - **rounds**: one row per round a team disclosed, with the open-source
 *   speech document (`opensource`, a path such as
 *   `hspf25/Harker/LiLe/hspf25-Harker-LiLe-Pro-Blake-Round1.docx`) and an
 *   optional round report;
 * - **cites**: the "wiki" arguments — a title (`1AC - Space Col`) plus
 *   markdown cite text — each tied to the round it was read in.
 *
 * Every endpoint needs a `caselist_token` session cookie, which openCaselist
 * hands out from `POST /v1/login` after checking a Tabroom username and
 * password. The client takes either the token or the credentials. Bulk
 * archives (see `caselist-sync.ts`) are the anonymous route to the files;
 * this module is the route to the cites, which no archive carries.
 *
 * The server rate limits downloads to 10 a minute per user, so
 * {@link scrapeTeam} only fetches the files when asked and spaces them out.
 *
 * Works under Node, Bun and Workers: it only needs `fetch`.
 *
 * @module caselist/caselist-api
 */

import type { CaselistEvent, CaselistLevel } from "./caselist-config";

/** openCaselist's API root. */
export const CASELIST_API_ORIGIN = "https://api.opencaselist.com/v1";

/** The cookie openCaselist authenticates every request with. */
export const CASELIST_TOKEN_COOKIE = "caselist_token";

/** One caselist, as `GET /caselists` returns it. */
export interface CaselistInfo {
  caselist_id: number;
  /** URL slug, e.g. `hspf25`. */
  name: string;
  display_name: string;
  year: number;
  event: string | null;
  level: string | null;
  team_size: number | null;
  archived: boolean;
}

/** One school in a caselist. `name` is the display name with spaces removed. */
export interface CaselistSchool {
  school_id: number;
  caselist_id: number;
  name: string;
  display_name: string | null;
  state: string | null;
}

/** One team page. `name` is the team code (`LiLe`), unique per school. */
export interface CaselistTeam {
  team_id: number;
  school_id: number;
  name: string;
  display_name: string;
  notes?: string | null;
  debater1_first?: string | null;
  debater1_last?: string | null;
  debater2_first?: string | null;
  debater2_last?: string | null;
  debater3_first?: string | null;
  debater3_last?: string | null;
  debater4_first?: string | null;
  debater4_last?: string | null;
}

/** One disclosed round on a team page. */
export interface CaselistRound {
  round_id: number;
  team_id: number;
  /** `A` or `N` (Pro/Con in PF). */
  side: string;
  tournament: string;
  /** `1`–`9` for prelims, `10`+ or a name for elims. */
  round: string;
  opponent: string | null;
  judge: string | null;
  report: string | null;
  /** Upload path of the open-source document, when one was disclosed. */
  opensource: string | null;
  video: string | null;
  created_at?: string;
  updated_at?: string;
}

/** One wiki cite entry: an argument title plus its markdown cites. */
export interface CaselistCite {
  cite_id: number;
  round_id: number;
  title: string | null;
  cites: string | null;
  side?: string | null;
  tournament?: string | null;
  round?: string | null;
  opponent?: string | null;
  judge?: string | null;
  created_at?: string;
}

/** A downloaded open-source file. */
export interface CaselistFile {
  path: string;
  fileName: string;
  bytes: Uint8Array;
}

/** Everything on one team page. */
export interface CaselistTeamPage {
  caselist: string;
  school: CaselistSchool | { name: string; display_name: string | null };
  team: CaselistTeam;
  rounds: CaselistRound[];
  cites: CaselistCite[];
  /** Filled only when {@link ScrapeTeamOptions.downloadFiles} is set. */
  files: CaselistFile[];
  /** Download failures, by path. */
  fileErrors: { path: string; error: string }[];
}

/** A team in the all-teams listing. */
export interface CaselistTeamListing {
  caselist: string;
  school: string;
  schoolDisplayName: string;
  team: string;
  teamDisplayName: string;
  /** Debater last names, in order, blanks dropped. */
  debaters: string[];
}

/** Raised for any non-2xx answer; `status` 401 means the token is missing or expired. */
export class CaselistApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "CaselistApiError";
  }
}

export interface CaselistClientOptions {
  /** A `caselist_token` cookie value from a logged-in session. */
  token?: string | null;
  /** Tabroom login, used to mint a token when none is given. */
  username?: string | null;
  password?: string | null;
  /** API root; defaults to {@link CASELIST_API_ORIGIN}. */
  origin?: string;
  fetch?: typeof fetch;
}

/** A small typed client over the openCaselist read API. */
export interface CaselistClient {
  /** The session token in use, after a login when one was needed. */
  token(): Promise<string>;
  caselists(options?: { archived?: boolean }): Promise<CaselistInfo[]>;
  schools(caselist: string): Promise<CaselistSchool[]>;
  teams(caselist: string, school: string): Promise<CaselistTeam[]>;
  team(caselist: string, school: string, team: string): Promise<CaselistTeam>;
  rounds(caselist: string, school: string, team: string): Promise<CaselistRound[]>;
  cites(caselist: string, school: string, team: string): Promise<CaselistCite[]>;
  /**
   * The bulk archives listed on `opencaselist.com/<caselist>/downloads` — the
   * JSON that page's own client loads (`GET /caselists/<caselist>/downloads`).
   */
  downloads(caselist: string): Promise<unknown>;
  /** Raw download of an open-source path (the `opensource` field of a round). */
  download(path: string): Promise<Response>;
}

const seg = (value: string) => encodeURIComponent(value);

/** Pulls the `caselist_token` value out of a login response's `Set-Cookie`. */
export function tokenFromSetCookie(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|[;,]\\s*)${CASELIST_TOKEN_COOKIE}=([^;,\\s]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Builds a client. Nothing is fetched until the first call. */
export function createCaselistClient(options: CaselistClientOptions = {}): CaselistClient {
  const origin = (options.origin ?? CASELIST_API_ORIGIN).replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? fetch;
  let tokenPromise: Promise<string> | null = options.token ? Promise.resolve(options.token) : null;

  async function login(): Promise<string> {
    if (!options.username || !options.password) {
      throw new CaselistApiError(
        "openCaselist needs a session: set a caselist token or a Tabroom username and password",
        401,
        "/login",
      );
    }
    const response = await fetchImpl(`${origin}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: options.username, password: options.password, remember: true }),
    });
    if (!response.ok) {
      throw new CaselistApiError(`openCaselist login failed (${response.status})`, response.status, "/login");
    }
    const fromCookie = tokenFromSetCookie(response.headers.get("set-cookie"));
    if (fromCookie) return fromCookie;
    const body = (await response.json().catch(() => null)) as { token?: string } | null;
    if (body?.token) return body.token;
    throw new CaselistApiError("openCaselist login returned no session token", 500, "/login");
  }

  function token(): Promise<string> {
    tokenPromise ??= login().catch((error) => {
      tokenPromise = null;
      throw error;
    });
    return tokenPromise;
  }

  async function request(path: string): Promise<Response> {
    const response = await fetchImpl(`${origin}${path}`, {
      headers: { Cookie: `${CASELIST_TOKEN_COOKIE}=${await token()}`, Accept: "application/json" },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new CaselistApiError(body?.message ?? `openCaselist ${path} answered ${response.status}`, response.status, path);
    }
    return response;
  }

  const json = async <T>(path: string): Promise<T> => (await request(path)).json() as Promise<T>;
  const teamPath = (caselist: string, school: string, team: string) =>
    `/caselists/${seg(caselist)}/schools/${seg(school)}/teams/${seg(team)}`;

  return {
    token,
    caselists: ({ archived = false } = {}) => json(`/caselists${archived ? "?archived=true" : ""}`),
    schools: (caselist) => json(`/caselists/${seg(caselist)}/schools`),
    teams: (caselist, school) => json(`/caselists/${seg(caselist)}/schools/${seg(school)}/teams`),
    team: (caselist, school, team) => json(teamPath(caselist, school, team)),
    rounds: (caselist, school, team) => json(`${teamPath(caselist, school, team)}/rounds`),
    cites: (caselist, school, team) => json(`${teamPath(caselist, school, team)}/cites`),
    downloads: (caselist) => json(`/caselists/${seg(caselist)}/downloads`),
    download: (path) => request(`/download?path=${seg(path)}`),
  };
}

/** The caselist file name of an open-source path. */
export function openSourceFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Debater last names on a team, in order, blanks and archive masks dropped. */
export function teamDebaters(team: CaselistTeam): string[] {
  return [team.debater1_last, team.debater2_last, team.debater3_last, team.debater4_last]
    .map((name) => name?.trim() ?? "")
    .filter((name) => name && !name.endsWith("....."));
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ScrapeTeamOptions {
  /** Also download every open-source document (rate limited by the server). */
  downloadFiles?: boolean;
  /** Pause between downloads; openCaselist allows 10 a minute. Default 6.5 s. */
  downloadDelayMs?: number;
  /** Called after each file, for progress output. */
  onFile?: (path: string, index: number, total: number) => void;
}

/**
 * Scrapes one team page: the team, its rounds (with open-source paths and
 * reports) and its wiki cites, plus the open-source files when asked.
 */
export async function scrapeTeam(
  client: CaselistClient,
  caselist: string,
  school: string,
  team: string,
  options: ScrapeTeamOptions = {},
): Promise<CaselistTeamPage> {
  const [teamInfo, rounds, cites] = await Promise.all([
    client.team(caselist, school, team),
    client.rounds(caselist, school, team),
    client.cites(caselist, school, team),
  ]);
  const page: CaselistTeamPage = {
    caselist,
    school: { name: school, display_name: null },
    team: teamInfo,
    rounds,
    cites,
    files: [],
    fileErrors: [],
  };
  if (!options.downloadFiles) return page;

  const paths = [...new Set(rounds.map((round) => round.opensource).filter((path): path is string => Boolean(path)))];
  const delay = options.downloadDelayMs ?? 6500;
  for (const [index, path] of paths.entries()) {
    if (index > 0 && delay > 0) await pause(delay);
    try {
      const response = await client.download(path);
      page.files.push({ path, fileName: openSourceFileName(path), bytes: new Uint8Array(await response.arrayBuffer()) });
    } catch (error) {
      page.fileErrors.push({ path, error: error instanceof Error ? error.message : String(error) });
    }
    options.onFile?.(path, index + 1, paths.length);
  }
  return page;
}

/** Runs `task` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Lists every team page in a caselist (one `teams` call per school).
 * Schools whose team list fails are skipped rather than failing the listing.
 */
export async function listCaselistTeams(
  client: CaselistClient,
  caselist: string,
  options: { concurrency?: number } = {},
): Promise<CaselistTeamListing[]> {
  const schools = await client.schools(caselist);
  const perSchool = await mapLimit(schools, options.concurrency ?? 4, async (school) => {
    const teams = await client.teams(caselist, school.name).catch(() => [] as CaselistTeam[]);
    return teams.map(
      (team): CaselistTeamListing => ({
        caselist,
        school: school.name,
        schoolDisplayName: school.display_name ?? school.name,
        team: team.name,
        teamDisplayName: team.display_name,
        debaters: teamDebaters(team),
      }),
    );
  });
  return perSchool.flat();
}

/**
 * The open caselists for one format, newest season first. `policy` at
 * college level is NDT/CEDA; at high school it is HS Policy.
 */
export function caselistsForFormat(
  caselists: CaselistInfo[],
  event: CaselistEvent,
  level?: CaselistLevel,
): CaselistInfo[] {
  const wanted = event === "policy" ? ["cx", "policy"] : [event];
  return caselists
    .filter((caselist) => wanted.includes((caselist.event ?? "").toLowerCase()))
    .filter((caselist) => !level || (caselist.level ?? "").toLowerCase() === level)
    .sort((a, b) => b.year - a.year);
}

// ── Matching a ranked team to its caselist page ─────────────────────────────

const fold = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** The caselist school `name` openCaselist derives from a display name. */
export function caselistSchoolName(displayName: string): string {
  return displayName.trim().replaceAll(" ", "");
}

/**
 * Debater last names from a rankings team name — `Lin & Lee`, `Lin-Lee`,
 * `Jane Smith` (one LD debater; the last word is the surname).
 */
export function rankedTeamLastNames(name: string): string[] {
  const parts = name
    .split(/\s*(?:&|\band\b|\/|,|\s-\s|–)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) return parts.map((part) => part.split(/\s+/).pop() ?? part);
  const words = name.trim().split(/\s+/);
  if (words.length > 1) return [words[words.length - 1]];
  return name.includes("-") ? name.split("-").map((part) => part.trim()) : [name.trim()];
}

/** Ranks a school against a wanted display name; 0 means no match. */
export function schoolMatchScore(school: Pick<CaselistSchool, "name" | "display_name">, wanted: string): number {
  const target = fold(wanted);
  if (!target) return 0;
  const names = [school.name, school.display_name ?? ""].map(fold).filter(Boolean);
  if (names.includes(target)) return 3;
  // "Harker" vs "The Harker School", "Michigan" vs "University of Michigan".
  const stripped = (value: string) => value.replace(/^(the|universityof)/, "").replace(/(highschool|school|hs|university|college)$/, "");
  if (names.some((name) => stripped(name) === stripped(target))) return 2;
  if (target.length >= 5 && names.some((name) => name.startsWith(target) || target.startsWith(name))) return 1;
  return 0;
}

/** Picks the best caselist school for a ranked school name, or null. */
export function matchCaselistSchool<T extends Pick<CaselistSchool, "name" | "display_name">>(
  schools: T[],
  wanted: string,
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const school of schools) {
    const score = schoolMatchScore(school, wanted);
    if (score > bestScore) {
      best = school;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Picks the team page for a set of debater last names: an exact surname
 * match wins, then the team code openCaselist builds (`LiLe` for Lin & Lee,
 * first two letters of each surname).
 */
export function matchCaselistTeam<T extends CaselistTeam>(teams: T[], lastNames: string[]): T | null {
  const wanted = lastNames.map(fold).filter(Boolean);
  if (wanted.length === 0) return null;
  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

  const bySurname = teams.find((team) => sameSet(teamDebaters(team).map(fold), wanted));
  if (bySurname) return bySurname;
  const overlapping = teams.find((team) => {
    const debaters = teamDebaters(team).map(fold);
    return debaters.length > 0 && wanted.every((name) => debaters.includes(name));
  });
  if (overlapping) return overlapping;

  const codes = new Set([
    wanted.map((name) => name.slice(0, 2)).join(""),
    [...wanted].reverse().map((name) => name.slice(0, 2)).join(""),
  ]);
  return teams.find((team) => codes.has(fold(team.name).replace(/\d+$/, ""))) ?? null;
}

// ── Display helpers shared by the CLI and the team page ─────────────────────

const ELIM_ROUNDS: Record<string, string> = {
  "10": "Triples",
  "11": "Doubles",
  "12": "Octas",
  "13": "Quarters",
  "14": "Semis",
  "15": "Final",
};

/** `1` → `R1`, `13` → `Quarters`; anything else is shown as stored. */
export function caselistRoundLabel(round: string | null | undefined): string {
  const value = (round ?? "").trim();
  if (/^[1-9]$/.test(value)) return `R${value}`;
  return ELIM_ROUNDS[value] ?? value;
}

/** `A`/`N` as Aff/Neg, or Pro/Con for PF. */
export function caselistSideLabel(side: string | null | undefined, event?: string | null): string {
  const value = (side ?? "").toUpperCase();
  const pf = (event ?? "").toLowerCase() === "pf";
  if (value === "A") return pf ? "Pro" : "Aff";
  if (value === "N") return pf ? "Con" : "Neg";
  return side ?? "";
}
