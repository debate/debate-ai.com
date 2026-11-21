/**
 * The 90-day rank baselines in D1, against a real in-memory SQLite database.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { readRankBaseline, runRankBaselineCapture, saveRankBaseline } from "../rank-baseline-store";

const db = drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Parameters<typeof readRankBaseline>[0];
const DAY = 24 * 60 * 60;
const T0 = 1_800_000_000;

describe("rank baselines", () => {
  it("saves each list once per 90 days and serves the newest save a day old", async () => {
    const teams = vi.fn(async () => [{ rank: 1, school: "Harker", name: "Lee & Kim" }]);
    const first = await runRankBaselineCapture(db, { teams }, T0);
    expect(first).toContain("team:hspf");
    // A fresh save is not used yet: the column falls back to last season.
    expect(await readRankBaseline(db, "team:hspf", T0 + 60)).toBeNull();
    expect(await readRankBaseline(db, "team:hspf", T0 + DAY)).toMatchObject({
      capturedAt: T0,
      rows: [{ rank: 1, school: "Harker", name: "Lee & Kim" }],
    });

    teams.mockClear();
    expect(await runRankBaselineCapture(db, { teams }, T0 + 30 * DAY)).toEqual([]);
    expect(teams).not.toHaveBeenCalled();

    await runRankBaselineCapture(db, { teams: async () => [{ rank: 2, school: "Harker", name: "Lee & Kim" }] }, T0 + 90 * DAY);
    expect((await readRankBaseline(db, "team:hspf", T0 + 91 * DAY))?.capturedAt).toBe(T0 + 90 * DAY);
  });

  it("keeps the last three saves", async () => {
    for (let i = 0; i < 5; i++) await saveRankBaseline(db, "school:VPF", [{ rank: i + 1, school: "X" }], T0 + i * 100 * DAY);
    const rows = (await (db as unknown as { all: (q: unknown) => Promise<unknown[]> }).all(
      (await import("drizzle-orm")).sql`SELECT captured_at FROM rank_baselines WHERE scope = 'school:VPF'`,
    )) as unknown[];
    expect(rows).toHaveLength(3);
  });
});
