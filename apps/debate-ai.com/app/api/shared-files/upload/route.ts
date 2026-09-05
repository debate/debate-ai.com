import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { importSharedFilesFromUpload } from "@/lib/shared-files/import-docx"

/** Most DOCX files one user upload may contain — smaller than the admin cap so one account can't flood the library. */
export const MAX_USER_UPLOAD_FILES = 25

/**
 * User-facing DOCX/ZIP uploader for the shared-file library — the same
 * importer the admin Topic Starter uploader uses, but every row is owned
 * by (and manageable by) the signed-in user. Multipart form fields:
 * `file` (.docx or .zip), optional `title` (root folder name), optional
 * `published` ("false" keeps the upload private to the uploader).
 */
export async function POST(request: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to upload shared files." }, { status: 401 })

  const form = await request.formData()
  const db = await getDBFromContext()
  const result = await importSharedFilesFromUpload(db, form.get("file"), form, {
    published: form.get("published") !== "false",
    ownerId: userId,
    rootTag: "shared",
    maxFiles: MAX_USER_UPLOAD_FILES,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ root: result.root, imported: result.imported }, { status: 201 })
}
