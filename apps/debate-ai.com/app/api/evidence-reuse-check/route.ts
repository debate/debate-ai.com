import { NextRequest, NextResponse } from "next/server"
import { eq, inArray } from "drizzle-orm"
import {
  buildReuseCardDetails,
  parseParquetCardReuseId,
  type CardReuseAnnotation,
  type ReuseCardDetails,
} from "debate-research-evidence"
import { getDBFromContext } from "@/lib/database/context"
import { debateCards, evidenceReuseIndex, reuseCheckLog } from "@/lib/database/schema"
import { annotationCardHash, readSavedAnnotations } from "@/lib/evidence-reuse-check/card-annotation"

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
 * GET  ?url=<string>&source=<"web"|"extension">   — whether `url` has
 *   already been cut, plus matches. A match registered from the Parquet card
 *   corpus (`card:<id>`, see `debate-research-evidence`'s
 *   `parquet-card-reuse.ts`) also carries `card` — the card parsed by
 *   `debate-card-parser` for its author, year and highlighted quotes — and
 *   `annotation`, its saved LLM flaws/author-quality annotation when one
 *   exists (`POST /api/evidence-reuse-check/annotate` makes one). Every call also appends a row to
 *   `reuseCheckLog` (idea #7's "team dashboard of pages flagged as
 *   already-cut" follow-up — see `GET /api/evidence-reuse-check/dashboard`),
 *   best-effort: a logging failure never fails the caller's actual check.
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
  card?: ReuseCardDetails
  annotation?: CardReuseAnnotation
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

function toLoggedSource(raw: string | null): "web" | "extension" {
  return raw === "extension" ? "extension" : "web"
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
  const alreadyCut = matches.length > 0
  await attachCorpusCards(db, matches)

  // Best-effort: the reuse dashboard is a nice-to-have view over this log,
  // so a logging failure must never fail the caller's actual reuse check.
  try {
    await db.insert(reuseCheckLog).values({
      url: url.slice(0, MAX_FIELD_LENGTH),
      normalizedUrl,
      alreadyCut,
      matchCount: matches.length,
      source: toLoggedSource(req.nextUrl.searchParams.get("source")),
      checkedAt: Date.now(),
    })
  } catch {
    // Ignored — see comment above.
  }

  return NextResponse.json({ url, alreadyCut, matches })
}

type CorpusCardRow = Pick<
  typeof debateCards.$inferSelect,
  | "id"
  | "tag"
  | "cite"
  | "fullcite"
  | "markup"
  | "spoken"
  | "fulltext"
  | "caselistDisplayName"
  | "event"
  | "level"
  | "side"
  | "duplicateCount"
>

/**
 * Fills in `card` and `annotation` on the matches that came from the card
 * corpus. Best-effort like the log below: the answer to "has this been cut"
 * is already known, and a failure here must not turn it into an error.
 */
async function attachCorpusCards(db: Awaited<ReturnType<typeof getDBFromContext>>, matches: ReuseMatch[]) {
  const byCardId = new Map<number, ReuseMatch>()
  for (const match of matches) {
    const cardId = parseParquetCardReuseId(match.id)
    if (cardId !== null) byCardId.set(cardId, match)
  }
  if (byCardId.size === 0) return

  try {
    const cards: CorpusCardRow[] = await db
      .select({
        id: debateCards.id,
        tag: debateCards.tag,
        cite: debateCards.cite,
        fullcite: debateCards.fullcite,
        markup: debateCards.markup,
        spoken: debateCards.spoken,
        fulltext: debateCards.fulltext,
        caselistDisplayName: debateCards.caselistDisplayName,
        event: debateCards.event,
        level: debateCards.level,
        side: debateCards.side,
        duplicateCount: debateCards.duplicateCount,
      })
      .from(debateCards)
      .where(inArray(debateCards.id, [...byCardId.keys()]))

    const hashes = await Promise.all(cards.map((card) => annotationCardHash(card)))
    const saved = await readSavedAnnotations(db, hashes)
    cards.forEach((card, index) => {
      const match = byCardId.get(card.id)
      if (!match) return
      match.card = buildReuseCardDetails(card)
      const annotation = saved.get(hashes[index])
      if (annotation) match.annotation = annotation
    })
  } catch (error) {
    console.error("evidence-reuse-check: failed to attach corpus cards", error)
  }
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
