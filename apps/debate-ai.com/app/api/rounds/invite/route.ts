import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { inArray } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { notifications, user } from "@/lib/database/schema"
import { getSession } from "@/lib/auth/session"
import { getEnv } from "@/lib/env"
import { APP_EMAIL, APP_NAME } from "@/lib/config/site"

/**
 * Dispatches Create New Round invites — a user request: "this should be
 * linked and have autocomplete of registered user. otherwise send an email
 * to that person invited with an invite to join a round" (see TODO.md's
 * "Create New Round — registered-user autocomplete + invite notifications"
 * Completed entry). Called client-side from `useRoundEditorForm.ts` right after a
 * new round is created — the round itself stays local-only
 * (`useFlowStore`'s localStorage-backed state; see `/api/rounds`'s
 * "Account-linked round cloud save" doc comment for why that's a separate,
 * opt-in sync), so this route's only job is telling each invitee they were
 * invited, not sharing the round data itself.
 *
 * Requires a session — sending arbitrary email requires knowing who's
 * asking, and an in-app notification needs a real inviter to attribute it
 * to.
 *
 * POST { emails: string[], tournamentName: string, roundLevel: string,
 *   slug: string | null } — for each distinct, validly-formatted,
 *   non-self email: a matching `user` row gets a `notifications` row (seen
 *   in-app, see `/api/notifications`); anyone else gets a Resend email
 *   invite. `slug` (the round's client-generated URL segment) is optional
 *   since `generateRoundSlug` can return `""` for an under-specified round;
 *   the link is omitted rather than pointing at a broken URL when absent.
 *
 * Returns `{ notified: string[], emailed: string[], skipped: string[] }` —
 * the caller (`useRoundEditorForm.ts`) toasts a one-line summary from this
 * rather than surfacing per-recipient errors.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_PATTERN.test(email)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Sign in to send round invites." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const { emails, tournamentName, roundLevel, slug } = (body ?? {}) as {
    emails?: unknown
    tournamentName?: unknown
    roundLevel?: unknown
    slug?: unknown
  }

  if (!Array.isArray(emails)) {
    return NextResponse.json({ error: "Provide emails as an array of strings." }, { status: 400 })
  }
  if (typeof tournamentName !== "string" || !tournamentName.trim()) {
    return NextResponse.json({ error: "Provide a tournamentName." }, { status: 400 })
  }

  const inviterEmail = session.user.email.toLowerCase()
  const recipients = [
    ...new Set(
      emails.filter(isValidEmail).map((email) => email.toLowerCase()),
    ),
  ].filter((email) => email !== inviterEmail)

  if (recipients.length === 0) {
    return NextResponse.json({ notified: [], emailed: [], skipped: [] })
  }

  const roundLabel = typeof roundLevel === "string" && roundLevel.trim()
    ? `${tournamentName} — ${roundLevel}`
    : tournamentName
  const link = typeof slug === "string" && slug.trim() ? `/debate/${slug.trim()}` : null

  const db = await getDBFromContext()
  const matchedUsers = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(inArray(user.email, recipients))

  const matchedByEmail = new Map(
    matchedUsers.map((row: { id: string; email: string }) => [row.email.toLowerCase(), row]),
  )
  const notified: string[] = []
  const emailed: string[] = []
  const skipped: string[] = []

  const now = new Date()
  for (const match of matchedUsers) {
    await db.insert(notifications).values({
      userId: match.id,
      type: "round_invite",
      title: `${session.user.name} invited you to a debate round`,
      body: roundLabel,
      link,
      createdAt: now,
    })
    notified.push(match.email)
  }

  const emailRecipients = recipients.filter((email) => !matchedByEmail.has(email))
  if (emailRecipients.length > 0) {
    const resendKey = getEnv("RESEND_API_KEY") || getEnv("AUTH_RESEND_KEY")
    if (!resendKey) {
      console.log(`[dev] Round invite for ${emailRecipients.join(", ")}: ${roundLabel}`)
      skipped.push(...emailRecipients)
    } else {
      const resend = new Resend(resendKey)
      const url = link ? new URL(link, req.nextUrl.origin).toString() : req.nextUrl.origin
      const results = await Promise.allSettled(
        emailRecipients.map((email) =>
          resend.emails.send({
            from: `${APP_NAME} <${APP_EMAIL}>`,
            to: email,
            subject: `${session.user.name} invited you to a debate round`,
            html: `<p>${session.user.name} invited you to a debate round on ${APP_NAME}:</p><p><strong>${roundLabel}</strong></p><p><a href="${url}">Open the round</a></p>`,
          }),
        ),
      )
      results.forEach((result, index) => {
        (result.status === "fulfilled" ? emailed : skipped).push(emailRecipients[index])
      })
    }
  }

  return NextResponse.json({ notified, emailed, skipped })
}
