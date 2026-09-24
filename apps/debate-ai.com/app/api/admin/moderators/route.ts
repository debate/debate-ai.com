import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { Resend } from "resend";
import { getAdminAccess, getAdminEmails } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { notifications, staffRoles, user } from "@/lib/database/schema";
import { getEnv } from "@/lib/env";
import { APP_EMAIL, APP_NAME } from "debate-ai-webui/lib/config/site";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Moderator management — admins only.
 *
 * GET lists env admins (read-only) and invited moderators. POST { email }
 * grants the moderator role and tells the invitee: an in-app notification
 * when they already have an account, otherwise a Resend email. DELETE
 * ?email= revokes it.
 */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const db = await getDBFromContext();
    const moderators = await db.select().from(staffRoles).orderBy(asc(staffRoles.email));
    return NextResponse.json({ admins: getAdminEmails(), moderators });
  } catch (error) {
    console.error("Failed to list moderators:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to list moderators", details: describeError(error) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const { isAdmin, email: inviter } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Provide a valid email address." }, { status: 400 });
  }
  if (getAdminEmails().includes(email)) {
    return NextResponse.json({ error: `${email} is already an admin.` }, { status: 400 });
  }

  try {
    const db = await getDBFromContext();
    await db
      .insert(staffRoles)
      .values({ email, role: "moderator", invitedBy: inviter, createdAt: new Date() })
      .onConflictDoUpdate({ target: staffRoles.email, set: { role: "moderator" } });

    const link = "/admin";
    const title = `You're now a moderator on ${APP_NAME}`;
    const message = "You can edit videos and debate rounds from the admin panel or any video page.";
    let delivery: "notified" | "emailed" | "none" = "none";

    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existing) {
      await db.insert(notifications).values({
        userId: existing.id,
        type: "moderator_invite",
        title,
        body: message,
        link,
        createdAt: new Date(),
      });
      delivery = "notified";
    } else {
      const resendKey = getEnv("RESEND_API_KEY") || getEnv("AUTH_RESEND_KEY");
      if (resendKey) {
        const url = new URL(link, req.nextUrl.origin).toString();
        try {
          await new Resend(resendKey).emails.send({
            from: `${APP_NAME} <${APP_EMAIL}>`,
            to: email,
            subject: title,
            html: `<p>${inviter ?? "An admin"} made you a moderator on ${APP_NAME}.</p><p>${message}</p><p><a href="${url}">Sign in with this email address</a> to get started.</p>`,
          });
          delivery = "emailed";
        } catch (error) {
          console.error("Failed to email moderator invite:", error);
        }
      } else {
        console.log(`[dev] Moderator invite for ${email}`);
      }
    }

    return NextResponse.json({ ok: true, email, delivery });
  } catch (error) {
    console.error("Failed to invite moderator:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to invite moderator", details: describeError(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Provide ?email=" }, { status: 400 });

  try {
    const db = await getDBFromContext();
    await db.delete(staffRoles).where(eq(staffRoles.email, email));
    return NextResponse.json({ ok: true, email });
  } catch (error) {
    console.error("Failed to remove moderator:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to remove moderator", details: describeError(error) },
      { status: 500 },
    );
  }
}
