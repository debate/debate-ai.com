import { NextResponse, type NextRequest } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import {
  normalizeEmail,
  resubscribeEmail,
  unsubscribeEmail,
  verifyUnsubscribeToken,
} from "@/lib/emails/unsubscribe";
import { getSession } from "@/lib/auth/session";

/**
 * Public receiver for the footer Unsubscribe link and Settings → Notifications.
 *
 * GET  ?t=<token> — confirms the token and returns `{ email, unsubscribed }`.
 * POST { token } | { email, action: "unsubscribe"|"resubscribe" } —
 *   records or clears the opt-out. A signed-in caller may omit `email` and
 *   use their account address. Token posts do not require a session.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const email = verifyUnsubscribeToken(token);
  if (!email) {
    return NextResponse.json({ error: "That unsubscribe link is invalid or expired." }, { status: 400 });
  }
  const db = await getDBFromContext().catch(() => null);
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { isEmailUnsubscribed } = await import("@/lib/emails/unsubscribe");
  return NextResponse.json({ email, unsubscribed: await isEmailUnsubscribed(db, email) });
}

export async function POST(req: NextRequest) {
  let body: { token?: unknown; email?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action === "resubscribe" ? "resubscribe" : "unsubscribe";
  let email: string | null = null;
  let source: "link" | "settings" = "link";

  if (typeof body.token === "string" && body.token) {
    email = verifyUnsubscribeToken(body.token);
    if (!email) {
      return NextResponse.json({ error: "That unsubscribe link is invalid or expired." }, { status: 400 });
    }
  } else {
    const session = await getSession();
    const raw =
      typeof body.email === "string" && body.email.trim()
        ? body.email
        : session?.user.email;
    email = typeof raw === "string" ? normalizeEmail(raw) : null;
    if (!email) {
      return NextResponse.json(
        { error: session ? "Your account has no email on file." : "Sign in or provide a valid unsubscribe token." },
        { status: session ? 400 : 401 },
      );
    }
    // Settings (or a signed-in POST without a token) is "settings"; anonymous
    // token posts stay "link".
    source = session ? "settings" : "link";
  }

  const db = await getDBFromContext().catch(() => null);
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    if (action === "resubscribe") {
      const result = await resubscribeEmail(db, email);
      return NextResponse.json({ email: result.email, unsubscribed: false });
    }
    const result = await unsubscribeEmail(db, email, source);
    return NextResponse.json({ email: result.email, unsubscribed: true });
  } catch (error) {
    console.error("[emails/unsubscribe]", error);
    return NextResponse.json({ error: "Could not update email preferences." }, { status: 500 });
  }
}
