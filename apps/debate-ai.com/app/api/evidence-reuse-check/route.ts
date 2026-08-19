import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { evidenceReuseIndex } from "@/lib/database/schema"

/**
 * Server-backed reuse index for the "On Page Card Reuse Search" idea (see
 * `packages/debate-card-search/src/lib/shared-evidence-library.ts` and
 * TODO.md idea #7, follow-up (a)): "an actual browser extension that calls
 * this same check automatically against the current tab's URL." The
 * existing `checkPersistedPageForExistingCards` only sees `localStorage`
 * entries in one browser, so it can't answer "has anyone on the team cut
 * this" across devices — this route is the small, dedicated shared index a
 * browser extension (or the web app itself) can call instead, mirroring
 * `app/api/flow-sync/route.ts`'s D1-backed API-route conventions.
 *
 * GET  ?url=<string>   — whether `url` has already been cut, plus matches.
 * POST { id, sourceUrl, cite, argBlock, topic, contributorId } — registers
 *   (upserts by `id`) a cut card's source URL into the shared index.
 */

const MAX_MATCHES = 20
const MAX_FIELD_LENGTH = 500

/** Mirrors `shared-evidence-library.ts`'s `normalizeSourceUrl` — kept in sync deliberately rather than imported, since this route can't depend on the `debate-card-search` workspace package. */
function normalizeSourceUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
}

type ReuseMatch = {
  id: string
  sourceUrl: string
  cite: string
  argBlock: string
  topic: string
}

function toReuseMatch(row: typeof evidenceReuseIndex.$inferSelect): ReuseMatch {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    cite: row.cite,
    argBlock: row.argBlock,
    topic: row.topic,
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim() ?? ""
  if (!url) {
    return NextResponse.json({ error: "url is required." }, { status: 400 })
  }

  const normalizedUrl = normalizeSourceUrl(url)
  if (!normalizedUrl) {
    return NextResponse.json({ error: "url must be non-empty after normalization." }, { status: 400 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select()
    .from(evidenceReuseIndex)
    .where(eq(evidenceReuseIndex.normalizedUrl, normalizedUrl))
    .limit(MAX_MATCHES)

  const matches = rows.map(toReuseMatch)
  return NextResponse.json({ url, alreadyCut: matches.length > 0, matches })
}

export async function POST(req: NextRequest) {
  let body: Partial<{
    id: string
    sourceUrl: string
    cite: string
    argBlock: string
    topic: string
    contributorId: string
  }>
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
    return NextResponse.json({ error: "sourceUrl must be non-empty after normalization." }, { status: 400 })
  }

  const cite = typeof body.cite === "string" ? body.cite.slice(0, MAX_FIELD_LENGTH) : ""
  const argBlock = typeof body.argBlock === "string" ? body.argBlock.slice(0, MAX_FIELD_LENGTH) : ""
  const topic = typeof body.topic === "string" ? body.topic.slice(0, MAX_FIELD_LENGTH) : ""
  const contributorId = typeof body.contributorId === "string" ? body.contributorId.slice(0, MAX_FIELD_LENGTH) : ""

  const db = await getDBFromContext()
  const values = { id, sourceUrl, normalizedUrl, cite, argBlock, topic, contributorId }

  await db
    .insert(evidenceReuseIndex)
    .values(values)
    .onConflictDoUpdate({ target: evidenceReuseIndex.id, set: values })

  return NextResponse.json(
    { id, sourceUrl, cite, argBlock, topic, contributorId } satisfies Record<string, string>,
    { status: 201 },
  )
}
