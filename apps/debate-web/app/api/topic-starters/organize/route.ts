/**
 * @fileoverview "Organize by argument": asks the model to sort every public
 * Topic Starter into `Aff`/`Neg` folders by argument type (Case, DA, CP, T,
 * K, …) and returns the result as a `reorganize` change, *without applying
 * it*. The sidebar shows the proposal and, on confirm, posts it to
 * `/api/topic-starters/changes` — applied for moderators, queued for review
 * for everyone else. See `lib/topic-starters/organize.ts`.
 *
 * @module app/api/topic-starters/organize/route
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  describeTopicStarterChange,
  planReorganize,
  type TopicStarterChange,
  type TopicTreeRow,
} from "@debate-ai/reason-docs/lib/topic-starters/changes";
import { resolveProviderKey } from "@/lib/ai/provider-key";
import { getSession } from "@/lib/auth/session";
import { getDBFromContext } from "@/lib/database/context";
import { topicStarterItems } from "@/lib/database/schema";
import { classifyTopicStarters } from "@/lib/topic-starters/organize";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to organize Topic Starters." }, { status: 401 });
  }
  const key = resolveProviderKey(request);
  if (!key) return NextResponse.json({ error: "AI features are not configured on the server." }, { status: 503 });

  const db = await getDBFromContext();
  const rows: TopicTreeRow[] = await db
    .select({
      id: topicStarterItems.id,
      title: topicStarterItems.title,
      parentId: topicStarterItems.parentId,
      isFolder: topicStarterItems.isFolder,
    })
    .from(topicStarterItems)
    .where(eq(topicStarterItems.published, true))
    .limit(5000);

  let assignments;
  try {
    assignments = await classifyTopicStarters(key, rows);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }

  const plan = planReorganize(rows, assignments);
  const moving = new Set(plan.moves.map((move) => move.itemId));
  const change: TopicStarterChange = {
    kind: "reorganize",
    assignments: assignments.filter((assignment) => moving.has(assignment.itemId)),
  };
  if (change.assignments.length === 0) {
    return NextResponse.json({ change: null, summary: "Every file is already in its argument folder.", moves: 0 });
  }
  const titles = new Map(rows.map((row) => [row.id, row.title]));
  return NextResponse.json({
    change,
    summary: describeTopicStarterChange(change, titles),
    moves: plan.moves.length,
  });
}
