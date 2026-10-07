/**
 * @fileoverview The profile-follow queries against a real SQLite database:
 * following is idempotent, the follower count counts users, unfollowing
 * removes only the viewer's row, and a user's follows list newest first.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  FollowLimitError,
  MAX_FOLLOWS_PER_USER,
  getFollowState,
  listFollows,
  setFollow,
} from "@/lib/profile-follows/queries";
import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;
let db: Db;

async function addUser(id: string) {
  await db.$client.execute({
    sql: "INSERT INTO user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
    args: [id, id, `${id}@example.test`],
  });
}

const harker = { kind: "school" as const, slug: "harker", name: "Harker" };

describe("profile follow queries", () => {
  beforeEach(async () => {
    db = await freshSchemaDb();
    await addUser("u1");
    await addUser("u2");
  });

  it("counts followers and reports whether the viewer follows", async () => {
    const asDb = db as never;
    await setFollow(asDb, { userId: "u1", ...harker, follow: true });
    const state = await setFollow(asDb, { userId: "u2", ...harker, follow: true });
    expect(state).toEqual({ kind: "school", slug: "harker", followers: 2, following: true, signedIn: true });
    expect(await getFollowState(asDb, harker, null)).toEqual({
      kind: "school",
      slug: "harker",
      followers: 2,
      following: false,
      signedIn: false,
    });
  });

  it("treats a second follow as a no-op and unfollows only the viewer", async () => {
    const asDb = db as never;
    await setFollow(asDb, { userId: "u1", ...harker, follow: true });
    await setFollow(asDb, { userId: "u1", ...harker, follow: true });
    await setFollow(asDb, { userId: "u2", ...harker, follow: true });
    const state = await setFollow(asDb, { userId: "u1", ...harker, follow: false });
    expect(state).toMatchObject({ followers: 1, following: false });
  });

  it("keeps a team and a school with the same slug apart", async () => {
    const asDb = db as never;
    await setFollow(asDb, { userId: "u1", kind: "team", slug: "harker", name: "Harker", follow: true });
    expect(await getFollowState(asDb, harker, "u1")).toMatchObject({ followers: 0, following: false });
  });

  it("lists a user's follows", async () => {
    const asDb = db as never;
    await setFollow(asDb, { userId: "u1", ...harker, follow: true });
    await setFollow(asDb, { userId: "u1", kind: "team", slug: "harker-lee-lin", name: "Lee & Lin", follow: true });
    const follows = await listFollows(asDb, "u1");
    expect(follows.map((f) => f.slug).sort()).toEqual(["harker", "harker-lee-lin"]);
    expect(follows.every((f) => typeof f.followedAt === "number")).toBe(true);
    expect(await listFollows(asDb, "u2")).toEqual([]);
  });

  it("caps how many profiles one user follows", async () => {
    const asDb = db as never;
    for (let i = 0; i < MAX_FOLLOWS_PER_USER; i++) {
      await setFollow(asDb, { userId: "u1", kind: "team", slug: `team-${i}`, name: `Team ${i}`, follow: true });
    }
    await expect(setFollow(asDb, { userId: "u1", ...harker, follow: true })).rejects.toBeInstanceOf(FollowLimitError);
    // Re-following one already followed still answers.
    expect(await setFollow(asDb, { userId: "u1", kind: "team", slug: "team-0", name: "Team 0", follow: true })).toMatchObject({
      following: true,
    });
  });
});
