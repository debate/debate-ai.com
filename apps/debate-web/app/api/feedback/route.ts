import { NextResponse } from "next/server";
import { describeFeedbackWait, parseFeedback } from "@debate-ai/webview/lib/feedback/feedback";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getUserId } from "@/lib/auth/session";
import { getDBFromContext } from "@/lib/database/context";
import {
  ensureFeedbackTable,
  feedbackWaitSeconds,
  hashClientAddress,
  insertFeedback,
} from "@/lib/feedback/store";

/**
 * Site feedback from the Settings footer's Feedback dialog.
 *
 * POST { email, message, page? } — stores the message for the admin page's
 * Feedback tab. Open to signed-out visitors. One submission an hour per client
 * address, account and email address: a second one inside the hour gets 429
 * with `retryAfter` (seconds) and a `Retry-After` header.
 */
export const POST = withRouteErrors("POST /api/feedback", async (request: Request) => {
  const parsed = parseFeedback(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = await getDBFromContext();
  await ensureFeedbackTable(db);

  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const sender = {
    ipHash: await hashClientAddress(ip),
    userId: await getUserId().catch(() => null),
    userAgent: request.headers.get("user-agent"),
  };

  const wait = await feedbackWaitSeconds(db, parsed.value.email, sender);
  if (wait > 0) {
    return NextResponse.json(
      {
        error: `Thanks — we already have feedback from you this hour. You can send more ${describeFeedbackWait(wait)}.`,
        retryAfter: wait,
      },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  await insertFeedback(db, parsed.value, sender);
  return NextResponse.json({ ok: true });
});
