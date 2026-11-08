/**
 * @fileoverview Admin endpoint behind the panel's "Sync team from openCaselist"
 * card (lib/caselist/team-caselist-sync.ts).
 *
 * - `GET` → `{ configured, pages }`: the team pages synced so far.
 * - `POST { action: "pages", dataset, school, team }` or
 *   `POST { action: "pages", url }` → finds the team in every season of its
 *   format, saves its pages, rounds and cites, and answers
 *   `{ pages, pendingFiles }`.
 * - `POST { action: "file", path }` → downloads one open-source file and
 *   stores it (R2 for the HTML and bytes, D1 for the metadata). The panel
 *   paces these calls under openCaselist's ten-downloads-a-minute limit; a
 *   429 from openCaselist is passed through so it can wait and retry.
 *
* openCaselist needs a session: `OPENCASELIST_API_KEY`, or `CASELIST_USERNAME` +
* `CASELIST_PASSWORD`, as Worker secrets.
 *
 * @module app/api/admin/caselist-team-sync/route
 */
import { NextRequest, NextResponse } from "next/server"
import { CaselistApiError, createCaselistClient } from "@debate-ai/research-evidence/src/caselist/caselist-api"
import { authorizeCardImport } from "@/lib/admin/debate-card-import"
import { caselistCredentials } from "@/lib/caselist/team-caselist"
import {
  type CaselistFileBucket,
  listSyncedPages,
  syncTeamFile,
  syncTeamPages,
  type TeamSyncQuery,
} from "@/lib/caselist/team-caselist-sync"
import { getDBFromContext } from "@/lib/database/context"
import { getCardTextBucket } from "@/lib/search/card-text-store"

const NOT_CONFIGURED =
  "openCaselist is not configured: set the OPENCASELIST_API_KEY secret (or CASELIST_USERNAME and CASELIST_PASSWORD)."

function upstreamError(error: unknown) {
  if (error instanceof CaselistApiError) {
    const message =
      error.status === 401
        ? "The openCaselist session on the server has expired or is missing."
        : error.status === 429
          ? "openCaselist download limit reached; wait a minute."
          : error.message
    return NextResponse.json({ error: message, status: error.status }, { status: error.status === 429 ? 429 : 502 })
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
}

export async function GET(request: NextRequest) {
  const access = await authorizeCardImport(request)
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = await getDBFromContext()
  return NextResponse.json({
    configured: Boolean(caselistCredentials()),
    bucket: Boolean(getCardTextBucket()),
    pages: await listSyncedPages(db, { limit: 50 }),
  })
}

export async function POST(request: NextRequest) {
  const access = await authorizeCardImport(request)
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const credentials = caselistCredentials()
  if (!credentials) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 })

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 })
  }
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "")
  const db = await getDBFromContext()
  const client = createCaselistClient(credentials)

  if (body.action === "file") {
    const bucket = getCardTextBucket() as unknown as CaselistFileBucket | null
    if (!bucket) {
      return NextResponse.json({ error: "Storing files needs the CARD_TEXT R2 bucket (see wrangler.jsonc)." }, { status: 503 })
    }
    try {
      return NextResponse.json(await syncTeamFile(db, bucket, client, text("path")))
    } catch (error) {
      return upstreamError(error)
    }
  }

  if (body.action === "pages") {
    const url = text("url")
    const query: TeamSyncQuery | null = url
      ? { url }
      : text("dataset") && text("school") && text("team")
        ? { dataset: text("dataset"), school: text("school"), team: text("team") }
        : null
    if (!query) {
      return NextResponse.json({ error: "Give an openCaselist page URL, or a format, school and team." }, { status: 400 })
    }
    try {
      return NextResponse.json(await syncTeamPages(db, client, query, access.actor))
    } catch (error) {
      return upstreamError(error)
    }
  }

  return NextResponse.json({ error: 'action must be "pages" or "file"' }, { status: 400 })
}
