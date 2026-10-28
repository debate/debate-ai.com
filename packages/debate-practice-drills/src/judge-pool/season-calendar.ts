/**
 * @fileoverview The circuit calendar's major-season weekends — what a judge
 * volunteering for hire picks their availability from.
 *
 * The Debate Majors calendar (`packages/debate-tournaments/src/ui/majors`,
 * rendered inline by the Tournaments page as "CIRCUIT/CAL") lays the 2026–27
 * season out as lettered weeks: A is September 1–6, 2026, B–Y run Monday–Sunday
 * through February 21, 2027, and Z groups the season-ending championships. A
 * judge works weekends, so this module turns those weeks into one row per
 * weekend (keyed by its Saturday) carrying the majors that run over it.
 *
 * The dated majors are copied from that page's `DEBATE_MAJORS` array; the page
 * is a React component that imports that array directly, so unlike the old
 * standalone HTML page it cannot drift.
 * `test/judge-pool/season-calendar.test.ts` fails if the two drift apart.
 *
 * Dates are ISO day strings ("YYYY-MM-DD") throughout and all arithmetic is in
 * UTC, so a weekend key means the same thing in the browser and the Worker.
 *
 * @module debate-practice-rounds/judge-pool/season-calendar
 */

/** One dated major on the circuit calendar. */
export interface SeasonMajor {
  name: string;
  /** Circuit codes as the calendar shows them: LD, PF, CX (HS policy), NDT (college policy). */
  formats: readonly string[];
  /** First day, ISO. */
  start: string;
  /** Last day, ISO. */
  end: string;
}

const major = (name: string, formats: string, start: string, end: string): SeasonMajor => ({
  name,
  formats: formats.split(" "),
  start,
  end,
});

/** Every major on the 2026–27 circuit calendar with published or provisional dates. */
export const SEASON_MAJORS: readonly SeasonMajor[] = [
  major("Owen L. Coon Memorial", "NDT", "2026-09-12", "2026-09-14"),
  major("Greenhill Fall Classic", "LD CX", "2026-09-16", "2026-09-21"),
  major("Run for the Roses", "NDT", "2026-09-23", "2026-09-24"),
  major("Mid-America Cup", "LD", "2026-09-26", "2026-09-29"),
  major("J. W. Patterson Debates", "NDT", "2026-09-26", "2026-09-28"),
  major("Yale Invitational", "PF", "2026-10-02", "2026-10-05"),
  major("Houston College Tournament", "NDT", "2026-10-10", "2026-10-12"),
  major("Heart of Texas", "LD CX", "2026-10-16", "2026-10-18"),
  major("Big Bronx", "PF", "2026-10-16", "2026-10-18"),
  major("Minnesota College Invitational", "NDT", "2026-10-16", "2026-10-18"),
  major("Michigan HS Tournament", "CX", "2026-10-28", "2026-11-01"),
  major("Florida Blue Key", "PF", "2026-10-29", "2026-11-01"),
  major("Harvard College Tournament", "NDT", "2026-10-31", "2026-11-02"),
  major("MinneApple", "LD", "2026-11-07", "2026-11-09"),
  major("Franklin R. Shirley Classic", "NDT", "2026-11-14", "2026-11-16"),
  major("Glenbrooks", "LD PF CX", "2026-11-21", "2026-11-23"),
  major("John Edie Holiday Debates", "CX", "2026-12-18", "2026-12-21"),
  major("Harvard-Westlake", "LD", "2027-01-15", "2027-01-19"),
  major("Barkley Forum", "LD PF CX", "2027-01-22", "2027-01-24"),
  major("Cal Invitational", "PF", "2027-02-13", "2027-02-15"),
  major("Harvard Invitational", "LD PF", "2027-02-13", "2027-02-15"),
  major("NDCA Nationals", "CX", "2027-03-19", "2027-03-21"),
  major("TOC", "LD PF CX", "2027-04-17", "2027-04-19"),
  major("NCFL Grand Nationals", "PF", "2027-05-29", "2027-05-30"),
  major("NSDA Nationals", "LD PF CX", "2027-06-13", "2027-06-18"),
];

/** Saturday of week A (September 1–6, 2026). */
export const SEASON_FIRST_SATURDAY = "2026-09-05";
/** Saturday of week Y, the last lettered week (through February 21, 2027). */
export const SEASON_LAST_LETTERED_SATURDAY = "2027-02-20";
/** The last weekend of the season: the one NSDA Nationals ends on. */
export const SEASON_LAST_SATURDAY = "2027-06-19";

/** One weekend row of the season calendar. */
export interface SeasonWeekend {
  /** The Saturday, ISO — the id stored for a judge's availability. */
  key: string;
  /** The Sunday, ISO. */
  sunday: string;
  /** The calendar's week letter: A–Y, or Z for the championship stretch. */
  week: string;
  /** Whether the weekend falls in Z, the season-ending championships. */
  championships: boolean;
  /** Majors running on the Friday, Saturday or Sunday of this weekend. */
  majors: SeasonMajor[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `iso` moved by `days` (negative goes back). */
export function addDays(iso: string, days: number): string {
  return formatDay(parseDay(iso) + days * DAY_MS);
}

/** Today's ISO day in UTC, or the day of `date`. */
export function isoDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function buildWeekends(): SeasonWeekend[] {
  const weekends: SeasonWeekend[] = [];
  const first = parseDay(SEASON_FIRST_SATURDAY);
  const lastLettered = parseDay(SEASON_LAST_LETTERED_SATURDAY);
  const last = parseDay(SEASON_LAST_SATURDAY);
  for (let ms = first, index = 0; ms <= last; ms += 7 * DAY_MS, index += 1) {
    const key = formatDay(ms);
    const friday = addDays(key, -1);
    const sunday = addDays(key, 1);
    const championships = ms > lastLettered;
    weekends.push({
      key,
      sunday,
      week: championships ? "Z" : String.fromCharCode(65 + index),
      championships,
      majors: SEASON_MAJORS.filter((event) => event.start <= sunday && event.end >= friday),
    });
  }
  return weekends;
}

const WEEKENDS: readonly SeasonWeekend[] = buildWeekends();
const WEEKEND_KEYS = new Set(WEEKENDS.map((weekend) => weekend.key));

/** Every weekend of the season, first to last. */
export function seasonWeekends(): readonly SeasonWeekend[] {
  return WEEKENDS;
}

/** Whether `key` is the Saturday of a season weekend. */
export function isSeasonWeekend(key: unknown): key is string {
  return typeof key === "string" && WEEKEND_KEYS.has(key);
}

/** The season weekend keyed by `key`, if there is one. */
export function findSeasonWeekend(key: string): SeasonWeekend | undefined {
  return WEEKENDS.find((weekend) => weekend.key === key);
}

/** Whether a weekend is still ahead on `today` — its Sunday has not passed. */
export function isUpcomingWeekend(key: string, today: string): boolean {
  return addDays(key, 1) >= today;
}

/** The season weekends still ahead on `today`, soonest first. */
export function upcomingWeekends(today: string): SeasonWeekend[] {
  return WEEKENDS.filter((weekend) => isUpcomingWeekend(weekend.key, today));
}

const SHORT_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Oct 17–18", or "Oct 31 – Nov 1" across a month boundary. */
export function weekendRangeLabel(key: string): string {
  const saturday = SHORT_DAY.format(parseDay(key));
  const sunday = SHORT_DAY.format(parseDay(addDays(key, 1)));
  const [satMonth] = saturday.split(" ");
  const [sunMonth, sunDay] = sunday.split(" ");
  return satMonth === sunMonth ? `${saturday}–${sunDay}` : `${saturday} – ${sunMonth} ${sunDay}`;
}

/** "Week F · Oct 17–18" — how a weekend is named outside its calendar row. */
export function weekendLabel(key: string): string {
  const weekend = findSeasonWeekend(key);
  const week = weekend ? `Week ${weekend.week} · ` : "";
  return `${week}${weekendRangeLabel(key)}`;
}
