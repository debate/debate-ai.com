import JSZip from "jszip"
import type { getDBFromContext } from "@/lib/database/context"
import { topicStarterItems } from "@/lib/database/schema"

/**
 * Shared DOCX/ZIP importer for the shared-file library. Used by both the
 * admin Topic Starter uploader (`/api/admin/topic-starters`, `ownerId`
 * null) and the user-facing uploader (`/api/shared-files/upload`,
 * `ownerId` = the signed-in user), so the two never drift on how a Word
 * file becomes CardMirror-compatible HTML or how a zip's directory layout
 * becomes folder rows. See docs/features/shared-files.md.
 */

/** Most DOCX files one upload (a zip) may contain. */
export const MAX_IMPORT_FILES = 100

type DB = Awaited<ReturnType<typeof getDBFromContext>>

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

/** Extracts each paragraph's text from `word/document.xml` and wraps it in `<p>`. */
export async function docxToHtml(bytes: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)
  const xml = await zip.file("word/document.xml")?.async("string")
  if (!xml) throw new Error("The DOCX does not contain word/document.xml.")
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []
  const text = (paragraph: string) =>
    [...paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
      .join("")
  return paragraphs.map(text).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("") || "<p></p>"
}

/** Unpacks a `.docx` (one file) or a `.zip` (every `.docx` inside, with paths) into `{ path, bytes }` entries. */
export async function collectDocxFiles(upload: File): Promise<Array<{ path: string; bytes: ArrayBuffer }>> {
  const name = upload.name.toLowerCase()
  const files: Array<{ path: string; bytes: ArrayBuffer }> = []
  if (name.endsWith(".docx")) {
    files.push({ path: upload.name, bytes: await upload.arrayBuffer() })
  } else if (name.endsWith(".zip")) {
    const archive = await JSZip.loadAsync(await upload.arrayBuffer())
    for (const entry of Object.values(archive.files)) {
      if (!entry.dir && entry.name.toLowerCase().endsWith(".docx") && !entry.name.includes("__MACOSX")) {
        files.push({ path: entry.name, bytes: await entry.async("arraybuffer") })
      }
    }
  }
  return files
}

export interface ImportSharedFilesOptions {
  /** Root folder title. Defaults to the upload's file name without its extension. */
  title?: string
  published: boolean
  /** `null` for an admin Topic Starter pack; the uploading user's id otherwise. */
  ownerId: string | null
  /** Tag applied to the root folder — `"topic-starter"` for admin packs, `"shared"` for user uploads. */
  rootTag?: string
  /** Cap on the number of DOCX files accepted from this upload. */
  maxFiles?: number
}

export type ImportSharedFilesResult =
  | { ok: true; root: typeof topicStarterItems.$inferSelect; imported: number }
  | { ok: false; status: number; error: string }

/**
 * Validates an upload and inserts one root folder plus a row per DOCX,
 * recreating any zip directory structure as nested folder rows.
 */
export async function importSharedFilesFromUpload(
  db: DB,
  upload: unknown,
  form: FormData,
  options: ImportSharedFilesOptions,
): Promise<ImportSharedFilesResult> {
  if (!(upload instanceof File)) return { ok: false, status: 400, error: "Choose a .docx or .zip file." }
  const name = upload.name.toLowerCase()
  if (!name.endsWith(".docx") && !name.endsWith(".zip")) {
    return { ok: false, status: 400, error: "Only .docx and .zip uploads are supported." }
  }

  const files = await collectDocxFiles(upload)
  if (!files.length) return { ok: false, status: 400, error: "No DOCX files were found in that upload." }
  const maxFiles = options.maxFiles ?? MAX_IMPORT_FILES
  if (files.length > maxFiles) return { ok: false, status: 400, error: `Uploads are limited to ${maxFiles} DOCX files.` }

  const rootName = options.title?.trim() || form.get("title")?.toString().trim() || upload.name.replace(/\.(docx|zip)$/i, "")
  const { published, ownerId } = options
  const [root] = await db
    .insert(topicStarterItems)
    .values({ title: rootName, isFolder: true, tags: JSON.stringify([options.rootTag ?? "shared"]), published, ownerId })
    .returning()

  const folders = new Map<string, number>([["", root.id]])
  let imported = 0
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean)
    let parentId = root.id
    for (let index = 0; index < parts.length - 1; index++) {
      const path = parts.slice(0, index + 1).join("/")
      const known = folders.get(path)
      if (known !== undefined) {
        parentId = known
        continue
      }
      const [folder] = await db
        .insert(topicStarterItems)
        .values({ title: parts[index]!, parentId, isFolder: true, tags: JSON.stringify(["folder"]), published, ownerId })
        .returning()
      folders.set(path, folder.id)
      parentId = folder.id
    }
    const title = parts.at(-1)!.replace(/\.docx$/i, "")
    const content = await docxToHtml(file.bytes)
    await db
      .insert(topicStarterItems)
      .values({ title, parentId, content, tags: JSON.stringify(["docx", published ? "public" : "private"]), published, ownerId })
    imported++
  }
  return { ok: true, root, imported }
}
