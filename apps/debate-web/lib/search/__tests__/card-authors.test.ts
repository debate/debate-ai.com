import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import { applySchema } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";
import { debateCards } from "@/lib/database/schema";
import { ensureCardSortIndexes } from "../card-search-indexes";
import {
  commonSurnamesStartingWith,
  lastNameFromCiteToken,
  rankLastNames,
  suggestAuthorLastNames,
} from "../card-authors";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

describe("lastNameFromCiteToken", () => {
  it("strips trailing punctuation", () => {
    expect(lastNameFromCiteToken("Chilton,")).toBe("Chilton");
    expect(lastNameFromCiteToken("O'Brien")).toBe("O'Brien");
    expect(lastNameFromCiteToken("Smith-Jones")).toBe("Smith-Jones");
  });

  it("rejects years, initials and empty tokens", () => {
    expect(lastNameFromCiteToken("2018")).toBeNull();
    expect(lastNameFromCiteToken("J.")).toBeNull();
    expect(lastNameFromCiteToken("")).toBeNull();
  });
});

describe("rankLastNames", () => {
  it("merges spellings differing in case, ranks by card count and keeps the commonest spelling", () => {
    const ranked = rankLastNames(
      [
        { token: "SMITH", cards: 2 },
        { token: "Smith", cards: 5 },
        { token: "Smith,", cards: 1 },
        { token: "Smithson", cards: 6 },
        { token: "2019", cards: 99 },
      ],
      10,
    );
    expect(ranked).toEqual(["Smith", "Smithson"]);
  });

  it("honours the limit", () => {
    const rows = ["Aa", "Ab", "Ac"].map((token) => ({ token, cards: 1 }));
    expect(rankLastNames(rows, 2)).toEqual(["Aa", "Ab"]);
  });
});

describe("commonSurnamesStartingWith", () => {
  it("capitalises surnames beginning with the prefix", () => {
    const names = commonSurnamesStartingWith("john", 5);
    expect(names).toContain("Johnston");
    expect(names.every((name) => /^John/.test(name))).toBe(true);
  });
});

describe("suggestAuthorLastNames", () => {
  async function seeded() {
    const db = await freshDb();
    await ensureCardSortIndexes(db);
    await db.insert(debateCards).values([
      { id: 1, tag: "a", cite: "Chilton 18" },
      { id: 2, tag: "b", cite: "Chilton 19" },
      { id: 3, tag: "c", cite: "Chin 20" },
      { id: 4, tag: "d", cite: "chilton 21" },
      { id: 5, tag: "e", cite: "Peterson 14" },
      { id: 6, tag: "f", cite: "Chen, 22" },
    ]);
    return db;
  }

  it("lists last names under a prefix, most-carded first", async () => {
    const db = await seeded();
    expect(await suggestAuthorLastNames(db, "ch", 10)).toEqual(["Chilton", "Chen", "Chin"]);
  });

  it("completes a full last name to itself", async () => {
    const db = await seeded();
    expect(await suggestAuthorLastNames(db, "Peterson", 10)).toEqual(["Peterson"]);
  });

  it("answers nothing for a single letter or an unknown name", async () => {
    const db = await seeded();
    expect(await suggestAuthorLastNames(db, "C", 10)).toEqual([]);
    expect(await suggestAuthorLastNames(db, "Zz", 10)).toEqual([]);
  });
});
