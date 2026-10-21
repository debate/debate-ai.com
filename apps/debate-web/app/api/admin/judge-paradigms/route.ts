import { NextRequest, NextResponse } from "next/server"
import { getAdminAccess } from "@/lib/auth/admin"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { getParadigmSyncStatus, runParadigmSyncBatch, setParadigmClaimVerified } from "@/lib/judge-paradigms/queries"

/**
 * Admin sync of judges' Tabroom paradigms and judging records — admins only.
 *
 * GET — the cache's size and health, the sync's progress, whether a Tabroom
 *   session is configured, and the accounts claiming a Tabroom judge.
 * POST { mode: "discover" | "refresh" } — runs one batch: `discover` walks
 *   Tabroom's paradigm search for judges the cache lacks, `refresh` re-fetches
 *   the oldest cached ones. The admin card calls it until nothing is left.
 * PATCH { userId, verified } — confirms (or revokes) an account as the
 *   Tabroom judge it claims, so its own paradigm shows in pairings.
 */

export const GET = withRouteErrors("GET /api/admin/judge-paradigms", async () => {
  const { isAdmin } = await getAdminAccess()
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json(await getParadigmSyncStatus(await getDBFromContext()))
})

export const POST = withRouteErrors("POST /api/admin/judge-paradigms", async (req: NextRequest) => {
  const { isAdmin } = await getAdminAccess()
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = (await req.json().catch(() => null)) as { mode?: unknown } | null
  if (body?.mode !== "discover" && body?.mode !== "refresh") {
    return NextResponse.json({ error: 'Provide { mode: "discover" | "refresh" }.' }, { status: 400 })
  }
  return NextResponse.json(await runParadigmSyncBatch(await getDBFromContext(), body.mode))
})

export const PATCH = withRouteErrors("PATCH /api/admin/judge-paradigms", async (req: NextRequest) => {
  const { isAdmin } = await getAdminAccess()
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = (await req.json().catch(() => null)) as { userId?: unknown; verified?: unknown } | null
  if (typeof body?.userId !== "string" || typeof body.verified !== "boolean") {
    return NextResponse.json({ error: "Provide { userId, verified }." }, { status: 400 })
  }
  const updated = await setParadigmClaimVerified(await getDBFromContext(), body.userId, body.verified)
  if (!updated) return NextResponse.json({ error: "No claim for that account." }, { status: 404 })
  return NextResponse.json({ ok: true })
})
