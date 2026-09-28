import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { decodeCursor, insertForumThread, listForumThreads } from "@/lib/forums/queries";
import { parseFeedLimit, parseThreadBody, parseThreadTitle } from "@/lib/forums/validation";

/**
 * The forum feed, and the one way a thread is opened.
 *
 * GET  ?limit=&cursor= — a page of threads, most recently posted to first,
 *   each with its author and its live reply count, plus the viewer. Public: a
 *   signed-out reader gets the whole feed and no composer, and `viewerId` only
 *   decides who the form greets.
 * POST { title, body } — opens a thread. Account-only, 401 without a session,
 *   because a thread has to have an author whose name can be shown next to it.
 *
 * The replies are not this route's business: they are comments on the `comments`
 * table keyed on the thread's id, written and read through `/api/comments` with
 * `resourceType: "thread"`, which is what lets a forum reply reuse the whole
 * comment feature — nesting, likes, soft delete — rather than a second copy of
 * it. See `lib/forums/queries.ts`.
 */

export const GET = withRouteErrors(
  "GET /api/forums",
  async (req: NextRequest) => {
    const params = req.nextUrl.searchParams;

    const limit = parseFeedLimit(params.get("limit"));

    // A cursor that cannot be decoded is a bad request, not an empty feed: a
    // client that silently got page one back would show the same threads twice
    // and have no way to tell that its position was lost.
    const cursor = decodeCursor(params.get("cursor"));
    if (!cursor.ok) {
      return NextResponse.json({ error: cursor.error }, { status: 400 });
    }

    const db = await getDBFromContext();
    // A session lookup that throws must not take a public read down with it:
    // an anonymous reader is a normal reader, not a failed request.
    const viewerId = await getUserId().catch(() => null);

    const feed = await listForumThreads(db, { limit, cursor: cursor.value, viewerId });

    return NextResponse.json(feed);
  },
);

export const POST = withRouteErrors(
  "POST /api/forums",
  async (req: NextRequest) => {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to start a thread." }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const raw = (payload ?? {}) as Record<string, unknown>;

    // Checked in a fixed order, so the first thing wrong with a request is the
    // first thing the caller is told about — a missing title, rather than the
    // empty body further down the same object.
    const title = parseThreadTitle(raw.title);
    if (!title.ok) {
      return NextResponse.json({ error: title.error }, { status: 400 });
    }
    const body = parseThreadBody(raw.body);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: 400 });
    }

    const db = await getDBFromContext();
    const thread = await insertForumThread(db, {
      title: title.value,
      body: body.value,
      authorId: userId,
      id: crypto.randomUUID(),
    });

    return NextResponse.json(thread, { status: 201 });
  },
);
