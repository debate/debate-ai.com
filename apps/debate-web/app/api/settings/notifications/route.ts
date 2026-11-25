import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getSession } from "@/lib/auth/session";
import {
  getNotificationSettings,
  setPushNotificationsEnabled,
} from "@/lib/emails/notification-settings";
import { resubscribeEmail, unsubscribeEmail } from "@/lib/emails/unsubscribe";

/**
 * Settings → Notifications.
 *
 * GET — email opt-out status and push preference for the signed-in user.
 * PUT { emailUnsubscribed?: boolean, pushEnabled?: boolean } — update either.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to load notification settings." }, { status: 401 });
  }
  const db = await getDBFromContext();
  return NextResponse.json({
    notifications: await getNotificationSettings(db, session.user.id, session.user.email),
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to save notification settings." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    emailUnsubscribed?: unknown;
    pushEnabled?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const db = await getDBFromContext();
  if (typeof body.emailUnsubscribed === "boolean") {
    if (body.emailUnsubscribed) await unsubscribeEmail(db, session.user.email, "settings");
    else await resubscribeEmail(db, session.user.email);
  }
  if (typeof body.pushEnabled === "boolean") {
    await setPushNotificationsEnabled(db, session.user.id, body.pushEnabled);
  }

  return NextResponse.json({
    notifications: await getNotificationSettings(db, session.user.id, session.user.email),
  });
}
