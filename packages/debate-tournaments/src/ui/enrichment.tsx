"use client";

/**
 * What the host app adds to pairings and results beyond Tabroom's own data:
 * each entry's current-season ranking (school logo, debaters' last names,
 * rating) and each judge's Tabroom paradigm. Both lookups are supplied by the
 * host through `<TournamentsApp lookupTeamRating lookupJudgeParadigm>`, since
 * the rankings and the paradigm search live outside this package; without
 * them, and for any entry or judge they can't match with confidence, rows
 * render exactly as Tabroom sends them.
 */

import { useCallback, useEffect, useState } from "react";
import { FramedOverlay } from "./FramedOverlay";
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
}

/** A matched entry's row in the current season's rankings. */
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
  const key = lookup && query.code ? JSON.stringify([query.code, query.name ?? "", query.school ?? "", query.event.name ?? "", query.event.abbr ?? "", query.event.type ?? ""]) : null;
  return useLookup(key, lookup ? () => lookup(query) : null);
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
        } ${SIDE_BORDER[side ?? "aff"]}`}
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

/**
 * A judge's name. When their paradigm is known the name is a link to it;
 * clicking opens the paradigm in an overlay over the pairings, with Tabroom's
 * page a click away in a new tab.
 */
export function JudgeName({ judge }: { judge: PairingJudge }) {
  const personId = useJudgeParadigm(judge);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const name = [judge.first, judge.last].filter(Boolean).join(" ");
  if (!personId) return <>{name}</>;
  const url = tabroomParadigmUrl(personId);
  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={`${name}'s paradigm`}
        className="underline decoration-dotted underline-offset-2 hover:text-primary"
        onClick={(event) => {
          // Modified clicks keep their usual meaning (a new tab or window).
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {name}
      </a>
      <FramedOverlay
        open={open}
        onClose={close}
        url={url}
        title={`${name} — paradigm`}
        description="Their judging paradigm on Tabroom."
      />
    </>
  );
}
