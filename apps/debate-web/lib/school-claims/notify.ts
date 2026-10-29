/**
 * @fileoverview The messages a school claim sends: the verification code to
 * the school address, an in-app ping to every moderator when a claim is ready
 * for review, and an in-app note to the claimant when it is decided.
 *
 * @module lib/school-claims/notify
 */

import { inArray } from "drizzle-orm";
import { Resend } from "resend";
import { APP_EMAIL, APP_NAME } from "@debate-ai/webview/lib/config/site";
import { CODE_TTL_MINUTES, type SchoolClaim } from "@debate-ai/rankings/src/schools/school-claims";

import { getAdminEmails } from "@/lib/auth/admin";
import type { getDBFromContext } from "@/lib/database/context";
import { notifications, staffRoles, user } from "@/lib/database/schema";
import { getEnv } from "@/lib/env";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Escapes text for the HTML body of an email. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Emails the verification code. Without a Resend key (local dev) the code is
 * logged instead, so the flow can still be walked through.
 */
export async function sendClaimCodeEmail(input: {
  email: string;
  code: string;
  schoolName: string;
}): Promise<"emailed" | "logged"> {
  const resendKey = getEnv("RESEND_API_KEY") || getEnv("AUTH_RESEND_KEY");
  if (!resendKey) {
    console.log(`[dev] School claim code for ${input.email}: ${input.code}`);
    return "logged";
  }
  await new Resend(resendKey).emails.send({
    from: `${APP_NAME} <${APP_EMAIL}>`,
    to: input.email,
    subject: `Your ${APP_NAME} school verification code: ${input.code}`,
    html: `<p>Someone is claiming the ${escapeHtml(input.schoolName)} page on ${APP_NAME} using this address.</p><p>Your code is <strong style="font-size:20px;letter-spacing:2px">${input.code}</strong>. It expires in ${CODE_TTL_MINUTES} minutes.</p><p>If this wasn't you, ignore this email.</p>`,
  });
  return "emailed";
}

/** Pings every admin and moderator with an account that a claim is waiting. */
export async function notifyModeratorsOfClaim(db: Db, claim: SchoolClaim, claimantName: string): Promise<number> {
  try {
    const moderators = await db.select({ email: staffRoles.email }).from(staffRoles);
    const emails = [
      ...new Set([...getAdminEmails(), ...moderators.map((row: { email: string }) => row.email.toLowerCase())]),
    ];
    if (emails.length === 0) return 0;
    const recipients = await db.select({ id: user.id }).from(user).where(inArray(user.email, emails));
    if (recipients.length === 0) return 0;
    const createdAt = new Date();
    await db.insert(notifications).values(
      recipients.map((recipient: { id: string }) => ({
        userId: recipient.id,
        type: "school_claim",
        title: `School claim: ${claim.schoolName}`,
        body: `${claimantName} says they are the ${claim.role === "admin" ? "administrator" : "coach"} of ${claim.schoolName}${
          claim.emailVerified ? ` (verified ${claim.schoolEmail})` : ""
        }.`,
        link: "/admin#schools",
        createdAt,
      })),
    );
    return recipients.length;
  } catch (error) {
    console.error("Failed to notify moderators of a school claim:", error);
    return 0;
  }
}

/** Tells the claimant how their claim was decided. */
export async function notifyClaimant(db: Db, userId: string, claim: SchoolClaim): Promise<void> {
  try {
    const approved = claim.status === "approved";
    await db.insert(notifications).values({
      userId,
      type: "school_claim_decision",
      title: approved
        ? `You now manage ${claim.schoolName}'s page`
        : `Your claim on ${claim.schoolName} wasn't approved`,
      body: claim.reviewNote ?? (approved ? "Add your teams and students, and set the school logo." : null),
      link: approved ? `/@${claim.schoolSlug}` : "/settings?category=my-school",
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to notify a school claimant:", error);
  }
}
