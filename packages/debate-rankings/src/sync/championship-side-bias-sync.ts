/**
 * @fileoverview Reads a championship's published ballots from Tabroom's JSON
 * API and turns them into the side-bias counts `side-bias.ts` serves.
 *
 * - `GET /rest/tourns/:id/invite` — the tournament's events (public);
 * - `GET /rest/tourns/:id/rounds` — its published rounds (signed in);
 * - `GET /pages/invite/:id/:event/:round/results` — one round's sections with
 *   each entry's side and each judge's W/L ballot (signed in).
 *
 * The last two answer 401 to a signed-out request, so a run without
 * `TABROOM_API_KEY` stops with {@link TabroomAuthRequiredError} rather than
 * storing an empty season as if the ballots were unavailable.
 *
 * A round counts only when every judge's ballot is an explicit win for one
 * side and the panel has a majority; byes, forfeits, missing ballots and ties
 * are skipped, the same rule the video results lookup uses.
 * @module sync/championship-side-bias-sync
 */

import {
  championshipTournament,
  countRounds,
  type ChampionshipRound,
  type SideBiasDataset,
  type SideBiasFormat,
  type SideBiasRecord,
} from "../side-bias";

export const TABROOM_API = "https://api.tabroom.com/v1";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Thrown when Tabroom refuses a read that needs a signed-in session. */
export class TabroomAuthRequiredError extends Error {
  constructor(path: string, readonly status: number) {
    super(`Tabroom answered ${status} for ${path}: round ballots need a signed-in session — set TABROOM_API_KEY.`);
    this.name = "TabroomAuthRequiredError";
  }
}

export interface TabroomEventInfo {
  id: number;
  name: string;
  abbr: string;
  type: string;
}

export interface TabroomRoundInfo {
  id: number;
  type: string | null;
  name: number;
  label?: string | null;
  Event?: { id?: number; abbr?: string | null } | null;
}

interface ResultEntry {
  side?: number | string | null;
  Ballots?: Record<string, { winloss?: string | null }>;
}

interface ResultSection {
  bye?: number | boolean | null;
  Judges?: Record<string, unknown>;
  Entries?: Record<string, ResultEntry>;
}

/** `GET /pages/invite/:tourn/:event/:round/results`. */
export interface TabroomRoundResultsPage {
  Sections?: Record<string, ResultSection>;
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const EVENT_PATTERNS: Record<SideBiasFormat, RegExp> = {
  pf: /\b(public forum|pf|pfd)\b/,
  ld: /\b(lincoln douglas|lincoln|ld)\b/,
  policy: /\b(policy|cx)\b/,
  college: /.*/,
};

/** The Gold/Open division's second-tier siblings, which never decide a championship. */
const LOWER_DIVISION = /\b(silver|bronze|novice|jv|junior varsity|middle school|spf|s)\b/;

/**
 * The tournament's top-division debate events of a format. College picks every
 * debate event (the NDT runs one); the high school TOC picks the Gold/Open
 * event and skips Silver PF.
 */
export function pickChampionshipEvents(format: SideBiasFormat, events: readonly TabroomEventInfo[]): TabroomEventInfo[] {
  const debate = events.filter((e) => e.type === "debate");
  if (format === "college") return debate;
  const matching = debate.filter((e) => EVENT_PATTERNS[format].test(norm(`${e.name} ${e.abbr}`)));
  const top = matching.filter((e) => !LOWER_DIVISION.test(norm(`${e.name} ${e.abbr}`)));
  return top.length > 0 ? top : matching;
}

/** Whether a Tabroom round is an elimination round. */
export function isElimRound(round: Pick<TabroomRoundInfo, "type">): boolean {
  return round.type === "elim" || round.type === "final";
}

const sideOf = (entry: ResultEntry): "aff" | "neg" | null => {
  const side = Number(entry.side);
  return side === 1 ? "aff" : side === 2 ? "neg" : null;
};

/**
 * The decided rounds on one results page: two entries on opposite sides, a
 * complete set of explicit W/L ballots, and a majority for one side.
 */
export function parseRoundResults(page: TabroomRoundResultsPage, elim: boolean): ChampionshipRound[] {
  const rounds: ChampionshipRound[] = [];
  for (const section of Object.values(page.Sections ?? {})) {
    if (section.bye) continue;
    const entries = Object.values(section.Entries ?? {});
    if (entries.length !== 2) continue;
    const aff = entries.find((e) => sideOf(e) === "aff");
    const neg = entries.find((e) => sideOf(e) === "neg");
    if (!aff || !neg) continue;

    const judgeIds = new Set([
      ...Object.keys(section.Judges ?? {}),
      ...Object.keys(aff.Ballots ?? {}),
      ...Object.keys(neg.Ballots ?? {}),
    ]);
    if (judgeIds.size === 0) continue;
    let affVotes = 0;
    let negVotes = 0;
    let complete = true;
    for (const id of judgeIds) {
      const a = aff.Ballots?.[id]?.winloss ?? null;
      const n = neg.Ballots?.[id]?.winloss ?? null;
      if (a === "W" && n !== "W") affVotes++;
      else if (n === "W" && a !== "W") negVotes++;
      else complete = false;
    }
    if (!complete || affVotes === negVotes) continue;
    rounds.push({ winner: affVotes > negVotes ? "aff" : "neg", elim });
  }
  return rounds;
}

async function getJson<T>(fetcher: FetchLike, path: string): Promise<T | null> {
  const res = await fetcher(`${TABROOM_API}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 || res.status === 403) throw new TabroomAuthRequiredError(path, res.status);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Tabroom returned ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/** Every decided round of a format's events at one tournament. */
export async function collectChampionshipRounds(
  fetcher: FetchLike,
  tabroomId: number,
  format: SideBiasFormat,
): Promise<ChampionshipRound[]> {
  const invite = await getJson<{ Events?: TabroomEventInfo[] }>(fetcher, `/rest/tourns/${tabroomId}/invite`);
  const events = pickChampionshipEvents(format, invite?.Events ?? []);
  if (events.length === 0) return [];
  const rounds = (await getJson<TabroomRoundInfo[]>(fetcher, `/rest/tourns/${tabroomId}/rounds`)) ?? [];

  const collected: ChampionshipRound[] = [];
  for (const event of events) {
    const eventRounds = rounds.filter((r) => r.Event?.id === event.id || r.Event?.abbr === event.abbr);
    for (const round of eventRounds) {
      const page = await getJson<TabroomRoundResultsPage>(
        fetcher,
        `/pages/invite/${tabroomId}/${encodeURIComponent(event.abbr)}/${round.name}/results`,
      );
      if (page) collected.push(...parseRoundResults(page, isElimRound(round)));
    }
  }
  return collected;
}

export interface SyncOptions {
  fetcher: FetchLike;
  formats: readonly SideBiasFormat[];
  years: readonly number[];
  existing?: SideBiasDataset;
  now?: () => Date;
  onProgress?: (message: string) => void;
}

/**
 * Collects the championship counts for each format and season and merges them
 * into `existing`. A format-season that yields no decided rounds keeps its
 * stored row (if any); one that fails with anything but an auth error is
 * reported and skipped.
 */
export async function syncChampionshipSideBias(options: SyncOptions): Promise<SideBiasDataset> {
  const { fetcher, formats, years, existing, onProgress } = options;
  const byKey = new Map<string, SideBiasRecord>();
  for (const record of existing?.records ?? []) byKey.set(`${record.format}|${record.year}`, record);

  for (const format of formats) {
    for (const year of years) {
      const tournament = championshipTournament(format, year);
      if (!tournament) {
        onProgress?.(`${format} ${year}: no championship registered`);
        continue;
      }
      try {
        const rounds = await collectChampionshipRounds(fetcher, tournament.tabroomId, format);
        if (rounds.length === 0) {
          onProgress?.(`${format} ${year}: no decided rounds (tourn ${tournament.tabroomId})`);
          continue;
        }
        byKey.set(`${format}|${year}`, { format, year, tabroomId: tournament.tabroomId, ...countRounds(rounds) });
        onProgress?.(`${format} ${year}: ${rounds.length} rounds`);
      } catch (error) {
        if (error instanceof TabroomAuthRequiredError) throw error;
        onProgress?.(`${format} ${year}: failed — ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const order = (r: SideBiasRecord) => `${r.format}|${String(r.year).padStart(4, "0")}`;
  return {
    generatedAt: (options.now?.() ?? new Date()).toISOString(),
    records: [...byKey.values()].sort((a, b) => order(a).localeCompare(order(b))),
  };
}
