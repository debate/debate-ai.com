/**
 * The school directory in D1, against a real in-memory SQLite database.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import {
  getSchoolDirectoryEntry,
  getSchoolDirectoryReport,
  rebuildSchoolDirectory,
  runDailySchoolDirectoryRefresh,
  type SchoolDirectorySources,
} from "../school-directory-store";
import { saveSchoolSeasonBuild, saveSchoolSeasonNames } from "../school-season-store";

const db = drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Parameters<typeof rebuildSchoolDirectory>[0];
const NOW = new Date("2026-11-21T12:00:00Z");

const sources = (backfillNames = vi.fn(async () => undefined)): SchoolDirectorySources => ({
  current: async (id) => (id === "cpd" ? [{ school: "Binghamton" }] : id === "hspf" ? [{ school: "Walter Payton" }] : []),
  college: async (year) => (year === 2019 ? [{ school: "State University of New York - Binghamton" }] : []),
  backfillNames,
});

describe("school directory", () => {
  it("lists every school of the last ten seasons under one handle, with gaps flagged", async () => {
    await saveSchoolSeasonBuild(db, "hspf", 2020, new Map([["the-harker-school-ca", []], ["harker-hs", []]]));
    await saveSchoolSeasonNames(db, "hspf", 2020, new Map([["the-harker-school-ca", "The Harker School (CA)"]]));
    // A season older than ten seasons is left out.
    await saveSchoolSeasonBuild(db, "hspf", 2015, new Map([["old-school", []]]));
    const backfill = vi.fn(async () => undefined);
    const count = await rebuildSchoolDirectory(db, { now: NOW, sources: sources(backfill) });
    expect(count).toBe(4);

    expect(await getSchoolDirectoryEntry(db, "state-university-of-new-york-binghamton")).toMatchObject({
      handle: "binghamton",
      name: "Binghamton",
      level: "college",
      ranked: true,
      firstYear: 2019,
    });
    const harker = await getSchoolDirectoryEntry(db, "the-harker-school-ca");
    expect(harker).toMatchObject({ name: "The Harker School (CA)", level: "highSchool", ranked: false });

    const report = await getSchoolDirectoryReport(db);
    expect(report.total).toBe(4);
    expect(report.missing.find((e) => e.handle === "harker-hs")?.missing).toEqual(["name", "logo"]);
    expect(await getSchoolDirectoryEntry(db, "old-school")).toBeNull();
  });

  it("asks for names of built seasons that have none", async () => {
    await saveSchoolSeasonBuild(db, "hsld", 2024, new Map([["lexington", []]]));
    const backfill = vi.fn(async (d: typeof db, format: string, year: number) => {
      await saveSchoolSeasonNames(d, format as "hsld", year, new Map([["lexington", "Lexington"]]));
    });
    await rebuildSchoolDirectory(db, { now: NOW, sources: sources(backfill) });
    expect(backfill).toHaveBeenCalledWith(db, "hsld", 2024);
    expect((await getSchoolDirectoryEntry(db, "lexington"))?.name).toBe("Lexington");
  });

  it("rebuilds once a day", async () => {
    await db.run(sql`DELETE FROM school_directory`);
    expect(await runDailySchoolDirectoryRefresh(db, { now: NOW, sources: sources() })).toBeGreaterThan(0);
    expect(await runDailySchoolDirectoryRefresh(db, { now: new Date(NOW.getTime() + 60_000), sources: sources() })).toBeNull();
  });
});
