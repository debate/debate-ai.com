import { NextResponse } from "next/server";
import {
  describeSuggestionWait,
  parseReferenceSuggestion,
} from "@debate-ai/help-docs/lib/reference-suggestions";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getUserId } from "@/lib/auth/session";
import { getDBFromContext } from "@/lib/database/context";
import {
  ensureSuggestionsTable,
  hashClientAddress,
  insertSuggestion,
  isReferenceFull,
  referenceSuggestionState,
  suggestionWaitSeconds,
} from "@/lib/reference-suggestions/store";

/** A request body past this is refused unread: the longest valid suggestion is well under it. */
const MAX_BODY_BYTES = 128 * 1024;

/**
 * Suggested card text for a References entry whose quote is missing, from the
 * red X / ellipsis icon on the journal References pages.
 *
 * POST { page, refId, title?, text, website? } — stores the text
 * for the admin page's Reference text tab. Open to signed-out visitors. Each
 * sender (client address or account) may send 5 an hour and 20 a day: past
 * that the answer is 429 with `retryAfter` (seconds) and a `Retry-After`
 * header. `website` is a honeypot; a bot that fills it is told it worked and
 * nothing is stored.
 */
export const POST = withRouteErrors("POST /api/reference-quote-suggestions", async (request: Request) => {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "That suggestion is too large." }, { status: 413 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "That suggestion is too large." }, { status: 413 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }

  const parsed = parseReferenceSuggestion(body);
  if (!parsed.ok) {
    if (parsed.honeypot) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const db = await getDBFromContext();
  await ensureSuggestionsTable(db);

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const sender = {
    ipHash: await hashClientAddress(ip),
    userId: await getUserId().catch(() => null),
    userAgent: request.headers.get("user-agent"),
  };

  const wait = await suggestionWaitSeconds(db, sender);
  if (wait > 0) {
    return NextResponse.json(
      {
        error: `Thanks — you have sent a lot of suggestions. You can send more ${describeSuggestionWait(wait)}.`,
        retryAfter: wait,
      },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const { page, refId, text } = parsed.value;
  const state = await referenceSuggestionState(db, page, refId, text);
  // The same text for the same entry is already in the queue: thank them, store nothing.
  if (state.duplicate) return NextResponse.json({ ok: true });
  if (isReferenceFull(state.pending)) {
    return NextResponse.json(
      { error: "This reference already has several suggestions waiting for review. Try again later." },
      { status: 429, headers: { "Retry-After": "86400" } },
    );
  }

  await insertSuggestion(db, parsed.value, sender);
  return NextResponse.json({ ok: true });
});
