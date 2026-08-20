import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { pageReuseEntries } from "@/lib/database/schema"
import { normalizeSourceUrl } from "debate-card-search/src/lib/shared-evidence-library"

/**
 * Server-backed index for the "On Page Card Reuse Search" idea's reuse
 * check (see `packages/debate-card-search/src/lib/shared-evidence-library.ts`'s
 * `checkPageForExistingCards`/`normalizeSourceUrl` and TODO.md idea #7,
 * follow-up (a)). The web app's own reuse check works entirely off its own
 * localStorage-persisted entries, so nothing outside the app (e.g. a future
 * browser extension) can call it. This route lets any client check/push
 * against one shared index instead, mirroring `app/api/flow-sync/route.ts`'s
 * short-poll/upsert architecture.
 *
 * GET  ?url=<string>  — every indexed entry whose `sourceUrl` normalizes to
 *   the same value as `url`, newest first.
 * POST { id, sourceUrl, cite?, argBlock?, contributorId? } — upserts one
 *   entry by its caller-assigned `id` (the source `EvidenceLibraryEntry.id`),
 *   so re-pushing the same entry (e.g. after an edit) updates it in place.
 */

const MAX_MATCHES = 50
const MAX_TEXT_LENGTH = 500

type PageReuseEntryPayload = {
  id: string
  sourceUrl: string
  cite: string
  argBlock: string
  contributorId: string | null
}

function toPayload(row: typeof pageReuseEntries.$inferSelect): PageReuseEntryPayload {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    cite: row.cite,
    argBlock: row.argBlock,
    contributorId: row.contributorId ?? null,
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url || !url.trim()) {
    return NextResponse.json({ error: "url is required." }, { status: 400 })
  }

  const normalizedUrl = normalizeSourceUrl(url)
  if (!normalizedUrl) {
    return NextResponse.json({ error: "url must not be blank after normalization." }, { status: 400 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select()
    .from(pageReuseEntries)
    .where(eq(pageReuseEntries.normalizedUrl, normalizedUrl))
    .orderBy(pageReuseEntries.createdAt)
    .limit(MAX_MATCHES)

  return NextResponse.json({
    url,
    alreadyCut: rows.length > 0,
    matches: rows.map(toPayload),
  })
}

export async function POST(req: NextRequest) {
  let body: Partial<PageReuseEntryPayload>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const id = typeof body.id === "string" ? body.id.trim() : ""
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : ""

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 })
  }
  if (!sourceUrl) {
    return NextResponse.json({ error: "sourceUrl is required." }, { status: 400 })
  }

  const normalizedUrl = normalizeSourceUrl(sourceUrl)
  if (!normalizedUrl) {
    return NextResponse.json({ error: "sourceUrl must not be blank after normalization." }, { status: 400 })
  }

  const cite = typeof body.cite === "string" ? body.cite.slice(0, MAX_TEXT_LENGTH) : ""
  const argBlock = typeof body.argBlock === "string" ? body.argBlock.slice(0, MAX_TEXT_LENGTH) : ""
  const contributorId =
    typeof body.contributorId === "string" && body.contributorId.trim() ? body.contributorId.trim() : null

  const db = await getDBFromContext()
  const values = { id, normalizedUrl, sourceUrl, cite, argBlock, contributorId }

  await db
    .insert(pageReuseEntries)
    .values(values)
    .onConflictDoUpdate({ target: pageReuseEntries.id, set: values })

  return NextResponse.json(
    { id, sourceUrl, cite, argBlock, contributorId } satisfies PageReuseEntryPayload,
    { status: 201 },
  )
}
