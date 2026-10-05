/**
 * A hosted tournament as its admins see it: everything the public invite,
 * pairings and results pages show, plus what they hide — unpublished rounds,
 * every entry and its status, judges, rooms and unpublished result sets.
 *
 * Served at `GET {apiBase}/host/tourns/:tournId/admin` (see `./router`) to the
 * tournament's owners and admins, and for the demo tournament to everyone, as
 * the mock {@link DEMO_ADMIN}. This reads this site's own tables only; it is
 * the admin web view for tournaments hosted here, not Tabroom's console.
 */

import type { Kysely } from "kysely";
import { getTabroomKysely } from "../db/runtime";
import { DEMO_ADMIN, DEMO_TOURN_ID } from "./demo-account";

const ADMIN_TAGS = ["owner", "admin"];

/** Whether `personId` may open `tournId`'s admin view: an owner/admin permission, or site admin. */
export async function canAdminTournament(
  personId: number,
  tournId: number,
  { db = getTabroomKysely() }: { db?: Kysely<any> } = {},
): Promise<boolean> {
  const [permission, person] = await Promise.all([
    db
      .selectFrom("permission")
      .select(["id"])
      .where("person", "=", personId)
      .where("tourn", "=", tournId)
      .where("tag", "in", ADMIN_TAGS)
      .executeTakeFirst(),
    db.selectFrom("person").select(["site_admin"]).where("id", "=", personId).executeTakeFirst(),
  ]);
  return Boolean(permission || (person as { site_admin?: unknown } | undefined)?.site_admin);
}

/** Whether anyone may open this tournament's admin view, as the mock admin. */
export const isDemoTournament = (tournId: number) => tournId === DEMO_TOURN_ID;

const iso = (value: unknown): string | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return typeof value === "string" && value ? value : null;
};
const num = (value: unknown): number | null => (value === null || value === undefined || value === "" ? null : Number(value));
const flag = (value: unknown): boolean => value === true || Number(value) === 1;

export type AdminViewer = { username: string; name: string; mock: boolean };

/** The demo's viewer: the mock admin account. */
export const mockAdminViewer: AdminViewer = { username: DEMO_ADMIN.username, name: DEMO_ADMIN.name, mock: true };

/** Everything the admin view shows for `tournId`, or null when there is no such tournament. */
export async function loadTournamentAdmin(
  tournId: number,
  viewer: AdminViewer,
  { db = getTabroomKysely() }: { db?: Kysely<any> } = {},
) {
  const tourn = (await db
    .selectFrom("tourn")
    .select(["id", "name", "webname", "city", "state", "country", "tz", "start", "end", "reg_start", "reg_end", "hidden"])
    .where("id", "=", tournId)
    .executeTakeFirst()) as Record<string, unknown> | undefined;
  if (!tourn) return null;

  const [events, schools, entries, judges, rooms, rounds, resultSets] = await Promise.all([
    db
      .selectFrom("event")
      .leftJoin("entry", (join) => join.onRef("entry.event", "=", "event.id").on("entry.active", "=", 1))
      .select(["event.id", "event.abbr", "event.name", "event.type", "event.level", "event.fee"])
      .select((eb) => eb.fn.count("entry.id").as("entryCount"))
      .where("event.tourn", "=", tournId)
      .groupBy("event.id")
      .orderBy("event.name")
      .execute(),
    db
      .selectFrom("school")
      .leftJoin("entry", (join) => join.onRef("entry.school", "=", "school.id").on("entry.active", "=", 1))
      .select(["school.id", "school.name", "school.code"])
      .select((eb) => eb.fn.count("entry.id").as("entryCount"))
      .where("school.tourn", "=", tournId)
      .groupBy("school.id")
      .orderBy("school.name")
      .execute(),
    db
      .selectFrom("entry")
      .leftJoin("event", "event.id", "entry.event")
      .leftJoin("school", "school.id", "entry.school")
      .select([
        "entry.id",
        "entry.code",
        "entry.name",
        "entry.active",
        "entry.dropped",
        "entry.waitlist",
        "entry.unconfirmed",
        "event.abbr as eventAbbr",
        "school.name as schoolName",
      ])
      .where("entry.tourn", "=", tournId)
      .orderBy("event.abbr")
      .orderBy("entry.code")
      .execute(),
    db
      .selectFrom("judge")
      .innerJoin("category", "category.id", "judge.category")
      .leftJoin("school", "school.id", "judge.school")
      .select(["judge.id", "judge.code", "judge.first", "judge.last", "judge.active", "school.name as schoolName"])
      .where("category.tourn", "=", tournId)
      .orderBy("judge.last")
      .execute(),
    db
      .selectFrom("room")
      .innerJoin("tourn_site", "tourn_site.site", "room.site")
      .select(["room.id", "room.name", "room.building"])
      .where("tourn_site.tourn", "=", tournId)
      .where((eb) => eb.or([eb("room.deleted", "is", null), eb("room.deleted", "=", 0)]))
      .orderBy("room.name")
      .execute(),
    db
      .selectFrom("round")
      .innerJoin("event", "event.id", "round.event")
      .leftJoin("timeslot", "timeslot.id", "round.timeslot")
      .leftJoin("panel", "panel.round", "round.id")
      .select([
        "round.id",
        "round.name",
        "round.label",
        "round.type",
        "round.published",
        "round.post_primary",
        "event.abbr as eventAbbr",
        "timeslot.start as start",
      ])
      .select((eb) => eb.fn.count("panel.id").as("sectionCount"))
      .where("event.tourn", "=", tournId)
      .groupBy("round.id")
      .orderBy("event.abbr")
      .orderBy("round.name")
      .execute(),
    db
      .selectFrom("result_set")
      .leftJoin("event", "event.id", "result_set.event")
      .select(["result_set.id", "result_set.label", "result_set.published", "event.abbr as eventAbbr"])
      .where("result_set.tourn", "=", tournId)
      .orderBy("result_set.id")
      .execute(),
  ]);

  const rows = <T>(list: unknown[]) => list as Array<Record<string, unknown>> as unknown as T[];

  return {
    viewer,
    tourn: {
      id: Number(tourn.id),
      name: String(tourn.name ?? ""),
      webname: (tourn.webname as string | null) ?? null,
      city: (tourn.city as string | null) ?? null,
      state: (tourn.state as string | null) ?? null,
      country: (tourn.country as string | null) ?? null,
      tz: (tourn.tz as string | null) ?? null,
      start: iso(tourn.start),
      end: iso(tourn.end),
      regStart: iso(tourn.reg_start),
      regEnd: iso(tourn.reg_end),
      hidden: flag(tourn.hidden),
    },
    events: rows<Record<string, unknown>>(events).map((e) => ({
      id: Number(e.id),
      abbr: String(e.abbr ?? ""),
      name: String(e.name ?? ""),
      type: String(e.type ?? ""),
      level: (e.level as string | null) ?? null,
      fee: num(e.fee),
      entryCount: Number(e.entryCount ?? 0),
    })),
    schools: rows<Record<string, unknown>>(schools).map((s) => ({
      id: Number(s.id),
      name: String(s.name ?? ""),
      code: (s.code as string | null) ?? null,
      entryCount: Number(s.entryCount ?? 0),
    })),
    entries: rows<Record<string, unknown>>(entries).map((e) => ({
      id: Number(e.id),
      code: (e.code as string | null) ?? null,
      name: (e.name as string | null) ?? null,
      eventAbbr: (e.eventAbbr as string | null) ?? null,
      schoolName: (e.schoolName as string | null) ?? null,
      status: flag(e.dropped)
        ? ("dropped" as const)
        : flag(e.waitlist)
          ? ("waitlist" as const)
          : flag(e.unconfirmed)
            ? ("unconfirmed" as const)
            : ("active" as const),
    })),
    judges: rows<Record<string, unknown>>(judges).map((j) => ({
      id: Number(j.id),
      code: (j.code as string | null) ?? null,
      name: [j.first, j.last].filter(Boolean).join(" "),
      schoolName: (j.schoolName as string | null) ?? null,
      active: flag(j.active),
    })),
    rooms: rows<Record<string, unknown>>(rooms).map((r) => ({
      id: Number(r.id),
      name: String(r.name ?? ""),
      building: (r.building as string | null) ?? null,
    })),
    rounds: rows<Record<string, unknown>>(rounds).map((r) => ({
      id: Number(r.id),
      name: Number(r.name ?? 0),
      label: (r.label as string | null) || null,
      type: (r.type as string | null) ?? null,
      eventAbbr: String(r.eventAbbr ?? ""),
      published: flag(r.published),
      resultsPosted: Number(r.post_primary ?? 0) > 0,
      sectionCount: Number(r.sectionCount ?? 0),
      start: iso(r.start),
    })),
    resultSets: rows<Record<string, unknown>>(resultSets).map((s) => ({
      id: Number(s.id),
      label: (s.label as string | null) ?? null,
      eventAbbr: (s.eventAbbr as string | null) ?? null,
      published: flag(s.published),
    })),
  };
}

export type TournamentAdminView = NonNullable<Awaited<ReturnType<typeof loadTournamentAdmin>>>;
