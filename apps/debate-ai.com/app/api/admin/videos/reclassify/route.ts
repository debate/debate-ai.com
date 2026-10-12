import { NextResponse, type NextRequest } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { reclassifyVideosByTitle } from "@/lib/videos/reclassify-by-title";

/**
 * Re-files every published video whose title contains `match` under `style`,
 * and with `parseRoundInfo` re-runs the AI round-info extraction on each.
 *
 * Body: `{ match, style, parseRoundInfo?, after?, limit? }`. One page per
 * call; repeat with `after: nextCursor` until `nextCursor` is `null`. See
 * `lib/videos/reclassify-by-title.ts`.
 */
export async function POST(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const match = typeof body?.match === "string" ? body.match.trim() : "";
  if (match.length < 3) {
    return NextResponse.json({ error: "`match` must be at least 3 characters" }, { status: 400 });
  }
  const style = Number(body.style);
  if (![1, 2, 3, 4].includes(style)) {
    return NextResponse.json({ error: "`style` must be 1, 2, 3 or 4" }, { status: 400 });
  }

  try {
    const db = await getDBFromContext();
    const result = await reclassifyVideosByTitle(db, {
      match,
      style,
      parseRoundInfo: body.parseRoundInfo === true,
      after: typeof body.after === "string" ? body.after : null,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Failed to reclassify videos:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to reclassify videos", details: describeError(error) },
      { status: 500 },
    );
  }
}
