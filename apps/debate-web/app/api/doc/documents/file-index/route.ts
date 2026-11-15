import { NextResponse } from "next/server"
import { desc, eq, isNull } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { documents } from "@/lib/database/schema"
import { getUserIdOrUnavailable } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { buildMyFilesIndex } from "@debate-ai/reason-docs/lib/my-files/file-index"
import { ensureDocumentColumns } from "@/lib/file-stats/columns"

/**
 * @fileoverview The My Files index: every one of the current user's
 * documents' name, folder and `updatedAt`, no content — the counterpart of
 * `GET /api/topic-starters/file-index`. The sidebar paints the tree from its
 * own `localStorage` copy before this answers, then compares the two so it
 * only downloads files that changed since this device last cached them
 * (`lib/my-files/file-index.ts#reconcileMyFilesIndex`). Built per request
 * from the `documents` table (same rows as `GET /api/doc/documents`), since
 * each user's index is small and changes on every save.
 *
 * Each file row also carries what the tree shows on hover: author, created
 * date and the size stats (quotes, blocks, pages, characters) counted on
 * save (`lib/file-stats/columns.ts`).
 *
 * @module app/api/doc/documents/file-index/route
 */
export const GET = withRouteErrors("GET /api/doc/documents/file-index", async () => {
  const db = await getDBFromContext()
  // Not `getUserId`: a failed session lookup would read as signed out and
  // answer with the anonymous index, which the sidebar would then paint over
  // a signed-in user's cached tree. A 503 instead keeps the local copy.
  const userId = await getUserIdOrUnavailable()
  await ensureDocumentColumns(db)

  const rows: Array<{
    id: number
    title: string
    parentId: number | null
    isFolder: boolean
    format: string
    updatedAt: Date | string | number
    createdAt: Date | string | number | null
    author: string | null
    quoteCount: number | null
    blockCount: number | null
    pageCount: number | null
    charCount: number | null
  }> = await db
    .select({
      id: documents.id,
      title: documents.title,
      parentId: documents.parentId,
      isFolder: documents.isFolder,
      format: documents.format,
      updatedAt: documents.updatedAt,
      createdAt: documents.createdAt,
      author: documents.author,
      quoteCount: documents.quoteCount,
      blockCount: documents.blockCount,
      pageCount: documents.pageCount,
      charCount: documents.charCount,
    })
    .from(documents)
    .where(userId ? eq(documents.userId, userId) : isNull(documents.userId))
    .orderBy(desc(documents.updatedAt))

  const index = buildMyFilesIndex(
    rows.map((row) => ({
      ...row,
      // Serialized exactly as the full list serializes it (`Date` → ISO), so
      // the client can compare it with its cached rows.
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    })),
  )
  return NextResponse.json(index, {
    // Always revalidate: this request is the background "check for updates".
    headers: { "Cache-Control": "no-cache, private" },
  })
})
