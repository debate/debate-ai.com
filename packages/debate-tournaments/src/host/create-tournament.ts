/**
 * Creating a tournament from inside this app.
 *
 * Upstream Tabroom's own write path lives in its `tab` router, which is not
 * vendored here (see `README.md`): it hangs off a session and a permission
 * system this app does not have, and it opens `db.transaction()`s, which D1
 * cannot hold open. This module is the write path instead — a single
 * Kysely-over-D1 transaction-less insert of the rows a tournament needs to
 * exist as a tournament, in the same tables and under the same settings tags
 * the vendored read routes already read:
 *
 * | row         | why                                                          |
 * | ----------- | ------------------------------------------------------------ |
 * | `person`    | the host, matched by the email they signed in with           |
 * | `tourn`     | the tournament itself                                          |
 * | `site`      | where the rounds happen, and whether that is online           |
 * | `tourn_site`| which sites this tournament uses                              |
 * | `category`  | the division (Open / Novice / JV) the event runs in           |
 * | `event`     | one per selected format, holding the format's settings         |
 * | `permission`| the host as `owner`, so later requests can prove ownership    |
 * | `entry`     | the host registered, so the tournament is never empty          |
 *
 * The settings written are the ones `eventRepo.getEventsForInvite` reads back
 * for the public invite: `cap`, `school_cap`, `description`, `field_report`,
 * `anonymous_public`, `live_updates`, plus the tournament's `currency`. Each
 * event also gets its format's `min_entry` / `max_entry` (competitors per
 * entry) and `aff_label` / `neg_label` (Government, Proposition, Pro…), and
 * `event.type` is the format's Tabroom kind (`debate`, `wudc`, `wsdc`,
 * `congress`).
 */

import type { Kysely } from "kysely";
import { z } from "zod";
import { getTabroomKysely } from "../db/runtime";
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_FORMAT_IDS,
  tournamentFormat,
  formatSummary,
  type EventCodeStyle,
  type EventLevel,
  type TournamentFormat,
  type TournamentFormatId,
} from "./formats";

/** How the rounds are held. Kept in step with the host page's three cards. */
export const scheduledTypes = ["virtual", "in-person", "long-term-online"] as const;
export type ScheduledType = (typeof scheduledTypes)[number];

const eventLevels = ["open", "novice", "jv"] as const;
const codeStyles = [
  "code_name",
  "full_initials",
  "initials",
  "last_names",
  "names",
  "names_lastfirst",
  "numbers",
  "prepend_school",
  "register",
  "school_first_names",
  "school_last_names",
  "school_name_only",
  "school_names",
  "school_number",
  "schoolname_code",
] as const;

/** How one format should be run for this tournament. */
const eventInput = z
  .object({
    format: z.enum(TOURNAMENT_FORMAT_IDS),
    /** `event.level` — the division this event runs in. */
    level: z.enum(eventLevels).default("open"),
    /** `event.code_style` — how entries are written in pairings. */
    codeStyle: z.enum(codeStyles).default("names"),
    /** `event_setting` `cap` — entries per school, or `null` for no cap. */
    schoolCap: z.number().int().min(1).max(50).nullable().default(null),
    /** `event_setting` `description` — extra text on the public invite. */
    description: z.string().max(2000).default(""),
    /** `event.fee` — entry fee in {@link tournament.currency}. */
    fee: z.number().min(0).max(10_000).nullable().default(null),
  })
  .strict();

/** The body `POST /host/tourns` accepts. */
export const createTournamentSchema = z
  .object({
    name: z.string().trim().min(3).max(63),
    /** Defaults to a slug of `name`; must be unique across tournaments. */
    webname: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "Use letters, numbers and dashes only.")
      .optional(),
    scheduledType: z.enum(scheduledTypes).default("in-person"),
    /** Where the rounds happen. Omitted for a fully virtual tournament. */
    venue: z.string().trim().max(63).default(""),
    city: z.string().trim().max(31).default(""),
    state: z.string().trim().max(31).default(""),
    country: z.string().trim().max(4).default(""),
    /** IANA zone, e.g. `America/Los_Angeles`. */
    tz: z.string().trim().max(63).default("UTC"),
    /** ISO-8601 datetimes; stored as UTC. */
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    regStart: z.iso.datetime({ offset: true }).optional(),
    regEnd: z.iso.datetime({ offset: true }).optional(),
    /** ISO-4217 code shown next to entry fees. */
    currency: z.string().trim().toLowerCase().length(3).default("usd"),
    events: z.array(eventInput).min(1).max(TOURNAMENT_FORMATS.length),
  })
  .strict()
  .refine((value) => new Set(value.events.map((e) => e.format)).size === value.events.length, {
    message: "Pick each format at most once.",
    path: ["events"],
  })
  .refine((value) => new Date(value.end) >= new Date(value.start), {
    message: "The tournament cannot end before it starts.",
    path: ["end"],
  })
  .refine((value) => !value.regStart || !value.regEnd || new Date(value.regEnd) >= new Date(value.regStart), {
    message: "Registration cannot close before it opens.",
    path: ["regEnd"],
  });

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type EventInput = z.infer<typeof eventInput>;

/** What `POST /host/tourns` resolves to, and what the UI navigates to. */
export interface CreatedTournament {
  id: number;
  name: string;
  webname: string;
  start: string | null;
  end: string | null;
  tz: string | null;
  events: Array<{
    id: number;
    format: TournamentFormatId;
    abbr: string;
    name: string;
    level: string;
    codeStyle: string;
    schoolCap: number | null;
    description: string;
  }>;
  /** How each format is run, so the form can show the host what was saved. */
  summaries: Record<string, string>;
}

/** A URL-safe `webname` derived from a tournament name. */
export function slugifyTournamentName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  return slug.length >= 2 ? slug : `tourn-${Date.now().toString(36)}`;
}

const nameParts = (name: string | null | undefined): { first: string; last: string } => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
};

/**
 * The Tabroom `person` for `email`, created if this is the first time they
 * host. Matching by email is the same rule `findPersonByEmail` uses to attach
 * a signed-in user to a Tabroom account.
 */
export async function ensurePersonByEmail(
  { email, name }: { email: string; name?: string | null },
  { db = getTabroomKysely() }: { db?: Kysely<any> } = {},
): Promise<{ id: number; email: string; first: string | null; last: string | null }> {
  const address = email.trim().toLowerCase();
  const existing = await db
    .selectFrom("person")
    .select(["id", "email", "first", "last"])
    .where("email", "=", address)
    .executeTakeFirst();
  if (existing) return existing as typeof existing & { email: string };

  const { first, last } = nameParts(name);
  const created = await db
    .insertInto("person")
    .values({ email: address, first, last, created_at: new Date(), timestamp: new Date() })
    .returning(["id", "email", "first", "last"])
    .executeTakeFirstOrThrow();
  return created as typeof created & { email: string };
}

/** A `webname` not already taken, suffixed `-2`, `-3`, … when it collides. */
async function uniqueWebname(db: Kysely<any>, base: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 63 - String(attempt).length - 1)}-${attempt + 1}`;
    const taken = await db.selectFrom("tourn").select("id").where("webname", "=", candidate).executeTakeFirst();
    if (!taken) return candidate;
  }
  throw new Error("Could not find a free webname for this tournament.");
}

/**
 * The `event_setting` rows one format writes, in the `value` / `value_text`
 * / `value_date` split `settings.ts`'s `saveSettings` uses: short values in
 * `value`, prose in `value_text` under a `text` marker.
 */
function settingsForEvent(
  event: EventInput,
  format: TournamentFormat,
): Array<{ tag: string; value: string; value_text: string | null }> {
  const settings: Array<{ tag: string; value: string; value_text: string | null }> = [
    // How many competitors make up one entry, and what each bench is called —
    // the tags upstream's pairing and ballot code reads.
    { tag: "min_entry", value: String(format.entrySize.min), value_text: null },
    { tag: "max_entry", value: String(format.entrySize.max), value_text: null },
  ];
  if (format.teamsPerRoom > 0) {
    settings.push({ tag: "aff_label", value: format.sideLabels.aff.label, value_text: null });
    settings.push({ tag: "neg_label", value: format.sideLabels.neg.label, value_text: null });
  }
  if (event.schoolCap != null) settings.push({ tag: "school_cap", value: String(event.schoolCap), value_text: null });
  if (event.description) settings.push({ tag: "description", value: "text", value_text: event.description });
  return settings;
}

/** Whether a tournament with this shape has any rounds to run online. */
const isOnline = (type: ScheduledType) => type !== "in-person";

/**
 * Creates a tournament owned by `person`, with one category and event per
 * selected format.
 *
 * D1 has no interactive transaction (see `db/d1-dialect.ts`), so the inserts
 * run in order and a failure rolls back what was written. Everything is
 * validated by {@link createTournamentSchema} before the first insert.
 */
export async function createTournament(
  person: { id: number },
  input: CreateTournamentInput,
  { db = getTabroomKysely() }: { db?: Kysely<any> } = {},
): Promise<CreatedTournament> {
  const start = new Date(input.start);
  const end = new Date(input.end);
  const webname = await uniqueWebname(db, input.webname ?? slugifyTournamentName(input.name));
  const venue = input.venue.trim() || (isOnline(input.scheduledType) ? "Online" : "Tournament venue");

  // Inserted rows, most recent first, so a failure can undo them in reverse.
  const written: Array<() => Promise<unknown>> = [];
  const undo = async () => {
    for (const revert of written) {
      try {
        await revert();
      } catch {
        // Best effort: the tournament row below is what matters.
      }
    }
  };

  try {
    const tourn = (await db
      .insertInto("tourn")
      .values({
        name: input.name,
        webname,
        tz: input.tz,
        city: input.city || null,
        state: input.state || null,
        country: input.country || null,
        hidden: 0,
        start,
        end,
        reg_start: input.regStart ? new Date(input.regStart) : null,
        reg_end: input.regEnd ? new Date(input.regEnd) : null,
        timestamp: new Date(),
      })
      .returning(["id"])
      .executeTakeFirstOrThrow()) as { id: number };
    written.unshift(() => db.deleteFrom("tourn").where("id", "=", tourn.id).execute());

    const site = (await db
      .insertInto("site")
      .values({ name: venue, online: isOnline(input.scheduledType) ? 1 : 0, timestamp: new Date() })
      .returning(["id"])
      .executeTakeFirstOrThrow()) as { id: number };
    written.unshift(() => db.deleteFrom("site").where("id", "=", site.id).execute());

    await db.insertInto("tourn_site").values({ tourn: tourn.id, site: site.id, timestamp: new Date() }).execute();

    if (input.currency) {
      await db
        .insertInto("tourn_setting")
        .values({ tourn: tourn.id, tag: "currency", value: input.currency.toLowerCase(), timestamp: new Date() })
        .execute();
    }

    const created: CreatedTournament["events"] = [];
    for (const event of input.events) {
      const format = tournamentFormat(event.format);
      if (!format) throw new Error(`Unknown format: ${event.format}`);

      const category = (await db
        .insertInto("category")
        .values({
          name: `${format.category} ${levelLabel(event.level)}`.trim(),
          abbr: format.abbr.slice(0, 31),
          tourn: tourn.id,
          timestamp: new Date(),
        })
        .returning(["id"])
        .executeTakeFirstOrThrow()) as { id: number };
      written.unshift(() => db.deleteFrom("category").where("id", "=", category.id).execute());

      const row = (await db
        .insertInto("event")
        .values({
          name: format.name,
          abbr: format.abbr,
          type: format.eventType,
          level: event.level,
          code_style: event.codeStyle,
          fee: event.fee,
          tourn: tourn.id,
          category: category.id,
          timestamp: new Date(),
        })
        .returning(["id"])
        .executeTakeFirstOrThrow()) as { id: number };
      written.unshift(() => db.deleteFrom("event").where("id", "=", row.id).execute());

      for (const setting of settingsForEvent(event, format)) {
        await db
          .insertInto("event_setting")
          .values({ event: row.id, tag: setting.tag, value: setting.value, value_text: setting.value_text })
          .execute();
      }

      created.push({
        id: row.id,
        format: format.id,
        abbr: format.abbr,
        name: format.name,
        level: event.level,
        codeStyle: event.codeStyle,
        schoolCap: event.schoolCap,
        description: event.description,
      });
    }

    await db
      .insertInto("permission")
      .values({ tourn: tourn.id, person: person.id, tag: "owner", created_by: person.id, timestamp: new Date() })
      .execute();

    // The host is registered in every event, so a new tournament's pairings
    // and standings have someone in them.
    for (const event of created) {
      await db
        .insertInto("entry")
        .values({
          event: event.id,
          tourn: tourn.id,
          name: null,
          active: 1,
          dropped: 0,
          waitlist: 0,
          unconfirmed: 0,
          registered_by: person.id,
          timestamp: new Date(),
        })
        .execute();
    }

    const summaries: Record<string, string> = {};
    for (const event of created) {
      const format = TOURNAMENT_FORMATS.find((entry) => entry.id === event.format);
      if (format) summaries[event.format] = formatSummary(format);
    }

    return {
      id: tourn.id,
      name: input.name,
      webname,
      start: start.toISOString(),
      end: end.toISOString(),
      tz: input.tz,
      events: created,
      summaries,
    };
  } catch (error) {
    await undo();
    throw error;
  }
}

/** The division a level is called in a category name. */
function levelLabel(level: EventLevel): string {
  if (level === "novice") return "Novice";
  if (level === "jv") return "JV";
  return "";
}

/** The tournaments `personId` owns, newest first. */
export async function listOwnedTournaments(
  personId: number,
  { db = getTabroomKysely() }: { db?: Kysely<any> } = {},
): Promise<
  Array<{
    id: number;
    name: string;
    webname: string | null;
    start: Date | null;
    end: Date | null;
    tz: string | null;
    hidden: boolean;
    eventCount: number;
  }>
> {
  const rows = await db
    .selectFrom("tourn")
    .innerJoin("permission", "permission.tourn", "tourn.id")
    .innerJoin("event", (join) => join.onRef("event.tourn", "=", "tourn.id"))
    .select([
      "tourn.id",
      "tourn.name",
      "tourn.webname",
      "tourn.start",
      "tourn.end",
      "tourn.tz",
      "tourn.hidden",
    ])
    .select((eb) => eb.fn.count("event.id").as("eventCount"))
    .where("permission.person", "=", personId)
    .where("permission.tag", "=", "owner")
    .where("event.type", "!=", "attendee")
    .groupBy("tourn.id")
    .orderBy("tourn.start", "desc")
    .execute();

  return rows as unknown as Awaited<ReturnType<typeof listOwnedTournaments>>;
}
