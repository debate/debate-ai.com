/**
 * @fileoverview The one-row lookup `checkDocumentParent`
 * (`@debate-ai/reason-docs/lib/reason-docs/doc-parent`) walks up the REASON
 * file tree with, for `POST /api/doc/documents` and
 * `PUT /api/doc/documents/:id`. Selects only the tree columns, so a check
 * never pulls a file's whole `content` out of D1.
 *
 * @module lib/api/document-tree
 */

import { eq } from "drizzle-orm"
import type { DocumentTreeRow } from "@debate-ai/reason-docs/lib/reason-docs/doc-parent"
import type { getDBFromContext } from "@/lib/database/context"
import { documents } from "@/lib/database/schema"

type Db = Awaited<ReturnType<typeof getDBFromContext>>

/** The `documents` row with this id, as the tree fields, or null. */
export async function loadDocumentTreeRow(db: Db, id: number): Promise<DocumentTreeRow | null> {
  const [row] = await db
    .select({
      id: documents.id,
      parentId: documents.parentId,
      isFolder: documents.isFolder,
      userId: documents.userId,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1)
  return row ?? null
}
