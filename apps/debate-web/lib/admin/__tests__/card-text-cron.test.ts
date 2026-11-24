/**
 * @fileoverview The hourly card text cron: resumes from its R2 cursor, moves
 * cards then caselist docs, stops on its budget, and idles once done.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { caselistDocuments, debateCards } from "../../database/schema";
import { CARD_TEXT_MOVE_CRON, CURSOR_KEY, runCardTextMove } from "../card-text-cron";
import { type CardTextBucket, cardTextKey, caselistDocKey } from "../../search/card-text-store";

function memoryBucket(): CardTextBucket & { objects: Map<string, string> } {
  const objects = new Map<string, string>();
  return {
    objects,
    async put(key, value) {
      objects.set(key, value);
    },
    async get(key) {
      const value = objects.get(key);
      return value === undefined ? null : { text: async () => value };
    },
  };
}

async function seededDb(cards: number, docs: number) {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  const db = drizzle(client, { schema });
  for (let id = 1; id <= cards; id++) {
    await db.insert(debateCards).values({
      id,
      tag: `Tag ${id}`,
      cite: "Smith 21",
      fulltext: `Full text ${id}`,
      markup: `<p><mark>text ${id}</mark></p>`,
      spoken: "",
    } as any);
  }
  for (let id = 1; id <= docs; id++) {
    await db.insert(caselistDocuments).values({
      id,
      pathHash: `hash-${id}`,
      caselistSlug: "hspolicy26",
      caselistLabel: "HS Policy 2025-26",
      school: "Glenbrook North",
      fileName: `${id}.docx`,
      archivePath: `hspolicy26/Glenbrook North/${id}.docx`,
      html: `<h1>Doc ${id}</h1>`,
      cardCount: 1,
    });
  }
  return db;
}

describe("runCardTextMove", () => {
  it("is scheduled hourly", () => {
    expect(CARD_TEXT_MOVE_CRON.split(" ").slice(1)).toEqual(["*", "*", "*", "*"]);
  });

  it("moves cards then caselist docs and records that it finished", async () => {
    const db = await seededDb(5, 3);
    const bucket = memoryBucket();
    const run = await runCardTextMove(db, bucket, { cardPageRows: 2, docPageRows: 2 });

    expect(run.cardsMoved).toBe(5);
    expect(run.docsMoved).toBe(3);
    expect(run.outOfTime).toBe(false);
    expect(run.cursor.stage).toBe("done");
    expect(bucket.objects.has(cardTextKey(5))).toBe(true);
    expect(bucket.objects.has(caselistDocKey(3))).toBe(true);
    const rows = await db.select({ fulltext: debateCards.fulltext, spoken: debateCards.spoken }).from(debateCards);
    expect(rows.every((row) => row.fulltext === "" && row.spoken.startsWith("text"))).toBe(true);
    expect(JSON.parse(bucket.objects.get(CURSOR_KEY)!).stage).toBe("done");
  });

  it("stops at its page cap and resumes from the saved cursor", async () => {
    const db = await seededDb(5, 0);
    const bucket = memoryBucket();

    const first = await runCardTextMove(db, bucket, { cardPageRows: 2, maxPages: 1 });
    expect(first).toMatchObject({ cardsMoved: 2, outOfTime: true });
    expect(first.cursor).toMatchObject({ stage: "cards", afterId: 2 });

    const second = await runCardTextMove(db, bucket, { cardPageRows: 2 });
    expect(second.cardsMoved).toBe(3);
    expect(second.cursor.stage).toBe("done");
  });

  it("stops when its time budget is spent", async () => {
    const db = await seededDb(4, 0);
    const bucket = memoryBucket();
    let clock = 0;
    const run = await runCardTextMove(db, bucket, {
      cardPageRows: 1,
      timeBudgetMs: 100,
      now: () => (clock += 40),
    });
    expect(run.outOfTime).toBe(true);
    expect(run.cardsMoved).toBeLessThan(4);
  });

  it("idles once done, then rescans after a day", async () => {
    const db = await seededDb(2, 0);
    const bucket = memoryBucket();
    let clock = Date.parse("2026-11-05T00:00:00Z");
    const now = () => clock;
    await runCardTextMove(db, bucket, { now });

    await db.insert(debateCards).values({ id: 3, tag: "t", cite: "c", fulltext: "late", markup: "", spoken: "" } as any);
    clock += 60 * 60 * 1000;
    const idle = await runCardTextMove(db, bucket, { now });
    expect(idle.pages).toBe(0);

    clock += 24 * 60 * 60 * 1000;
    const rescan = await runCardTextMove(db, bucket, { now });
    expect(rescan.cardsMoved).toBe(1);
    expect(bucket.objects.has(cardTextKey(3))).toBe(true);
  });

  it("pauses between pages so live requests get D1 in between", async () => {
    const db = await seededDb(3, 0);
    const bucket = memoryBucket();
    const pauses: number[] = [];
    const run = await runCardTextMove(db, bucket, {
      cardPageRows: 1,
      pauseMs: 3000,
      sleep: async (ms) => {
        pauses.push(ms);
      },
    });
    // Pages: 1, 2, 3, then the empty page that finds the end of the cards,
    // then the empty caselist-docs page — a pause before each but the first.
    expect(run.cardsMoved).toBe(3);
    expect(pauses.length).toBe(run.pages - 1);
    expect(pauses.every((ms) => ms === 3000)).toBe(true);
  });

  it("stops for the hour, keeping its cursor, when D1 reports overload", async () => {
    const db = await seededDb(3, 0);
    const bucket = memoryBucket();
    let selects = 0;
    const flaky = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "select") {
          return (...args: unknown[]) => {
            selects += 1;
            if (selects === 2) {
              throw new Error("Failed query", {
                cause: new Error("D1 DB is overloaded. Too many resources consumed within a 10 second window."),
              });
            }
            return (target as any).select(...args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const run = await runCardTextMove(flaky, bucket, { cardPageRows: 1 });
    expect(run).toMatchObject({ cardsMoved: 1, overloaded: true, outOfTime: false });
    expect(JSON.parse(bucket.objects.get(CURSOR_KEY)!)).toMatchObject({ stage: "cards", afterId: 1 });
  });

  it("still throws errors that are not overload", async () => {
    const db = await seededDb(1, 0);
    const broken = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "select") return () => { throw new Error("no such table: debate_cards"); };
        return Reflect.get(target, prop, receiver);
      },
    });
    await expect(runCardTextMove(broken, memoryBucket())).rejects.toThrow(/no such table/);
  });

  it("starts over when the cursor is unreadable", async () => {
    const db = await seededDb(1, 0);
    const bucket = memoryBucket();
    bucket.objects.set(CURSOR_KEY, "not json");
    const run = await runCardTextMove(db, bucket);
    expect(run.cardsMoved).toBe(1);
  });
});
