import { NextResponse } from "next/server"
import { validateDeletionRequest } from "@debate/webview/lib/privacy/recording-release"
import { getAdminEmails } from "@/lib/auth/admin"
import { getUserId } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import {
  createDeletionRequest,
  listDeletionRequests,
  notifyAdminsOfDeletionRequest,
} from "@/lib/privacy/store"

/**
 * Settings → Privacy's "request deletion" form.
 *
 * GET  — the signed-in user's own requests and their status.
 * POST — `{ scope: "all" | "part", categories?, details? }`; files a request
 *        and pings the admins. Nothing is deleted automatically: an admin
 *        works the request.
 */

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to see your deletion requests." }, { status: 401 })
  }
  const db = await getDBFromContext()
  return NextResponse.json({ requests: await listDeletionRequests(db, userId) })
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to request a deletion." }, { status: 401 })
  }
  const { value, errors } = validateDeletionRequest(await request.json().catch(() => null))
  if (!value) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 })
  }
  const db = await getDBFromContext()
  const created = await createDeletionRequest(db, userId, value)
  await notifyAdminsOfDeletionRequest(db, getAdminEmails(), created)
  return NextResponse.json({ request: created }, { status: 201 })
}
