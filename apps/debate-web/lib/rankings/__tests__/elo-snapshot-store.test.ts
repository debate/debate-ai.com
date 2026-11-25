/**
 * The monthly Elo snapshots in D1, against a real in-memory SQLite database.
 */
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it, vi } from "vitest";
import type { RankingEntry } from "@debate-ai/rankings/src/types";
import * as schema from "../../database/schema";
import {
  ELO_SNAPSHOT_JOB,
  clearEloHistoryMonthsCache,
  readEloHistory,
  runMonthlyEloSnapshot,
} from "../elo-snapshot-store";

const db = drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Parameters<
  typeof runMonthlyEloSnapshot
>[0];
const at = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 6) / 1000;
const entries = (rating: number, rank: number) => [{ school: "Harker", name: "Lee & Kim", rank, adjustedRating: rating }] as RankingEntry[];
const all = (query: ReturnType<typeof sql>) => (db as unknown as { all: (q: unknown) => Promise<unknown[]> }).all(query);

describe("monthly Elo snapshots", () => {
  it("saves each month once, on its first run, and never overwrites a past month", async () => {
    const source = vi.fn(async () => entries(9.5, 2));
    const nov = await runMonthlyEloSnapshot(db, source, at(2026, 11, 1));
    expect(nov?.month).toBe("2026-11");
    expect(nov?.saved.map((s) => s.dataset)).toEqual(["hspf", "hsld", "hsld_sepoct", "hscx", "cpd"]);

    // Later November runs only read.
    source.mockClear();
    expect(await runMonthlyEloSnapshot(db, async () => entries(1, 99), at(2026, 11, 2))).toBeNull();
    expect(source).not.toHaveBeenCalled();

    // December's first run saves December; November keeps its numbers.
    await runMonthlyEloSnapshot(db, async () => entries(10, 1), at(2026, 12, 1));
    clearEloHistoryMonthsCache();
    expect(await readEloHistory(db, "hspf", ["harker-lee-kim", "nobody"])).toEqual({
      "harker-lee-kim": [
        { month: "2026-11", rating: 9.5, rank: 2 },
        { month: "2026-12", rating: 10, rank: 1 },
      ],
    });

    // One scraper_log row per save.
    const log = (await all(sql`SELECT job, detail FROM scraper_log ORDER BY id`)) as { job: string; detail: string }[];
    expect(log).toHaveLength(2);
    expect(log[0]!.job).toBe(ELO_SNAPSHOT_JOB);
    expect(JSON.parse(log[0]!.detail).month).toBe("2026-11");
  });

  it("retries a dataset that failed to load, still as that month's snapshot", async () => {
    const source = vi.fn(async (id: string) => {
      if (id === "cpd") throw new Error("upstream down");
      return entries(8, 5);
    });
    const first = await runMonthlyEloSnapshot(db, source, at(2027, 1, 1));
    expect(first?.failed).toEqual(["cpd"]);
    const second = await runMonthlyEloSnapshot(db, async () => entries(8, 5), at(2027, 1, 2));
    expect(second?.saved.map((s) => s.dataset)).toEqual(["cpd"]);
    expect(await runMonthlyEloSnapshot(db, source, at(2027, 1, 3))).toBeNull();
  });
});
