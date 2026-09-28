import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getViewer, upsertProfile } from "@/lib/practice-partners/queries";
import { parseProfile } from "@/lib/practice-partners/validation";

/**
 * The viewer's practice profile — whether they are open to being challenged,
 * whether they volunteer to judge, and the formats, styles, speed, level and
 * availability they are comfortable with.
 *
 * PUT { asCompetitor, asJudge, formats, styles, speed, level, availability, note }
 *   — replaces the profile and returns it as stored. Both roles off hides the
 *   viewer from the board without forgetting their preferences.
 *
 * Guest (anonymous) accounts may not volunteer: a board entry is a promise that
 * someone will answer, and a guest session can vanish with its browser tab.
 */

export const PUT = withRouteErrors("PUT /api/practice-partners/profile", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to volunteer for practice rounds." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const profile = parseProfile(payload);
  if (!profile.ok) {
    return NextResponse.json({ error: profile.error }, { status: 400 });
  }

  const db = await getDBFromContext();
  const viewer = await getViewer(db, userId);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to volunteer for practice rounds." }, { status: 401 });
  }
  if (viewer.isAnonymous && (profile.value.asCompetitor || profile.value.asJudge)) {
    return NextResponse.json(
      { error: "Create an account to volunteer — guest sessions can't be challenged." },
      { status: 403 },
    );
  }

  await upsertProfile(db, userId, profile.value);
  return NextResponse.json(profile.value);
});
