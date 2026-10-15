/**
 * @fileoverview Reads and writes team and school follows over the
 * `profile_follows` table. A follow is one row per (user, kind, slug), so
 * following twice is a no-op and the follower count is a count of rows.
 *
 * @module lib/profile-follows/queries
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type {
  FollowKind,
  FollowState,
  ProfileFollow,
} from "@debate/videos/src/lib/follows/profile-follows";

import type { getDBFromContext } from "@/lib/database/context";
import { profileFollows } from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Most follows one user can hold; keeps the news feed's per-follow lookups bounded. */
export const MAX_FOLLOWS_PER_USER = 50;

/** Follower count of one profile, and whether `userId` is among them. */
export async function getFollowState(
  db: Db,
  { kind, slug }: { kind: FollowKind; slug: string },
  userId: string | null,
): Promise<FollowState> {
  const target = and(eq(profileFollows.kind, kind), eq(profileFollows.slug, slug));
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(profileFollows)
    .where(target);

  let following = false;
  if (userId) {
    const [mine] = await db
      .select({ slug: profileFollows.slug })
      .from(profileFollows)
      .where(and(target, eq(profileFollows.userId, userId)))
      .limit(1);
    following = Boolean(mine);
  }

  return { kind, slug, followers: Number(count), following, signedIn: userId !== null };
}

/** Thrown when a user already follows {@link MAX_FOLLOWS_PER_USER} profiles. */
export class FollowLimitError extends Error {
  constructor() {
    super(`You can follow up to ${MAX_FOLLOWS_PER_USER} teams and schools.`);
  }
}

/** Follows or unfollows a profile for `userId`; answers with its new state. */
export async function setFollow(
  db: Db,
  { userId, kind, slug, name, follow }: { userId: string; kind: FollowKind; slug: string; name: string; follow: boolean },
): Promise<FollowState> {
  if (follow) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(profileFollows)
      .where(eq(profileFollows.userId, userId));
    if (Number(count) >= MAX_FOLLOWS_PER_USER) {
      const current = await getFollowState(db, { kind, slug }, userId);
      if (!current.following) throw new FollowLimitError();
      return current;
    }
    await db
      .insert(profileFollows)
      .values({ userId, kind, slug, name })
      .onConflictDoUpdate({
        target: [profileFollows.userId, profileFollows.kind, profileFollows.slug],
        set: { name },
      });
  } else {
    await db
      .delete(profileFollows)
      .where(
        and(eq(profileFollows.userId, userId), eq(profileFollows.kind, kind), eq(profileFollows.slug, slug)),
      );
  }
  return getFollowState(db, { kind, slug }, userId);
}

/** Every profile `userId` follows, newest first. */
export async function listFollows(db: Db, userId: string): Promise<ProfileFollow[]> {
  const rows = await db
    .select({
      kind: profileFollows.kind,
      slug: profileFollows.slug,
      name: profileFollows.name,
      createdAt: profileFollows.createdAt,
    })
    .from(profileFollows)
    .where(eq(profileFollows.userId, userId))
    .orderBy(desc(profileFollows.createdAt))
    .limit(MAX_FOLLOWS_PER_USER);
  return rows.map((row: { kind: string; slug: string; name: string; createdAt: Date }) => ({
    kind: row.kind as FollowKind,
    slug: row.slug,
    name: row.name,
    followedAt: row.createdAt.getTime(),
  }));
}
