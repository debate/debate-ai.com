/**
 * @fileoverview The topic-area poll queries against a real SQLite database:
 * one vote per user per season, a second vote replaces the first, and the
 * tally and the viewer's own pick come back right.
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

  it("tallies votes and reports the viewer's pick", async () => {
    const asDb = db as never;
    await castTopicAreaVote(asDb, { season: 2028, userId: "u1", area: "Nuclear Policy" });
    const poll = await castTopicAreaVote(asDb, { season: 2028, userId: "u2", area: "Nuclear Policy" });
    expect(poll).toEqual({ season: 2028, counts: { "Nuclear Policy": 2 }, total: 2, myVote: "Nuclear Policy", signedIn: true });
  });

  it("replaces a user's vote when they change it", async () => {
    const asDb = db as never;
    await castTopicAreaVote(asDb, { season: 2028, userId: "u1", area: "Nuclear Policy" });
    const poll = await castTopicAreaVote(asDb, { season: 2028, userId: "u1", area: "Environment & Climate" });
    expect(poll.counts).toEqual({ "Environment & Climate": 1 });
    expect(poll.total).toBe(1);
    expect(poll.myVote).toBe("Environment & Climate");
  });

  it("keeps seasons apart and shows a signed-out reader the tally only", async () => {
    const asDb = db as never;
    await castTopicAreaVote(asDb, { season: 2028, userId: "u1", area: "Nuclear Policy" });
    expect(await getTopicAreaPoll(asDb, 2029, "u1")).toMatchObject({ total: 0, myVote: null });
    expect(await getTopicAreaPoll(asDb, 2028, null)).toEqual({
      season: 2028,
      counts: { "Nuclear Policy": 1 },
      total: 1,
      myVote: null,
      signedIn: false,
    });
  });
});
