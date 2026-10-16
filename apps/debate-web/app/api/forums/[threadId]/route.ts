import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getForumThread } from "@/lib/forums/queries";
import { parseThreadId } from "@debate/webview/lib/forums/validation";

/**
 * One forum thread: its title, its opening post whole (the feed sends only an
 * excerpt), its author, and how many replies are left to read.
 *
 * Public, and read without a session — a thread is as readable as the feed row
 * that links to it, and gating the body behind a sign-in that the list did not
 * ask for would just be a dead link.
 *
 * The replies are fetched separately, by the same `CommentSection` every other
 * discussion uses, against `resourceType: "thread"` and this id.
 */

export const GET = withRouteErrors(
  "GET /api/forums/[threadId]",
  async (_req: NextRequest, context: { params: Promise<{ threadId: string }> }) => {
    const { threadId } = await context.params;

    const parsed = parseThreadId(threadId);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const db = await getDBFromContext();
    const thread = await getForumThread(db, { threadId: parsed.value });

    // One answer for "no such thread" and "the author removed it": a reader
    // following an old link learns the same thing either way, and a removed
    // thread does not confirm it once existed.
    if (!thread) {
      return NextResponse.json({ error: "That thread no longer exists." }, { status: 404 });
    }

    return NextResponse.json(thread);
  },
);
