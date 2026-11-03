/**
 * Saved Extinction.GG season files, against a real in-memory SQLite database.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { readSavedExtinctionFile, saveExtinctionFile, splitBody } from "../extinction-store";

// One database for the file: the store creates its table once per isolate.
const db = drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Parameters<
  typeof readSavedExtinctionFile
>[0];

describe("splitBody", () => {
  it("splits into parts of the given size and keeps empty bodies as one part", () => {
    expect(splitBody("abcdefg", 3)).toEqual(["abc", "def", "g"]);
    expect(splitBody("", 3)).toEqual([""]);
  });
});

describe("extinction season store", () => {
  it("returns null for a file that was never saved", async () => {
    expect(await readSavedExtinctionFile(db, "teams", "HSPF2425.json")).toBeNull();
  });

  it("round-trips a body, including one split across many parts", async () => {
    const body = JSON.stringify({ attribution: "x", teams: "y".repeat(2_000_005) });
    await saveExtinctionFile(db, "teams", "HSPolicy2425.json", { status: 200, body });
    expect(await readSavedExtinctionFile(db, "teams", "HSPolicy2425.json")).toEqual({ status: 200, body });
  });

  it("saves a missing bid list as its status, and replaces an earlier copy", async () => {
    await saveExtinctionFile(db, "bids", "HSLD2223.json", { status: 200, body: "{}" });
    await saveExtinctionFile(db, "bids", "HSLD2223.json", { status: 403, body: "" });
    expect(await readSavedExtinctionFile(db, "bids", "HSLD2223.json")).toEqual({ status: 403, body: "" });
  });
});
