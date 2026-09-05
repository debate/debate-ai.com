import { NextRequest, NextResponse } from "next/server"
import { asc } from "drizzle-orm"
import { getAdminAccess } from "@/lib/auth/admin"
import { getDBFromContext } from "@/lib/database/context"
import { topicStarterItems } from "@/lib/database/schema"
import { importSharedFilesFromUpload, MAX_IMPORT_FILES } from "@/lib/shared-files/import-docx"

/**
 * Admin Topic Starter importer — uploads land in the shared-file library
 * with no owner, so they read as the site's own curated packs rather than
 * any one user's files. The DOCX/ZIP handling lives in
 * `lib/shared-files/import-docx.ts`, shared with the user-facing
 * `/api/shared-files/upload` route.
 */

export async function GET() {
  const { isAdmin } = await getAdminAccess()
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = await getDBFromContext()
  return NextResponse.json({ items: await db.select().from(topicStarterItems).orderBy(asc(topicStarterItems.title)) })
}

export async function POST(request: NextRequest) {
  const { isAdmin } = await getAdminAccess()
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const form = await request.formData()
  const db = await getDBFromContext()
  const result = await importSharedFilesFromUpload(db, form.get("file"), form, {
    published: form.get("published") !== "false",
    ownerId: null,
    rootTag: "topic-starter",
    maxFiles: MAX_IMPORT_FILES,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ root: result.root, imported: result.imported }, { status: 201 })
}
