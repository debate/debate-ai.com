import { NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { ensureTopicStarterColumns } from "@/lib/topic-starters/changes"
import { getTopicStarterFileIndex } from "@/lib/topic-starters/file-index"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * @fileoverview The Topic Starters file index: every published file's name
 * and folder, no content. Rebuilt daily and after each applied edit
 * (`lib/topic-starters/file-index.ts`); the sidebar keeps the last copy in
 * `localStorage` and paints the tree from it before this answers.
 *
 * @module app/api/topic-starters/file-index/route
 */
export const GET = withRouteErrors("GET /api/topic-starters/file-index", async () => {
  const db = await getDBFromContext()
  await ensureTopicStarterColumns(db)
  const index = await getTopicStarterFileIndex(db)
  return NextResponse.json(index, {
    // Revalidate every time: the client already paints from its own stored
    // copy, so this request is only ever the background refresh, and it
    // should see an edit's rebuilt snapshot at once.
    headers: { "Cache-Control": "no-cache" },
  })
})
