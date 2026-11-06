import { NextRequest, NextResponse } from "next/server"
import { isSavedAnswersPage, parseSavedAnswerWrite } from "@debate-ai/help-docs/saved-answers"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getStaffAccess } from "@/lib/auth/admin"
import { getUserId } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import { deleteDocsAnswers, listDocsAnswers, saveDocsAnswer } from "@/lib/docs-answers/store"

/**
 * Answers to the docs' suggested questions ("Ask about this page" on the
 * Synergy Slayer pages and in reading mode), shared by every reader. The
 * answer depends on the page and the question, not on who asked, so the first
 * one saved is served to everyone and the AI answers each question once.
 *
 * GET ?page=/docs/… — `{ answers: [{ question, answer }] }`, oldest first.
 * Public, signed out included.
 *
 * POST `{ page, question, answer }` — offers an answer the caller just got.
 * Signed in, so a stranger can't publish text under a docs page. First come:
 * a question already saved is answered `{ stored: false, answer }` with the
 * stored copy.
 *
 * DELETE ?page=&question= — staff only; without `question`, clears the page.
 */

export const GET = withRouteErrors("GET /api/docs-answers", async (req: NextRequest) => {
  const page = new URL(req.url).searchParams.get("page") ?? ""
  if (!isSavedAnswersPage(page)) return NextResponse.json({ error: "Give ?page= a /docs/ path." }, { status: 400 })
  const answers = await listDocsAnswers(await getDBFromContext(), page)
  // Short, so an answer someone just got reaches the next reader soon.
  return NextResponse.json({ answers }, { headers: { "cache-control": "public, max-age=60" } })
})

export const POST = withRouteErrors("POST /api/docs-answers", async (req: NextRequest) => {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to save answers for other readers." }, { status: 401 })
  const parsed = parseSavedAnswerWrite(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const saved = await saveDocsAnswer(await getDBFromContext(), parsed.value, userId)
  if (!saved) return NextResponse.json({ error: "This page already holds as many saved answers as it can." }, { status: 409 })
  return NextResponse.json(saved)
})

export const DELETE = withRouteErrors("DELETE /api/docs-answers", async (req: NextRequest) => {
  if (!(await getStaffAccess()).canEditContent) {
    return NextResponse.json({ error: "Only admins and moderators can clear saved answers." }, { status: 403 })
  }
  const params = new URL(req.url).searchParams
  const page = params.get("page") ?? ""
  if (!isSavedAnswersPage(page)) return NextResponse.json({ error: "Give ?page= a /docs/ path." }, { status: 400 })
  await deleteDocsAnswers(await getDBFromContext(), page, params.get("question") || undefined)
  return NextResponse.json({ ok: true })
})
