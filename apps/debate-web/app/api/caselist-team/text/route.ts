/**
 * GET /api/caselist-team/text?path=ndtceda26/Emory/GaYo/Emory-GaYo-Aff-1.-Northwestern-Round-1.docx
 *
 * The converted text (HTML) of an open-source document an admin synced from
 * openCaselist (lib/caselist/team-caselist-sync.ts). The HTML lives in the
 * CARD_TEXT R2 bucket; D1 keeps the document's metadata. 404 until synced.
 */
import { NextResponse } from "next/server"
import { isOpenSourcePath } from "@/lib/caselist/team-caselist"
import { type CaselistFileBucket, readStoredTeamFileText } from "@/lib/caselist/team-caselist-sync"
import { getDBFromContext } from "@/lib/database/context"
import { getCardTextBucket } from "@/lib/search/card-text-store"

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? ""
  if (!isOpenSourcePath(path)) {
    return NextResponse.json({ error: "Not a caselist open-source path" }, { status: 400 })
  }
  const bucket = getCardTextBucket() as unknown as CaselistFileBucket | null
  if (!bucket) return NextResponse.json({ error: "No R2 bucket bound" }, { status: 503 })
  try {
    const stored = await readStoredTeamFileText(await getDBFromContext(), bucket, path)
    if (!stored) return NextResponse.json({ error: "This file has not been synced" }, { status: 404 })
    return NextResponse.json(stored, { headers: { "Cache-Control": "public, max-age=3600" } })
  } catch (error) {
    console.warn(`caselist-team text failed for ${path}:`, error)
    return NextResponse.json({ error: "Could not read the stored file" }, { status: 500 })
  }
}
