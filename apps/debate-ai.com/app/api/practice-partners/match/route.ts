import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { withRouteErrors } from "@/lib/api/route-errors";
import {
  getProfile,
  getViewer,
  listPendingOpponentIds,
  listVolunteers,
  loadBlockedIds,
} from "@/lib/practice-partners/queries";
import { matchTokenSecret, openMatchToken, sealMatchToken } from "@/lib/practice-partners/match-token";
import { pickPracticeMatch } from "@debate/webview/lib/practice-partners/match";
import { isPracticeFormat } from "@debate/webview/lib/practice-partners/validation";
import {
  MAX_MATCH_EXCLUDES,
  type FindMatchResponse,
} from "@debate/webview/lib/practice-partners/types";

/**
 * Finds one practice partner for the viewer — anonymously.
 *
 * POST { format?, exclude? } — draws one debater who is open to challenges
 *   from the most compatible few (`pickPracticeMatch`: formats, styles, speed
 *   and level against the viewer's own profile), skipping blocks in either
 *   direction, guest accounts, anyone the viewer already has a challenge
 *   waiting on, and the `exclude` tokens already shown. With `format`, only
 *   debaters who list that format (or list none) are drawn.
 *
 * Answers `{ match }`: what the partner is comfortable with and how well it
 * fits, but no name, avatar, id or free-text note — only an opaque token
 * (`lib/practice-partners/match-token.ts`) that `POST ./challenges` accepts as
 * `matchToken`. `{ match: null }` when nobody suitable is open right now.
 */

export const POST = withRouteErrors("POST /api/practice-partners/match", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to find a practice partner." }, { status: 401 });
  }

  const payload = ((await req.json().catch(() => null)) ?? {}) as { format?: unknown; exclude?: unknown };
  const format = payload.format === undefined || payload.format === null || payload.format === "any" ? null : payload.format;
  if (format !== null && !isPracticeFormat(format)) {
    return NextResponse.json({ error: "Pick a format from the list." }, { status: 400 });
  }
  const excludeTokens = Array.isArray(payload.exclude) ? payload.exclude.slice(0, MAX_MATCH_EXCLUDES) : [];

  const db = await getDBFromContext();
  const viewer = await getViewer(db, userId);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to find a practice partner." }, { status: 401 });
  }
  if (viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to find a practice partner." }, { status: 403 });
  }

  const secret = matchTokenSecret(getEnv);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const [profile, blocked, pending, excluded] = await Promise.all([
    getProfile(db, userId),
    loadBlockedIds(db, userId),
    listPendingOpponentIds(db, userId),
    Promise.all(excludeTokens.map((token) => openMatchToken(secret, token, userId, nowSeconds))),
  ]);
  const skip = new Set([...pending, ...excluded.filter((id): id is string => id !== null)]);

  const candidates = (await listVolunteers(db, userId, blocked)).filter(
    (volunteer) =>
      volunteer.asCompetitor &&
      !skip.has(volunteer.person.id) &&
      (format === null || volunteer.formats.length === 0 || volunteer.formats.includes(format)),
  );

  const picked = pickPracticeMatch(profile, candidates);
  if (!picked) {
    return NextResponse.json({ match: null } satisfies FindMatchResponse);
  }

  const { candidate, match } = picked;
  const body: FindMatchResponse = {
    match: {
      token: await sealMatchToken(secret, { viewerId: userId, opponentId: candidate.person.id }, nowSeconds),
      score: match.score,
      label: match.label,
      formats: candidate.formats,
      styles: candidate.styles,
      sharedFormats: match.sharedFormats,
      sharedStyles: match.sharedStyles,
      speed: candidate.speed,
      level: candidate.level,
      alsoJudges: candidate.asJudge,
    },
  };
  return NextResponse.json(body);
});
