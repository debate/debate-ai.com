/**
 * @fileoverview The topic-area poll queries against a real SQLite database:
 * one ranked ballot per user per season, a second ballot replaces the
 * first, and the Borda tally and the viewer's own ballot come back right.
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
  });

  it("tallies ranked ballots by Borda points and reports the viewer's ballot", async () => {
    const asDb = db as never;
    await castTopicAreaVote(asDb, { season: 2028, userId: "u1", ranking: ["Nuclear Policy", "Environment & Climate"] });
    const poll = await castTopicAreaVote(asDb, { season: 2028, userId: "u2", ranking: ["Environment & Climate"] });
    expect(poll).toEqual({
      season: 2028,
      points: { "Nuclear Policy": 5, "Environment & Climate": 9 },
      firstChoices: { "Nuclear Policy": 1, "Environment & Climate": 1 },
      total: 2,
      myRanking: ["Environment & Climate"],
      signedIn: true,
    });
  });

  it("replaces a user's whole ballot when they change it", async () => {
    const asDb = db as never;
    await castTopicAreaVote(asDb, { season: 2028, userId: "u1", ranking: ["Nuclear Policy", "Environment & Climate"] });
    const poll = await castTopicAreaVote(asDb, { season: 2028, userId: "u1", ranking: ["Environment & Climate"] });
    expect(poll.points).toEqual({ "Environment & Climate": 5 });
    expect(poll.total).toBe(1);
    expect(poll.myRanking).toEqual(["Environment & Climate"]);
  });

  it("keeps seasons apart and shows a signed-out reader the tally only", async () => {
    const asDb = db as never;
    await castTopicAreaVote(asDb, { season: 2028, userId: "u1", ranking: ["Nuclear Policy"] });
    expect(await getTopicAreaPoll(asDb, 2029, "u1")).toMatchObject({ total: 0, myRanking: [] });
    expect(await getTopicAreaPoll(asDb, 2028, null)).toEqual({
      season: 2028,
      points: { "Nuclear Policy": 5 },
      firstChoices: { "Nuclear Policy": 1 },
      total: 1,
      myRanking: [],
      signedIn: false,
    });
  });
});
