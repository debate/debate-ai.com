/**
 * @fileoverview The topic-area poll queries against a real SQLite database:
 * one ranked ballot per user per season, a second ballot replaces the
 * first, and the Borda tally (overall and per format) and the viewer's own
 * ballot come back right.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { castTopicAreaVote, getTopicAreaPoll } from "@/lib/topic-area-poll/queries";
import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;
let db: Db;

async function addUser(id: string) {
  await db.$client.execute({
    sql: "INSERT INTO user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
    args: [id, id, `${id}@example.test`],
  });
}

describe("topic-area poll queries", () => {
  beforeEach(async () => {
    db = await freshSchemaDb();
    await addUser("u1");
    await addUser("u2");
    await addUser("u3");
  });

  it("tallies ranked ballots by Borda points, overall and by format, and reports the viewer's ballot", async () => {
    const asDb = db as never;
    await castTopicAreaVote(asDb, { season: 2028, userId: "u1", format: "ld", ranking: ["Nuclear Policy", "Environment & Climate"] });
    const poll = await castTopicAreaVote(asDb, { season: 2028, userId: "u2", format: "pf", ranking: ["Environment & Climate"] });
    expect(poll).toEqual({
      season: 2028,
      points: { "Nuclear Policy": 5, "Environment & Climate": 9 },
      firstChoices: { "Nuclear Policy": 1, "Environment & Climate": 1 },
      total: 2,
      byFormat: {
        ld: { points: { "Nuclear Policy": 5, "Environment & Climate": 4 }, firstChoices: { "Nuclear Policy": 1 }, total: 1 },
        pf: { points: { "Environment & Climate": 5 }, firstChoices: { "Environment & Climate": 1 }, total: 1 },
      },
      myRanking: ["Environment & Climate"],
      myFormat: "pf",
      signedIn: true,
    });
  });

  it("replaces a user's whole ballot, format included, when they change it", async () => {
    const asDb = db as never;
    await castTopicAreaVote(asDb, { season: 2028, userId: "u1", format: "ld", ranking: ["Nuclear Policy", "Environment & Climate"] });
    const poll = await castTopicAreaVote(asDb, { season: 2028, userId: "u1", format: "policy", ranking: ["Environment & Climate"] });
    expect(poll.points).toEqual({ "Environment & Climate": 5 });
    expect(poll.total).toBe(1);
    expect(poll.byFormat).toEqual({ policy: { points: { "Environment & Climate": 5 }, firstChoices: { "Environment & Climate": 1 }, total: 1 } });
    expect(poll.myRanking).toEqual(["Environment & Climate"]);
    expect(poll.myFormat).toBe("policy");
  });

  it("counts old ballots under the renamed areas, overall only when they name no format", async () => {
    for (const [rank, area] of [[1, "Housing & Welfare"], [2, "Inequality, Welfare & Redistribution"], [3, "Nuclear Policy"]] as const) {
      await db.$client.execute({
        sql: "INSERT INTO topic_area_rankings (season, user_id, rank, area) VALUES (2028, 'u3', ?, ?)",
        args: [rank, area],
      });
    }
    const poll = await getTopicAreaPoll(db as never, 2028, "u3");
    expect(poll.points).toEqual({ "Poverty, Welfare & Housing": 5, "Nuclear Policy": 4 });
    expect(poll.byFormat).toEqual({});
    expect(poll.myRanking).toEqual(["Poverty, Welfare & Housing", "Nuclear Policy"]);
    expect(poll.myFormat).toBeNull();
  });

  it("keeps seasons apart and shows a signed-out reader the tally only", async () => {
    const asDb = db as never;
    await castTopicAreaVote(asDb, { season: 2028, userId: "u1", format: "ndt", ranking: ["Nuclear Policy"] });
    expect(await getTopicAreaPoll(asDb, 2029, "u1")).toMatchObject({ total: 0, myRanking: [], myFormat: null });
    expect(await getTopicAreaPoll(asDb, 2028, null)).toEqual({
      season: 2028,
      points: { "Nuclear Policy": 5 },
      firstChoices: { "Nuclear Policy": 1 },
      total: 1,
      byFormat: { ndt: { points: { "Nuclear Policy": 5 }, firstChoices: { "Nuclear Policy": 1 }, total: 1 } },
      myRanking: [],
      myFormat: null,
      signedIn: false,
    });
  });
});
