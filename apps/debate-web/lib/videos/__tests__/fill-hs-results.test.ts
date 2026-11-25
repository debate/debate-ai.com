/**
 * @fileoverview `fillHsResults` against a real in-memory SQLite `videos`
 * table, with Tabroom stubbed: one TOC policy final, decided 2-1 on the neg.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TABROOM_API } from "@debate-ai/videos-admin/src/lib/hs-results";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videos } from "../../database/schema";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

type Db = Awaited<ReturnType<typeof freshDb>>;

const ballots = (votes: Record<string, string>) =>
  Object.fromEntries(Object.entries(votes).map(([judge, winloss]) => [judge, { winloss }]));

const ROUTES: Record<string, unknown> = {
  "/rest/tourns/34644/invite": { id: 34644, Events: [{ id: 1, abbr: "CX", name: "Policy Debate", type: "debate" }] },
  "/rest/tourns/34644/rounds": [{ id: 1012, type: "final", name: 12, label: "Finals", Event: { abbr: "CX" } }],
  "/pages/invite/34644/CX/12/results": {
    id: 1012,
    name: 12,
    label: "Finals",
    Event: { Settings: { affLabel: "Aff", negLabel: "Neg" } },
    Sections: {
      "77": {
        id: 77,
        Judges: { "1": { first: "Ann", last: "Lee" }, "2": { first: "Bo", last: "Kim" }, "3": { first: "Cy", last: "Diaz" } },
        Entries: {
          "1": { code: "Harker AB", name: "Able & Baker", side: "Aff", schoolName: "The Harker School", Ballots: ballots({ "1": "W", "2": "L", "3": "L" }) },
          "2": { code: "Westminster CD", name: "Cole & Dunn", side: "Neg", schoolName: "The Westminster Schools", Ballots: ballots({ "1": "L", "2": "W", "3": "W" }) },
        },
      },
    },
  },
};

function stubFetch() {
  return vi.fn(async (url: string | URL | Request) => {
    const path = String(url).slice(TABROOM_API.length);
    if (path.startsWith("/rest/tourns?")) {
      const offset = Number(new URLSearchParams(path.split("?")[1]).get("offset"));
      const list = offset > 0 ? [] : [{ id: 34644, name: "53rd Annual Tournament of Champions", start: "2025-04-25T12:00:00.000Z" }];
      return new Response(JSON.stringify(list), { status: 200 });
    }
    if (path in ROUTES) return new Response(JSON.stringify(ROUTES[path]), { status: 200 });
    return new Response("{}", { status: 404 });
  });
}

const round = (videoId: string, overrides: Partial<typeof videos.$inferInsert> = {}): typeof videos.$inferInsert => ({
  videoId,
  source: "round",
  title: videoId,
  publishedAt: "2025-05-01",
  style: 1,
  tournament: "TOC",
  seasonYear: 2025,
  roundLevel: "Finals",
  affTeam: "Harker AB",
  negTeam: "Westminster CD",
  ...overrides,
});

let db: Db;
let fillHsResults: typeof import("../fill-hs-results").fillHsResults;
let listHsResultRows: typeof import("../fill-hs-results").listHsResultRows;
beforeEach(async () => {
  vi.resetModules();
  ({ fillHsResults, listHsResultRows } = await import("../fill-hs-results"));
  db = await freshDb();
});

const row = async (id: string) => (await db.select().from(videos).where(eq(videos.videoId, id)))[0];

describe("fillHsResults", () => {
  it("saves the winner, ballots, judges and squirrels for high school rounds only", async () => {
    await db.insert(videos).values([
      round("final"),
      round("college", { style: 4 }),
      round("missing", { affTeam: "Glenbrook North XY" }),
    ]);
    const result = await fillHsResults(db, { fetchImpl: stubFetch() as unknown as typeof fetch, requestDelayMs: 0, now: 1_800_000_000 });
    expect(result).toMatchObject({ checked: 2, remaining: 0, total: 2, winnersFilled: 1, decisionsFilled: 1, statuses: { verified: 1, not_found: 1 } });
    expect(await row("final")).toMatchObject({
      affWin: false,
      judgeDecision: "2-1",
      resultsStatus: "verified",
      resultsJudges: "Ann Lee, Bo Kim, Cy Diaz",
      resultsSquirrels: "Ann Lee",
      resultsTournamentId: 34644,
      adminEdited: true,
    });
    expect((await row("college"))?.resultsCheckedAt).toBeNull();
    expect(await listHsResultRows(db, ["not_found"])).toMatchObject({ total: 1, rows: [{ videoId: "missing" }] });
  });
});
