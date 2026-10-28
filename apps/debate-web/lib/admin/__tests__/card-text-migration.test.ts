/**
 * @fileoverview Card full text in R2: the importer writing to the bucket,
 * the admin move of existing rows, and reading the text back.
 *
 * Runs against an in-memory libSQL database built from `schema.ts` and an
 * in-memory stand-in for the R2 binding.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { asc } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { debateCards } from "../../database/schema";
import { writeDebateCardBatch } from "../debate-card-import";
import { moveCardTextPage } from "../card-text-migration";
import {
  type CardTextBucket,
  cardTextKey,
  extractHighlightedText,
  hydrateCardText,
} from "../../search/card-text-store";

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

function card(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tag: `Tag ${id}`,
    cite: "Smith 21",
    fulltext: `Full text of card ${id}`,
    markup: `<p>Full <mark>text of</mark> card <mark><b>${id}</b></mark></p>`,
    spoken: "",
    ...overrides,
  };
}

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

describe("extractHighlightedText", () => {
  it("joins the text of each <mark>, tags and entities removed", () => {
    expect(extractHighlightedText("a <mark>one &amp; <u>two</u></mark> b <mark>three</mark>")).toBe(
      "one & two three",
    );
    expect(extractHighlightedText("<p>no highlights</p>")).toBe("");
  });
});

describe("writeDebateCardBatch with the CARD_TEXT bucket", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
  });

  it("writes full text to R2 and keeps metadata and highlights in D1", async () => {
    const bucket = memoryBucket();
    const result = await writeDebateCardBatch(db, [card(7)], "cards-0000.parquet", bucket);
    expect(result).toMatchObject({ imported: 1, textInR2: 1 });

    const [row] = await db.select().from(debateCards);
    expect(row).toMatchObject({ id: 7, tag: "Tag 7", fulltext: "", markup: "", spoken: "text of 7" });
    expect(JSON.parse(bucket.objects.get(cardTextKey(7))!)).toEqual({
      fulltext: "Full text of card 7",
      markup: card(7).markup,
    });

    const [hydrated] = await hydrateCardText([row], bucket);
    expect(hydrated.fulltext).toBe("Full text of card 7");
    expect(hydrated.markup).toBe(card(7).markup);
  });

  it("keeps the text in D1 when no bucket is bound", async () => {
    const result = await writeDebateCardBatch(db, [card(7)], "cards-0000.parquet");
    expect(result.textInR2).toBe(0);
    const [row] = await db.select().from(debateCards);
    expect(row.fulltext).toBe("Full text of card 7");
  });
});

describe("moveCardTextPage", () => {
  it("moves existing text page by page, then reports done", async () => {
    const db = await freshDb();
    await db.insert(debateCards).values([
      card(1),
      card(2, { spoken: "already spoken" }),
      card(3, { fulltext: "", markup: "" }),
      card(4),
    ]);
    const bucket = memoryBucket();

    const first = await moveCardTextPage(db, bucket, 0, 2);
    expect(first).toMatchObject({ moved: 2, nextAfterId: 2, done: false });
    const second = await moveCardTextPage(db, bucket, first.nextAfterId, 2);
    // Card 3 has no text in D1, so only card 4 is left.
    expect(second).toMatchObject({ moved: 1, nextAfterId: 4, done: true });

    const rows = await db.select().from(debateCards).orderBy(asc(debateCards.id));
    expect(rows.map((row) => [row.fulltext, row.markup])).toEqual([
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
    ]);
    expect(rows.map((row) => row.spoken)).toEqual(["text of 1", "already spoken", "", "text of 4"]);
    expect([...bucket.objects.keys()].sort()).toEqual([cardTextKey(1), cardTextKey(2), cardTextKey(4)]);

    const hydrated = await hydrateCardText(rows, bucket);
    expect(hydrated.map((row) => row.fulltext)).toEqual([
      "Full text of card 1",
      "Full text of card 2",
      "",
      "Full text of card 4",
    ]);

    // A re-run finds nothing left to move.
    expect(await moveCardTextPage(db, bucket, 0, 2)).toMatchObject({ moved: 0, done: true });
  });
});
