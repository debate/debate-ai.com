/**
 * @fileoverview `stripTournamentYears` against a real in-memory SQLite
 * database: every saved tournament name in the library and the resync queue
 * loses its year, names without one are left alone, and a re-run is a no-op.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videos, youtubeRoundVideos } from "../../database/schema";
import { planTournamentRenames, stripTournamentYears } from "../strip-tournament-years";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

type Db = Awaited<ReturnType<typeof freshDb>>;
let db: Db;

beforeEach(async () => {
  db = await freshDb();
});

async function tournaments(db: Db) {
  const rows = await db.select({ id: videos.videoId, tournament: videos.tournament }).from(videos);
  return Object.fromEntries(rows.map((row) => [row.id, row.tournament]));
}

describe("planTournamentRenames", () => {
  it("lists only names that hold a year", () => {
    expect(
      planTournamentRenames("videos", [
        { tournament: "2024 TOC", rows: 3 },
        { tournament: "TOC", rows: 2 },
        { tournament: null, rows: 9 },
        { tournament: "Wake Forest 2009", rows: 1 },
      ]),
    ).toEqual([
      { table: "videos", from: "2024 TOC", to: "TOC", rows: 3 },
      { table: "videos", from: "Wake Forest 2009", to: "Wake Forest", rows: 1 },
    ]);
  });
});

describe("stripTournamentYears", () => {
  it("removes the year from every saved tournament name in both tables", async () => {
    await db.insert(videos).values([
      { videoId: "a", source: "round", tournament: "2024 TOC" },
      { videoId: "b", source: "round", tournament: "2024 TOC" },
      { videoId: "c", source: "round", tournament: "Wake Forest 2009" },
      { videoId: "d", source: "round", tournament: "Glenbrooks" },
      { videoId: "e", source: "lecture", tournament: null },
      { videoId: "f", source: "round", tournament: "2019", adminEdited: true },
    ] as any);
    await db.insert(youtubeRoundVideos).values({
      id: "q",
      title: "2023 Harvard Finals: A vs B",
      publishedAt: "2023-02-20",
      channel: "x",
      style: 1,
      tournament: "2023 Harvard",
    } as any);

    const result = await stripTournamentYears(db);
    expect(result).toMatchObject({ renamed: 4, rows: 5, remaining: 0 });

    expect(await tournaments(db)).toEqual({
      a: "TOC",
      b: "TOC",
      c: "Wake Forest",
      d: "Glenbrooks",
      e: null,
      f: null,
    });
    const [queued] = await db.select().from(youtubeRoundVideos);
    expect(queued?.tournament).toBe("Harvard");

    expect(await stripTournamentYears(db)).toMatchObject({ renamed: 0, rows: 0, remaining: 0 });
  });
});
