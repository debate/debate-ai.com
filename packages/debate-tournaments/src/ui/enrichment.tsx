"use client";

/**
 * What the host app adds to pairings and results beyond Tabroom's own data:
 * each entry's ranking (school logo, debaters' last names, rating) and each
 * judge's Tabroom paradigm. Each lookup carries the season the tournament
 * ran in ({@link TournamentSeasonContext}), so a past tournament's entries
 * are matched to that season's ratings where the host has them, never to
 * the current season's. Both lookups are supplied by the
 * host through `<TournamentsApp lookupTeamRating lookupJudgeParadigm>`, since
 * the rankings and the paradigm search live outside this package; without
 * them, and for any entry or judge they can't match with confidence, rows
 * render exactly as Tabroom sends them.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { JudgeProfile } from "../paradigms";
import type { TournamentSource } from "./client";
import { FramedOverlay } from "./FramedOverlay";
import { JudgeProfileView } from "./JudgeProfileView";
import { useOptionalTournaments } from "./shared";

/** The event an entry competes in, which decides the rankings it's looked up in. */
export interface EventFormatHint {
  name?: string | null;
  abbr?: string | null;
  type?: string | null;
}

/** One entry to look up: its code and, where known, its debaters and school. */
export interface TeamRatingQuery {
  code: string | null;
  /** The debaters as the tournament writes them, e.g. `"Le & Luo"`. */
  name?: string | null;
  school?: string | null;
  event: EventFormatHint;
  /**
   * Season year the tournament ran in (the year the season ends in: `2020`
   * for 2019-20), from {@link TournamentSeasonContext}; `null` when unknown.
   */
  season?: number | null;
}

/**
 * Season year of a tournament starting on `start` (`"2019-11-02 08:00:00"`):
 * seasons run July to June, so this is `2020`. `null` when `start` isn't a
 * date. Only the year and month are read, so no time zone can move it.
 */
export function tournamentSeasonYear(start: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})/.exec((start ?? "").trim());
  if (!match) return null;
  return Number(match[2]) >= 7 ? Number(match[1]) + 1 : Number(match[1]);
}

/** The season of the tournament being shown, which every ranking lookup on its pages is for. */
export const TournamentSeasonContext = createContext<number | null>(null);

/** A matched entry's row in its season's rankings. */
export interface TeamRating {
  /** Debaters' last names, e.g. `"Le & Luo"` (or `"Daswani"` in LD). */
  names: string;
  /** Rating on the site's scale. */
  rating: number;
  rank: number;
  /** The school as the rankings spell it. */
  school: string;
  /** Which rankings it came from, e.g. `"HS Public Forum"`. */
  rankingLabel: string;
  /** The school's logo, when the site has one. */
  logoSrc?: string | null;
}

/** Resolves an entry to its ranking, or `null` when there is no confident match. */
export type TeamRatingLookup = (query: TeamRatingQuery) => Promise<TeamRating | null>;

/** Resolves a judge's name to their Tabroom person id, or `null` when no single judge matches. */
export type JudgeParadigmLookup = (first: string, last: string) => Promise<number | null>;

/** Tabroom's public paradigm page for a judge. */
export function tabroomParadigmUrl(personId: number): string {
  return `https://www.tabroom.com/index/paradigm.mhtml?judge_person_id=${personId}`;
}

/** Runs `load` once per `key` (none for a `null` key) and returns its result, `null` until it settles or on failure. */
function useLookup<T>(key: string | null, load: (() => Promise<T | null>) | null): T | null {
  const [result, setResult] = useState<{ key: string; value: T | null } | null>(null);
  useEffect(() => {
    if (key === null || !load) return;
    let live = true;
    load().then(
      (value) => live && setResult({ key, value }),
      () => live && setResult({ key, value: null }),
    );
    return () => {
      live = false;
    };
    // `load` is recreated each render; `key` identifies the lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result && result.key === key ? result.value : null;
}

/** An entry's ranking via the host's lookup, or `null`. */
export function useTeamRating(query: TeamRatingQuery): TeamRating | null {
  const lookup = useOptionalTournaments()?.lookupTeamRating;
  const contextSeason = useContext(TournamentSeasonContext);
  const season = query.season ?? contextSeason;
  const key = lookup && query.code ? JSON.stringify([query.code, query.name ?? "", query.school ?? "", query.event.name ?? "", query.event.abbr ?? "", query.event.type ?? "", season]) : null;
  return useLookup(key, lookup ? () => lookup({ ...query, season }) : null);
}

/**
 * Beside an entry's code: its school logo, its debaters' last names and its
 * rating, when the entry matches a ranked team. Nothing otherwise.
 * `names={false}` leaves the names out where the row already prints them.
 */
export function EntryRating({ query, names = true }: { query: TeamRatingQuery; names?: boolean }) {
  const team = useTeamRating(query);
  if (!team) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-1 align-middle text-xs text-muted-foreground"
      title={`#${team.rank} in the ${team.rankingLabel} rankings (${team.school})`}
      data-team-rating=""
    >
      {team.logoSrc ? <img src={team.logoSrc} alt="" aria-hidden width={16} height={16} className="size-4 shrink-0 object-contain" /> : null}
      {names ? <span>{team.names}</span> : null}
      <span className="rounded bg-muted px-1 font-medium tabular-nums text-foreground">{team.rating.toFixed(1)}</span>
    </span>
  );
}

/** The side an entry debated: Tabroom's `side` 1 is the aff, 2 the neg. */
export type EntrySide = "aff" | "neg";

/** Tabroom's numeric side as {@link EntrySide}, or `null` for speaker-order events. */
export const entrySide = (side: number | null | undefined): EntrySide | null =>
  side === 1 ? "aff" : side === 2 ? "neg" : null;

/** Splits a code like `"Harker LL"` into school and initials; `null` without trailing initials. */
function splitEntryCode(code: string | null | undefined): { school: string; initials: string } | null {
  const match = /^(.+?)\s+([A-Z]{1,4})$/.exec((code ?? "").trim().replace(/\s+/g, " "));
  return match ? { school: match[1], initials: match[2] } : null;
}

/** `"Jane Le & Ken Luo"` → `"Le & Luo"`. */
function lastNames(name: string): string {
  return name
    .split(/\s*(?:&|\/| and )\s*/i)
    .filter(Boolean)
    .map((part) => part.trim().split(/\s+/).at(-1) ?? part)
    .join(" & ");
}

/** Border colors by side, matching the site's aff blue and neg red; no side uses the aff blue. */
const SIDE_BORDER: Record<EntrySide, string> = {
  aff: "border-blue-500/80 dark:border-blue-400/80",
  neg: "border-red-500/80 dark:border-red-400/80",
};

/** Mostly white with a faint side tint, so logos read cleanly; matches the site's other aff/neg labels. */
const SIDE_SURFACE: Record<EntrySide, string> = {
  aff: "bg-blue-50/95 text-blue-950 dark:bg-blue-50/85 dark:text-blue-950",
  neg: "bg-red-50/95 text-red-950 dark:bg-red-50/85 dark:text-red-950",
};

/**
 * An entry the way the site names every team: a pill bordered blue (aff) or
 * red (neg) holding the school — its logo when the host has one, else its
 * name — then the debaters' last names, or the code's initials when the
 * names aren't known. With a logo the names sit on a second row under it.
 * A matched entry's rating follows the pill. The code
 * itself stays in the hover text.
 */
export function EntryLabel({ query, side }: { query: TeamRatingQuery; side?: EntrySide | null }) {
  const team = useTeamRating(query);
  const code = query.code?.trim() || null;
  const parsed = splitEntryCode(code);
  const school = team?.school || query.school?.trim() || parsed?.school || (parsed ? null : code);
  const printedName = query.name?.trim() && query.name.trim() !== code ? lastNames(query.name.trim()) : null;
  const debaters = team?.names || printedName || parsed?.initials || null;
  if (!school && !debaters) return <>{code}</>;
  const stacked = Boolean(school && debaters && team?.logoSrc);
  return (
    <>
      <span
        data-entry-label=""
        data-side={side ?? undefined}
        data-stacked={stacked ? "" : undefined}
        title={code ?? undefined}
        className={`inline-flex max-w-full rounded-md border px-1.5 py-0.5 align-middle leading-tight ${
          stacked ? "flex-col items-center gap-0.5 text-center" : "items-center gap-1.5"
        } ${SIDE_BORDER[side ?? "aff"]}${side ? ` ${SIDE_SURFACE[side]}` : ""}`}
      >
        {school ? (
          team?.logoSrc ? (
            <>
              <img src={team.logoSrc} alt="" aria-hidden title={school} height={16} className="h-4 w-auto shrink-0 object-contain" />
              <span className="sr-only">{school}</span>
            </>
          ) : (
            <span className="truncate">{school}</span>
          )
        ) : null}
        {school && debaters ? " " : null}
        {debaters ? <span className="truncate font-medium">{debaters}</span> : null}
      </span>
      {team ? (
        <span
          className="ml-1.5 rounded bg-muted px-1 align-middle text-xs font-medium tabular-nums text-foreground"
          title={`#${team.rank} in the ${team.rankingLabel} rankings (${team.school})`}
          data-team-rating=""
        >
          {team.rating.toFixed(1)}
        </span>
      ) : null}
    </>
  );
}

/** A judge as a round's pairings carry them. */
export interface PairingJudge {
  first: string | null;
  last: string | null;
  /** Tabroom person id of a judge with a paradigm on file. */
  paradigm?: number;
}

/**
 * The judge's Tabroom person id: from the pairing when it carries one,
 * otherwise from the host's lookup by first and last name.
 */
export function useJudgeParadigm(judge: PairingJudge): number | null {
  const lookup = useOptionalTournaments()?.lookupJudgeParadigm;
  const first = judge.first?.trim() ?? "";
  const last = judge.last?.trim() ?? "";
  const key = !judge.paradigm && lookup && first && last ? `${first}\u0000${last}` : null;
  const found = useLookup(key, lookup ? () => lookup(first, last) : null);
  return judge.paradigm ?? found;
}

/** Who to look up when a judge's name is clicked. */
export interface JudgeProfileQuery {
  /** Tabroom person id, when the pairing or the name search found one. */
  personId: number | null;
  first: string;
  last: string;
}

/**
 * Loads a live Tabroom judge's paradigm and voting record, by person id or,
 * without one, by name. `null` when nothing is found.
 */
export type JudgeProfileLookup = (query: JudgeProfileQuery) => Promise<JudgeProfile | null>;

/**
 * Loads the profile the judge dialog shows: a hosted tournament's judge from
 * this site's own Tabroom API, any other judge through the host's lookup.
 * `undefined` while loading, `null` when there is nothing.
 */
function useJudgeProfile(open: boolean, query: JudgeProfileQuery, source: TournamentSource): JudgeProfile | null | undefined {
  const ctx = useOptionalTournaments();
  const hosted = source === "hosted" && query.personId && ctx ? ctx.client : null;
  const lookup = ctx?.lookupJudgeProfile;
  const key = open ? JSON.stringify([source, query.personId, query.first, query.last]) : null;
  const [result, setResult] = useState<{ key: string; value: JudgeProfile | null } | null>(null);
  useEffect(() => {
    if (key === null) return;
    let live = true;
    const load = hosted ? hosted.hostedJudgeProfile(query.personId!) : lookup ? lookup(query) : Promise.resolve(null);
    load.then(
      (value) => live && setResult({ key, value }),
      () => live && setResult({ key, value: null }),
    );
    return () => {
      live = false;
    };
    // `key` identifies the lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result && result.key === key ? result.value : undefined;
}

/**
 * A judge's name. When their paradigm is known — or the host can look judges
 * up — the name opens an overlay with their paradigm and voting record
 * ({@link JudgeProfileView}); without a way to load those, it opens Tabroom's
 * paradigm page in a frame instead. Modified clicks on a judge with a known
 * Tabroom id open that page in a new tab.
 *
 * `source` is where the tournament came from: a hosted tournament's judges
 * with a person id are read from this site's own API, everyone else through
 * the host.
 */
export function JudgeName({ judge, source }: { judge: PairingJudge; source?: TournamentSource }) {
  const ctx = useOptionalTournaments();
  const found = useJudgeParadigm(judge);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const name = [judge.first, judge.last].filter(Boolean).join(" ");
  const first = judge.first?.trim() ?? "";
  const last = judge.last?.trim() ?? "";
  // A hosted tournament's pairing names a person in this site's own
  // database; any other id (live pairings, the name search) is Tabroom's.
  const hostedId = source === "hosted" ? (judge.paradigm ?? null) : null;
  const personId = hostedId ? null : found;
  const canLoad = Boolean(hostedId) || Boolean(ctx?.lookupJudgeProfile && (personId || (first && last)));
  const profile = useJudgeProfile(
    open && canLoad,
    { personId: hostedId ?? personId, first, last },
    hostedId ? "hosted" : "tabroom",
  );
  if (!personId && !canLoad) return <>{name}</>;
  const url = personId ? tabroomParadigmUrl(personId) : null;
  const className = "cursor-pointer underline decoration-dotted underline-offset-2 hover:text-primary";
  const title = `${name}'s paradigm and voting record`;
  return (
    <>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
          className={className}
          data-judge=""
          onClick={(event) => {
            // Modified clicks keep their usual meaning (a new tab or window).
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            setOpen(true);
          }}
        >
          {name}
        </a>
      ) : (
        <button type="button" title={title} className={className} data-judge="" onClick={() => setOpen(true)}>
          {name}
        </button>
      )}
      <FramedOverlay
        open={open}
        onClose={close}
        url={url ?? undefined}
        title={`${name} — paradigm`}
        description={canLoad ? "Their judging paradigm and voting record." : "Their judging paradigm on Tabroom."}
        content={
          canLoad ? (
            <JudgeProfileView name={name} profile={profile} tabroomUrl={url} editHref={ctx?.paradigmEditorHref} />
          ) : undefined
        }
      />
    </>
  );
}
