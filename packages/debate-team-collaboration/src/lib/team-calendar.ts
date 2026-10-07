/**
 * @fileoverview Team calendar — a coach's month view of the tasks,
 * assignments and group-only virtual tournaments scheduled for one coaching
 * group (a `CoachingProgramConfig` roster).
 *
 * A coach picks a group, puts research tasks and assignments on a due date
 * with one or more roster members as assignees, and schedules virtual
 * tournaments that only that group's roster enters. The calendar then shows
 * a month grid with a marker on every day that has something due, the
 * selected day's agenda split into Tasks / Assignments / Tournaments, and the
 * group's upcoming deadlines with overdue items flagged.
 *
 * Pure and framework-free: dates are `YYYY-MM-DD` strings in the viewer's
 * local calendar (no time zones), so the month grid, the agenda and the
 * tests all agree without a clock. Persistence lives in
 * `state/teamCalendar.ts`; the UI in `panels/TeamCalendarPanel.tsx`.
 *
 * Team data is shared data: an assignee must be on the group's roster, and a
 * tournament's entrants are that roster — never anyone outside it.
 *
 * @module lib/team-calendar
 */

/** What a calendar entry is: a research task, a graded assignment, or a group-only virtual tournament. */
export type TeamCalendarItemKind = "task" | "assignment" | "tournament";

/** Debate formats a group virtual tournament can run in. */
export type TeamCalendarTournamentFormat = "PF" | "LD" | "Policy";

export const TEAM_CALENDAR_ITEM_KINDS: readonly TeamCalendarItemKind[] = ["task", "assignment", "tournament"];
export const TEAM_CALENDAR_TOURNAMENT_FORMATS: readonly TeamCalendarTournamentFormat[] = ["PF", "LD", "Policy"];

/** Most rounds a group virtual tournament may schedule. */
export const MAX_TEAM_TOURNAMENT_ROUNDS = 8;
export const MAX_TEAM_CALENDAR_TITLE_LENGTH = 120;
export const MAX_TEAM_CALENDAR_NOTES_LENGTH = 2000;

/** One scheduled entry on a coaching group's calendar. */
export interface TeamCalendarItem {
  id: string;
  /** The `CoachingProgramConfig.id` this entry belongs to. */
  groupId: string;
  kind: TeamCalendarItemKind;
  title: string;
  notes?: string;
  /** Due date (task/assignment) or start date (tournament), `YYYY-MM-DD`. */
  date: string;
  /** Optional local time of day, `HH:MM` (24-hour). */
  time?: string;
  /** Roster members responsible. For a tournament, every entrant. */
  assigneeIds: string[];
  /** Roster members who have marked their part done. */
  completedBy: string[];
  /** Only on `kind: "tournament"`. */
  tournament?: { format: TeamCalendarTournamentFormat; rounds: number };
  createdAt: number;
}

/** A coach's unsaved entry, as typed into the form. */
export interface TeamCalendarItemDraft {
  kind: TeamCalendarItemKind;
  title: string;
  notes?: string;
  date: string;
  time?: string;
  assigneeIds: string[];
  format?: TeamCalendarTournamentFormat;
  rounds?: number;
}

export type TeamCalendarDraftResult =
  | { ok: true; item: TeamCalendarItem }
  | { ok: false; error: string };

/** One cell of the month grid. */
export interface TeamCalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD` for a local `Date`. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a `YYYY-MM-DD` string to a local-midnight `Date`, or `null` if it isn't a real calendar date. */
export function parseIsoDate(iso: string): Date | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** Steps a `{ year, month }` (month 0–11) by `delta` months. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** "October 2026". */
export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * The six-week Sunday-first grid for a month (month 0–11): leading days from
 * the previous month and trailing days from the next are included with
 * `inMonth: false`, so every month renders the same 42 cells.
 */
export function buildMonthGrid(year: number, month: number): TeamCalendarDay[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks: TeamCalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: TeamCalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      week.push({ iso: toIsoDate(date), day: date.getDate(), inMonth: date.getMonth() === month });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Whether every assignee has marked the entry done. A tournament is never "done" by checkmark — it is done once its date has passed. */
export function isTeamCalendarItemComplete(item: TeamCalendarItem): boolean {
  if (item.kind === "tournament") return false;
  return item.assigneeIds.length > 0 && item.assigneeIds.every((id) => item.completedBy.includes(id));
}

/** A task or assignment whose due date is before `todayIso` and still has someone who hasn't finished it. */
export function isTeamCalendarItemOverdue(item: TeamCalendarItem, todayIso: string): boolean {
  return item.kind !== "tournament" && item.date < todayIso && !isTeamCalendarItemComplete(item);
}

function compareItems(a: TeamCalendarItem, b: TeamCalendarItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const at = a.time ?? "99:99";
  const bt = b.time ?? "99:99";
  if (at !== bt) return at < bt ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/** One group's entries, in date-then-time order. */
export function itemsForGroup(items: readonly TeamCalendarItem[], groupId: string): TeamCalendarItem[] {
  return items.filter((item) => item.groupId === groupId).sort(compareItems);
}

/** Counts of entries per date, for the grid's day markers. */
export function countItemsByDate(items: readonly TeamCalendarItem[]): Map<string, Record<TeamCalendarItemKind, number>> {
  const counts = new Map<string, Record<TeamCalendarItemKind, number>>();
  for (const item of items) {
    const entry = counts.get(item.date) ?? { task: 0, assignment: 0, tournament: 0 };
    entry[item.kind] += 1;
    counts.set(item.date, entry);
  }
  return counts;
}

/** The selected day's agenda, split into the three tabs the panel shows. */
export function buildDayAgenda(
  items: readonly TeamCalendarItem[],
  iso: string,
): Record<TeamCalendarItemKind, TeamCalendarItem[]> {
  const agenda: Record<TeamCalendarItemKind, TeamCalendarItem[]> = { task: [], assignment: [], tournament: [] };
  for (const item of [...items].sort(compareItems)) {
    if (item.date === iso) agenda[item.kind].push(item);
  }
  return agenda;
}

/**
 * Every task and assignment someone still owes, earliest due date first (so
 * overdue entries lead), capped at `limit` — the "what's coming up" list.
 */
export function upcomingDeadlines(items: readonly TeamCalendarItem[], limit = 10): TeamCalendarItem[] {
  return items
    .filter((item) => item.kind !== "tournament" && !isTeamCalendarItemComplete(item))
    .sort(compareItems)
    .slice(0, limit);
}

/** Per-member open/done/overdue counts across one group's tasks and assignments. */
export interface TeamCalendarMemberLoad {
  memberId: string;
  open: number;
  done: number;
  overdue: number;
}

export function buildMemberLoad(
  items: readonly TeamCalendarItem[],
  memberIds: readonly string[],
  todayIso: string,
): TeamCalendarMemberLoad[] {
  return memberIds.map((memberId) => {
    const load: TeamCalendarMemberLoad = { memberId, open: 0, done: 0, overdue: 0 };
    for (const item of items) {
      if (item.kind === "tournament" || !item.assigneeIds.includes(memberId)) continue;
      if (item.completedBy.includes(memberId)) load.done += 1;
      else if (item.date < todayIso) load.overdue += 1;
      else load.open += 1;
    }
    return load;
  });
}

/**
 * Validates a draft against the group's roster and returns a ready-to-save
 * entry. Assignees outside the roster are rejected rather than dropped, so a
 * coach never silently assigns work to someone not in the group. A
 * tournament's entrants default to the whole roster.
 */
export function buildTeamCalendarItem(
  draft: TeamCalendarItemDraft,
  group: { id: string; memberIds: readonly string[] },
  options: { id: string; now: number },
): TeamCalendarDraftResult {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: "A title is required." };
  if (title.length > MAX_TEAM_CALENDAR_TITLE_LENGTH) {
    return { ok: false, error: `Keep the title under ${MAX_TEAM_CALENDAR_TITLE_LENGTH} characters.` };
  }
  if (!TEAM_CALENDAR_ITEM_KINDS.includes(draft.kind)) return { ok: false, error: "Unknown entry type." };
  if (!parseIsoDate(draft.date)) return { ok: false, error: "Pick a valid date." };
  const time = draft.time?.trim() || undefined;
  if (time && !TIME.test(time)) return { ok: false, error: "Time must be HH:MM." };
  const notes = draft.notes?.trim() || undefined;
  if (notes && notes.length > MAX_TEAM_CALENDAR_NOTES_LENGTH) {
    return { ok: false, error: `Keep notes under ${MAX_TEAM_CALENDAR_NOTES_LENGTH} characters.` };
  }

  const roster = new Set(group.memberIds);
  const requested = [...new Set(draft.assigneeIds.map((id) => id.trim()).filter(Boolean))];
  const outsiders = requested.filter((id) => !roster.has(id));
  if (outsiders.length > 0) {
    return { ok: false, error: `Not on this group's roster: ${outsiders.join(", ")}.` };
  }

  let assigneeIds = requested;
  let tournament: TeamCalendarItem["tournament"];
  if (draft.kind === "tournament") {
    const format = draft.format ?? "PF";
    if (!TEAM_CALENDAR_TOURNAMENT_FORMATS.includes(format)) return { ok: false, error: "Unknown format." };
    const rounds = draft.rounds ?? 4;
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > MAX_TEAM_TOURNAMENT_ROUNDS) {
      return { ok: false, error: `Rounds must be 1–${MAX_TEAM_TOURNAMENT_ROUNDS}.` };
    }
    if (assigneeIds.length === 0) assigneeIds = [...group.memberIds];
    if (assigneeIds.length < 2) return { ok: false, error: "A tournament needs at least two entrants." };
    tournament = { format, rounds };
  } else if (assigneeIds.length === 0) {
    return { ok: false, error: "Assign at least one roster member." };
  }

  return {
    ok: true,
    item: {
      id: options.id,
      groupId: group.id,
      kind: draft.kind,
      title,
      ...(notes ? { notes } : {}),
      date: draft.date,
      ...(time ? { time } : {}),
      assigneeIds,
      completedBy: [],
      ...(tournament ? { tournament } : {}),
      createdAt: options.now,
    },
  };
}

/** Marks (or unmarks) one assignee's part of a task/assignment as done. Non-assignees are ignored. */
export function toggleTeamCalendarCompletion(item: TeamCalendarItem, memberId: string): TeamCalendarItem {
  if (item.kind === "tournament" || !item.assigneeIds.includes(memberId)) return item;
  const completedBy = item.completedBy.includes(memberId)
    ? item.completedBy.filter((id) => id !== memberId)
    : [...item.completedBy, memberId];
  return { ...item, completedBy };
}

/**
 * Round-robin pairings for a group tournament: each round pairs entrants by
 * the circle method, with a bye when the count is odd. Capped at the
 * tournament's round count.
 */
export function buildTournamentPairings(
  entrantIds: readonly string[],
  rounds: number,
): Array<Array<[string, string | null]>> {
  const players: Array<string | null> = [...entrantIds];
  if (players.length % 2 === 1) players.push(null);
  const n = players.length;
  if (n < 2) return [];
  const schedule: Array<Array<[string, string | null]>> = [];
  const maxRounds = Math.min(rounds, n - 1);
  let rotation = [...players];
  for (let r = 0; r < maxRounds; r++) {
    const pairs: Array<[string, string | null]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a === null && b !== null) pairs.push([b, null]);
      else if (a !== null) pairs.push([a, b]);
    }
    schedule.push(pairs);
    rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)];
  }
  return schedule;
}

/** Type guard for one persisted entry. */
export function isTeamCalendarItem(value: unknown): value is TeamCalendarItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.groupId === "string" &&
    TEAM_CALENDAR_ITEM_KINDS.includes(v.kind as TeamCalendarItemKind) &&
    typeof v.title === "string" &&
    typeof v.date === "string" &&
    Array.isArray(v.assigneeIds) &&
    Array.isArray(v.completedBy) &&
    typeof v.createdAt === "number"
  );
}
