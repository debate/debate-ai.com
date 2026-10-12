/**
 * Editing the demo tournament's mock data from its admin view: entries,
 * judges, rounds (pairings published, results posted), each section's judges
 * and winner, and result sets. Served under `{apiBase}/host/demo` (see
 * `./router`) to everyone, like the demo's admin view itself.
 *
 * Every write is scoped to {@link DEMO_TOURN_ID}: a row is looked up through
 * its tournament first and the update is refused unless it belongs to the
 * demo, so these routes can never reach a hosted tournament or Tabroom data.
 * `POST /host/demo/reset` re-applies `seed/demo.sql`, undoing every edit.
 */

import type { Kysely } from "kysely";
import { z } from "zod";
import { getTabroomKysely } from "../db/runtime";
import { DEMO_TOURN_ID } from "./demo-account";

/** Thrown for a row that is not the demo's, or does not exist; answered as 404. */
export class DemoEditNotFound extends Error {}

const text = (max: number) => z.string().trim().max(max);

export const demoEditSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("entry"),
    id: z.number().int(),
    code: text(63).optional(),
    name: text(255).optional(),
    status: z.enum(["active", "dropped", "waitlist", "unconfirmed"]).optional(),
  }),
  z.object({
    kind: z.literal("judge"),
    id: z.number().int(),
    code: text(15).optional(),
    first: text(63).optional(),
    last: text(63).optional(),
    active: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("round"),
    id: z.number().int(),
    label: text(63).optional(),
    published: z.boolean().optional(),
    resultsPosted: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("resultSet"),
    id: z.number().int(),
    label: text(255).optional(),
    published: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("section"),
    id: z.number().int(),
    /** Swap one of the section's judges (`fromJudgeId`) for another demo judge (`judgeId`). */
    fromJudgeId: z.number().int().optional(),
    judgeId: z.number().int().optional(),
    /** The entry that won the debate: its ballots score a win, the others a loss. */
    winnerEntryId: z.number().int().optional(),
  }),
]);

export type DemoEdit = z.infer<typeof demoEditSchema>;

const demoEvents = (db: Kysely<any>) => db.selectFrom("event").select("event.id").where("event.tourn", "=", DEMO_TOURN_ID);
const demoRounds = (db: Kysely<any>) => db.selectFrom("round").select("round.id").where("round.event", "in", demoEvents(db));
const demoCategories = (db: Kysely<any>) =>
  db.selectFrom("category").select("category.id").where("category.tourn", "=", DEMO_TOURN_ID);

async function demoRow(db: Kysely<any>, table: string, id: number): Promise<void> {
  let query = db.selectFrom(table).select(`${table}.id`).where(`${table}.id`, "=", id);
  if (table === "entry" || table === "result_set") query = query.where(`${table}.tourn`, "=", DEMO_TOURN_ID);
  else if (table === "judge") query = query.where("judge.category", "in", demoCategories(db));
  else if (table === "round") query = query.where("round.event", "in", demoEvents(db));
  else if (table === "panel") query = query.where("panel.round", "in", demoRounds(db));
  else throw new Error(`Unknown demo table ${table}`);
  if (!(await query.executeTakeFirst())) throw new DemoEditNotFound("That row is not part of the demo tournament.");
}

/** Drops undefined fields, so an edit only writes what it names. */
const defined = (values: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));

const bit = (value: boolean | undefined) => (value === undefined ? undefined : value ? 1 : 0);

/** Applies one edit to the demo tournament. */
export async function applyDemoEdit(edit: DemoEdit, { db = getTabroomKysely() }: { db?: Kysely<any> } = {}): Promise<void> {
  switch (edit.kind) {
    case "entry": {
      await demoRow(db, "entry", edit.id);
      const status =
        edit.status === undefined
          ? {}
          : {
              active: bit(edit.status === "active" || edit.status === "unconfirmed"),
              dropped: bit(edit.status === "dropped"),
              waitlist: bit(edit.status === "waitlist"),
              unconfirmed: bit(edit.status === "unconfirmed"),
            };
      const values = defined({ code: edit.code, name: edit.name, ...status });
      if (Object.keys(values).length) await db.updateTable("entry").set(values).where("id", "=", edit.id).execute();
      return;
    }
    case "judge": {
      await demoRow(db, "judge", edit.id);
      const values = defined({ code: edit.code, first: edit.first, last: edit.last, active: bit(edit.active) });
      if (Object.keys(values).length) await db.updateTable("judge").set(values).where("id", "=", edit.id).execute();
      return;
    }
    case "round": {
      await demoRow(db, "round", edit.id);
      const values = defined({
        label: edit.label,
        published: bit(edit.published),
        post_primary: edit.resultsPosted === undefined ? undefined : edit.resultsPosted ? 3 : 0,
      });
      if (Object.keys(values).length) await db.updateTable("round").set(values).where("id", "=", edit.id).execute();
      return;
    }
    case "resultSet": {
      await demoRow(db, "result_set", edit.id);
      const values = defined({ label: edit.label, published: bit(edit.published) });
      if (Object.keys(values).length) await db.updateTable("result_set").set(values).where("id", "=", edit.id).execute();
      return;
    }
    case "section":
      await demoRow(db, "panel", edit.id);
      if (edit.judgeId !== undefined) await swapSectionJudge(db, edit.id, edit.fromJudgeId, edit.judgeId);
      if (edit.winnerEntryId !== undefined) await setSectionWinner(db, edit.id, edit.winnerEntryId);
      return;
  }
}

async function swapSectionJudge(db: Kysely<any>, panelId: number, fromJudgeId: number | undefined, judgeId: number) {
  await demoRow(db, "judge", judgeId);
  let update = db.updateTable("ballot").set({ judge: judgeId }).where("panel", "=", panelId);
  if (fromJudgeId !== undefined) update = update.where("judge", "=", fromJudgeId);
  await update.execute();
}

async function setSectionWinner(db: Kysely<any>, panelId: number, winnerEntryId: number) {
  const ballots = (await db
    .selectFrom("ballot")
    .select(["id", "entry"])
    .where("panel", "=", panelId)
    .execute()) as Array<{ id: number; entry: number | null }>;
  if (!ballots.some((b) => Number(b.entry) === winnerEntryId)) {
    throw new DemoEditNotFound("That entry is not in this section.");
  }
  const scored = new Set(
    (
      (await db
        .selectFrom("score")
        .select(["ballot"])
        .where("tag", "=", "winloss")
        .where(
          "ballot",
          "in",
          ballots.map((b) => Number(b.id)),
        )
        .execute()) as Array<{ ballot: number }>
    ).map((s) => Number(s.ballot)),
  );
  for (const ballot of ballots) {
    const value = Number(ballot.entry) === winnerEntryId ? 1 : 0;
    if (scored.has(Number(ballot.id))) {
      await db.updateTable("score").set({ value }).where("ballot", "=", ballot.id).where("tag", "=", "winloss").execute();
    } else {
      await db.insertInto("score").values({ tag: "winloss", value, ballot: ballot.id }).execute();
    }
  }
}

export interface DemoSection {
  id: number;
  letter: string | null;
  room: string | null;
  bye: boolean;
  /** Each entry with the ballots it won out of those scored; a bye or unscored section has none. */
  entries: Array<{ id: number; code: string | null; side: number | null; wins: number; scored: number }>;
  judges: Array<{ id: number; name: string; code: string | null }>;
}

/** A demo round's sections: who debates whom, where, judged by whom, and who won. */
export async function loadDemoSections(
  roundId: number,
  { db = getTabroomKysely() }: { db?: Kysely<any> } = {},
): Promise<DemoSection[]> {
  await demoRow(db, "round", roundId);
  const [panels, ballots] = await Promise.all([
    db
      .selectFrom("panel")
      .leftJoin("room", "room.id", "panel.room")
      .select(["panel.id", "panel.letter", "panel.bye", "room.name as roomName"])
      .where("panel.round", "=", roundId)
      .execute(),
    db
      .selectFrom("ballot")
      .innerJoin("panel", "panel.id", "ballot.panel")
      .leftJoin("entry", "entry.id", "ballot.entry")
      .leftJoin("judge", "judge.id", "ballot.judge")
      .leftJoin("score", (join) => join.onRef("score.ballot", "=", "ballot.id").on("score.tag", "=", "winloss"))
      .select([
        "ballot.panel",
        "ballot.side",
        "ballot.entry",
        "entry.code as entryCode",
        "ballot.judge",
        "judge.first",
        "judge.last",
        "judge.code as judgeCode",
        "score.value as winloss",
      ])
      .where("panel.round", "=", roundId)
      .orderBy("ballot.side")
      .execute(),
  ]);

  const sections = new Map<number, DemoSection>();
  for (const p of panels as Array<Record<string, unknown>>) {
    sections.set(Number(p.id), {
      id: Number(p.id),
      letter: (p.letter as string | null) ?? null,
      room: (p.roomName as string | null) ?? null,
      bye: Number(p.bye) === 1,
      entries: [],
      judges: [],
    });
  }
  for (const b of ballots as Array<Record<string, unknown>>) {
    const section = sections.get(Number(b.panel));
    if (!section) continue;
    if (b.entry != null) {
      const id = Number(b.entry);
      let entry = section.entries.find((e) => e.id === id);
      if (!entry) {
        entry = { id, code: (b.entryCode as string | null) ?? null, side: b.side == null ? null : Number(b.side), wins: 0, scored: 0 };
        section.entries.push(entry);
      }
      if (b.winloss != null) {
        entry.scored += 1;
        if (Number(b.winloss) === 1) entry.wins += 1;
      }
    }
    if (b.judge != null && !section.judges.some((j) => j.id === Number(b.judge))) {
      section.judges.push({
        id: Number(b.judge),
        name: [b.first, b.last].filter(Boolean).join(" "),
        code: (b.judgeCode as string | null) ?? null,
      });
    }
  }
  return [...sections.values()].sort((a, b) => (a.letter ?? "").localeCompare(b.letter ?? "", undefined, { numeric: true }));
}
