import { NextResponse, type NextRequest } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { topicStarterItems } from "@/lib/database/schema"
import { findItemByRef } from "@/lib/reason-docs/doc-path"

/**
 * @fileoverview Resolves a filename URL against the public library.
 *
 * `/reason-editor?doc=impacts/warming-1ac` has to open that file for whoever
 * follows the link — a reader with no account, or one whose own tree has
 * nothing by that name. The browsable catalogue (`/api/topic-starters`) is
 * capped at 100 rows for the sidebar's sake, so it cannot be what a link
 * resolves against; this route searches every published row instead and
 * returns the one file the name asks for, content included, so the editor can
 * open it in the same trip.
 *
 * Published rows only, in both the match and the ancestry: an unpublished
 * folder's children are not reachable by guessing their names.
 *
 * @module app/api/topic-starters/by-path/route
 */

/** A generous ceiling on an admin-curated library — enough that a real path
 *  always resolves, bounded so a lookup can't walk an unbounded table. */
const MAX_ROWS = 5000

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("path")?.trim()
  if (!ref) {
    return NextResponse.json({ error: "Pass ?path=<file name>." }, { status: 400 })
  }

  const db = await getDBFromContext()
  // Names and shape for the whole published tree, then the one row's content:
  // a path is resolved against ancestry, so the folders above the file have to
  // be in hand, and pulling every row's `.cmir` to find one file would be a
  // multi-megabyte read for a few kilobytes of answer.
  const rows = await db
    .select({
      id: topicStarterItems.id,
      title: topicStarterItems.title,
      parentId: topicStarterItems.parentId,
      isFolder: topicStarterItems.isFolder,
    })
    .from(topicStarterItems)
    .where(eq(topicStarterItems.published, true))
    .orderBy(asc(topicStarterItems.id))
    .limit(MAX_ROWS)

  const match = findItemByRef(rows, ref)
  if (!match) {
    return NextResponse.json({ error: "No public file by that name.", path: ref }, { status: 404 })
  }

  const [item] = await db
    .select()
    .from(topicStarterItems)
    .where(eq(topicStarterItems.id, match.id))
    .limit(1)

  if (!item || !item.published) {
    return NextResponse.json({ error: "No public file by that name.", path: ref }, { status: 404 })
  }

  return NextResponse.json({ item })
}
