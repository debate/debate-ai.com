/**
 * @fileoverview The read and write side of Topic Sign-ups, over the
 * `topic_signups`, `topic_squads`, `topic_squad_members` and `topic_notes`
 * tables. The wire format and validation come from `debate-practice-rounds`'
 * `topic-signups/`; this file stores what the route accepts and shapes rows
 * into a {@link TopicBoardResponse}.
 *
 * Blocked accounts (either direction) are left out of every list the viewer
 * sees, as on the practice board.
 *
 * @module lib/topic-signups/store
 */

import { and, count, desc, eq, gte, inArray, max } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";
import {
  notifications,
  topicNotes,
  topicSignups,
  topicSquadMembers,
  topicSquads,
  user,
  type TopicNoteRow,
  type TopicSignupRow,
  type TopicSquadMemberRow,
  type TopicSquadRow,
} from "@/lib/database/schema";
import { topicSignupHref } from "@debate-ai/rankings/src/topics/topic-signup-link";
import type { ParsedTopicAction } from "@debate-ai/practice-rounds/src/topic-signups/validation";
import {
  MAX_NOTES_PER_DAY,
  MAX_SQUAD_MEMBERS,
  MAX_SQUADS_PER_TOPIC,
  type ActiveTopic,
  type TopicBoardResponse,
  type TopicNoteKind,
  type TopicPerson,
  type TopicRef,
  type TopicSignup,
  type TopicSignupRole,
  type TopicSignupSide,
} from "@debate-ai/practice-rounds/src/topic-signups/types";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Most of each list one board read returns. */
const LIST_LIMIT = 200;
/** How many boards the no-topic read lists. */
const ACTIVE_LIMIT = 20;

/** A write the route should refuse, with its HTTP status. */
export class TopicActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const seconds = (value: Date | null | undefined): number => (value ? Math.floor(value.getTime() / 1000) : 0);

async function people(db: Db, ids: Iterable<string>): Promise<Map<string, TopicPerson>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows: { id: string; name: string; image: string | null }[] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, unique));
  return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, imageUrl: row.image ?? null }]));
}

const unknownPerson = (id: string): TopicPerson => ({ id, name: "Former member", imageUrl: null });

function toSignup(row: TopicSignupRow, person: TopicPerson): TopicSignup {
  return {
    id: row.id,
    person,
    role: row.role as TopicSignupRole,
    side: row.side as TopicSignupSide,
    note: row.note,
    format: row.format,
    createdAt: seconds(row.createdAt),
  };
}

/** Everything the board draws for one topic. */
export async function loadTopicBoard(
  db: Db,
  topic: TopicRef,
  viewer: TopicPerson & { isAnonymous: boolean },
  blocked: Set<string>,
): Promise<TopicBoardResponse> {
  const [signupRows, squadRows, noteRows]: [TopicSignupRow[], TopicSquadRow[], TopicNoteRow[]] = await Promise.all([
    db
      .select()
      .from(topicSignups)
      .where(eq(topicSignups.topicKey, topic.key))
      .orderBy(desc(topicSignups.updatedAt))
      .limit(LIST_LIMIT),
    db
      .select()
      .from(topicSquads)
      .where(eq(topicSquads.topicKey, topic.key))
      .orderBy(desc(topicSquads.createdAt))
      .limit(LIST_LIMIT),
    db
      .select()
      .from(topicNotes)
      .where(eq(topicNotes.topicKey, topic.key))
      .orderBy(desc(topicNotes.createdAt))
      .limit(LIST_LIMIT),
  ]);
  const memberRows: TopicSquadMemberRow[] = squadRows.length
    ? await db
        .select()
        .from(topicSquadMembers)
        .where(
          inArray(
            topicSquadMembers.squadId,
            squadRows.map((s) => s.id),
          ),
        )
    : [];

  const visible = (id: string) => !blocked.has(id);
  const byId = await people(db, [
    ...signupRows.map((r) => r.userId),
    ...squadRows.map((r) => r.creatorId),
    ...memberRows.map((r) => r.userId),
    ...noteRows.map((r) => r.userId),
  ]);
  const person = (id: string) => byId.get(id) ?? unknownPerson(id);

  const mineRow = signupRows.find((r) => r.userId === viewer.id);
  const membersOf = new Map<string, string[]>();
  for (const m of [...memberRows].sort((a, b) => seconds(a.joinedAt) - seconds(b.joinedAt))) {
    membersOf.set(m.squadId, [...(membersOf.get(m.squadId) ?? []), m.userId]);
  }

  return {
    topic,
    viewer: { id: viewer.id, name: viewer.name, imageUrl: viewer.imageUrl, isGuest: viewer.isAnonymous },
    mine: mineRow ? toSignup(mineRow, person(mineRow.userId)) : null,
    signups: signupRows
      .filter((r) => r.userId !== viewer.id && visible(r.userId))
      .map((r) => toSignup(r, person(r.userId))),
    squads: squadRows
      .filter((r) => visible(r.creatorId))
      .map((r) => {
        const members = (membersOf.get(r.id) ?? []).filter(visible);
        return {
          id: r.id,
          name: r.name,
          about: r.about,
          creator: person(r.creatorId),
          members: members.map(person),
          joined: members.includes(viewer.id),
          createdAt: seconds(r.createdAt),
        };
      }),
    notes: noteRows
      .filter((r) => visible(r.userId))
      .map((r) => ({
        id: r.id,
        person: person(r.userId),
        kind: r.kind as TopicNoteKind,
        title: r.title,
        url: r.url,
        body: r.body,
        mine: r.userId === viewer.id,
        createdAt: seconds(r.createdAt),
      })),
  };
}

async function notify(db: Db, recipients: string[], title: string, body: string, topic: TopicRef): Promise<void> {
  const ids = [...new Set(recipients)].filter(Boolean);
  if (ids.length === 0) return;
  const now = new Date();
  const link = topicSignupHref({ text: topic.text, format: topic.format ?? undefined, source: topic.source ?? undefined });
  await db
    .insert(notifications)
    .values(ids.map((userId) => ({ userId, type: "topic_signup", title, body, link, createdAt: now })));
}

/** Applies one write for `viewerId`. Throws {@link TopicActionError} for a refusal. */
export async function applyTopicAction(
  db: Db,
  { topic, action }: ParsedTopicAction,
  viewer: TopicPerson,
): Promise<void> {
  const now = new Date();
  const topicCols = { topicKey: topic.key, topicText: topic.text, format: topic.format, source: topic.source };

  switch (action.action) {
    case "signup": {
      await db
        .insert(topicSignups)
        .values({
          id: crypto.randomUUID(),
          ...topicCols,
          userId: viewer.id,
          role: action.role,
          side: action.side,
          note: action.note,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [topicSignups.topicKey, topicSignups.userId],
          set: { role: action.role, side: action.side, note: action.note, updatedAt: now },
        });
      return;
    }
    case "withdraw": {
      await db.delete(topicSignups).where(and(eq(topicSignups.topicKey, topic.key), eq(topicSignups.userId, viewer.id)));
      return;
    }
    case "create-squad": {
      const [{ n }]: { n: number }[] = await db
        .select({ n: count() })
        .from(topicSquads)
        .where(and(eq(topicSquads.topicKey, topic.key), eq(topicSquads.creatorId, viewer.id)));
      if (n >= MAX_SQUADS_PER_TOPIC) {
        throw new TopicActionError(`You can start ${MAX_SQUADS_PER_TOPIC} squads per topic.`, 429);
      }
      const id = crypto.randomUUID();
      await db.insert(topicSquads).values({ id, ...topicCols, name: action.name, about: action.about, creatorId: viewer.id, createdAt: now });
      await db.insert(topicSquadMembers).values({ id: crypto.randomUUID(), squadId: id, userId: viewer.id, joinedAt: now });
      return;
    }
    case "join-squad": {
      const [squad]: TopicSquadRow[] = await db
        .select()
        .from(topicSquads)
        .where(and(eq(topicSquads.id, action.squadId), eq(topicSquads.topicKey, topic.key)))
        .limit(1);
      if (!squad) throw new TopicActionError("That squad is gone.", 404);
      const members: TopicSquadMemberRow[] = await db.select().from(topicSquadMembers).where(eq(topicSquadMembers.squadId, squad.id));
      if (members.some((m) => m.userId === viewer.id)) return;
      if (members.length >= MAX_SQUAD_MEMBERS) throw new TopicActionError("That squad is full.", 409);
      await db
        .insert(topicSquadMembers)
        .values({ id: crypto.randomUUID(), squadId: squad.id, userId: viewer.id, joinedAt: now })
        .onConflictDoNothing();
      await notify(
        db,
        members.map((m) => m.userId),
        `${viewer.name} joined ${squad.name}`,
        `Your research squad on “${topic.text.slice(0, 120)}” has a new member.`,
        topic,
      );
      return;
    }
    case "leave-squad": {
      await db
        .delete(topicSquadMembers)
        .where(and(eq(topicSquadMembers.squadId, action.squadId), eq(topicSquadMembers.userId, viewer.id)));
      const [{ n }]: { n: number }[] = await db
        .select({ n: count() })
        .from(topicSquadMembers)
        .where(eq(topicSquadMembers.squadId, action.squadId));
      // The last one out closes the squad.
      if (n === 0) await db.delete(topicSquads).where(eq(topicSquads.id, action.squadId));
      return;
    }
    case "add-note": {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const [{ n }]: { n: number }[] = await db
        .select({ n: count() })
        .from(topicNotes)
        .where(and(eq(topicNotes.userId, viewer.id), gte(topicNotes.createdAt, since)));
      if (n >= MAX_NOTES_PER_DAY) {
        throw new TopicActionError(`You can add ${MAX_NOTES_PER_DAY} notes a day — come back tomorrow.`, 429);
      }
      await db.insert(topicNotes).values({
        id: crypto.randomUUID(),
        ...topicCols,
        userId: viewer.id,
        kind: action.kind,
        title: action.title,
        url: action.url,
        body: action.body,
        createdAt: now,
      });
      return;
    }
    case "delete-note": {
      await db.delete(topicNotes).where(and(eq(topicNotes.id, action.noteId), eq(topicNotes.userId, viewer.id)));
      return;
    }
  }
}

/** The most recently active boards, with their counts. */
type ActiveRow = { key: string; text: string | null; format: string | null; source: string | null; n: number; last: unknown };

export async function listActiveTopics(db: Db): Promise<ActiveTopic[]> {
  const [signups, squads, notes]: ActiveRow[][] = await Promise.all([
    db
      .select({
        key: topicSignups.topicKey,
        text: max(topicSignups.topicText),
        format: max(topicSignups.format),
        source: max(topicSignups.source),
        n: count(),
        last: max(topicSignups.updatedAt),
      })
      .from(topicSignups)
      .groupBy(topicSignups.topicKey)
      .orderBy(desc(max(topicSignups.updatedAt)))
      .limit(ACTIVE_LIMIT * 3),
    db
      .select({
        key: topicSquads.topicKey,
        text: max(topicSquads.topicText),
        format: max(topicSquads.format),
        source: max(topicSquads.source),
        n: count(),
        last: max(topicSquads.createdAt),
      })
      .from(topicSquads)
      .groupBy(topicSquads.topicKey)
      .orderBy(desc(max(topicSquads.createdAt)))
      .limit(ACTIVE_LIMIT * 3),
    db
      .select({
        key: topicNotes.topicKey,
        text: max(topicNotes.topicText),
        format: max(topicNotes.format),
        source: max(topicNotes.source),
        n: count(),
        last: max(topicNotes.createdAt),
      })
      .from(topicNotes)
      .groupBy(topicNotes.topicKey)
      .orderBy(desc(max(topicNotes.createdAt)))
      .limit(ACTIVE_LIMIT * 3),
  ]);

  const boards = new Map<string, ActiveTopic>();
  const add = (
    rows: ActiveRow[],
    field: "signups" | "squads" | "notes",
  ) => {
    for (const row of rows) {
      const board = boards.get(row.key) ?? {
        topic: { key: row.key, text: row.text ?? row.key, format: row.format, source: row.source },
        signups: 0,
        squads: 0,
        notes: 0,
        lastActive: 0,
      };
      board[field] = Number(row.n);
      const last = row.last instanceof Date ? seconds(row.last) : Number(row.last) || 0;
      board.lastActive = Math.max(board.lastActive, last);
      boards.set(row.key, board);
    }
  };
  add(signups, "signups");
  add(squads, "squads");
  add(notes, "notes");
  return [...boards.values()].sort((a, b) => b.lastActive - a.lastActive).slice(0, ACTIVE_LIMIT);
}
