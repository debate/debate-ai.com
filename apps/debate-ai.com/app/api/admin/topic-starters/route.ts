import { NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"
import { asc, eq } from "drizzle-orm"
import { getAdminAccess } from "@/lib/auth/admin"
import { getDBFromContext } from "@/lib/database/context"
import { topicStarterItems } from "@/lib/database/schema"

const MAX_FILES = 100
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

async function docxToHtml(bytes: ArrayBuffer) {
  const zip = await JSZip.loadAsync(bytes)
  const xml = await zip.file("word/document.xml")?.async("string")
  if (!xml) throw new Error("The DOCX does not contain word/document.xml.")
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []
  const text = (paragraph: string) => [...paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")).join("")
  return paragraphs.map(text).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("") || "<p></p>"
}

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
  const upload = form.get("file")
  if (!(upload instanceof File)) return NextResponse.json({ error: "Choose a .docx or .zip file." }, { status: 400 })
  const name = upload.name.toLowerCase()
  if (!name.endsWith(".docx") && !name.endsWith(".zip")) return NextResponse.json({ error: "Only .docx and .zip uploads are supported." }, { status: 400 })

  const db = await getDBFromContext()
  const rootName = (form.get("title")?.toString().trim() || upload.name.replace(/\.(docx|zip)$/i, ""))
  const published = form.get("published") !== "false"
  const [root] = await db.insert(topicStarterItems).values({ title: rootName, isFolder: true, tags: JSON.stringify(["topic-starter"]), published }).returning()
  const files: Array<{ path: string; bytes: ArrayBuffer }> = []
  if (name.endsWith(".docx")) files.push({ path: upload.name, bytes: await upload.arrayBuffer() })
  else {
    const archive = await JSZip.loadAsync(await upload.arrayBuffer())
    for (const entry of Object.values(archive.files)) if (!entry.dir && entry.name.toLowerCase().endsWith(".docx")) files.push({ path: entry.name, bytes: await entry.async("arraybuffer") })
  }
  if (!files.length) return NextResponse.json({ error: "No DOCX files were found in that upload." }, { status: 400 })
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Uploads are limited to ${MAX_FILES} DOCX files.` }, { status: 400 })

  const folders = new Map<string, number>([["", root.id]])
  let imported = 0
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean)
    let parentId = root.id
    for (let index = 0; index < parts.length - 1; index++) {
      const path = parts.slice(0, index + 1).join("/")
      let folderId = folders.get(path)
      if (!folderId) {
        const [folder] = await db.insert(topicStarterItems).values({ title: parts[index]!, parentId, isFolder: true, tags: JSON.stringify(["folder"]), published }).returning()
        folderId = folder.id; folders.set(path, folderId)
      }
      parentId = folderId
    }
    const title = parts.at(-1)!.replace(/\.docx$/i, "")
    const content = await docxToHtml(file.bytes)
    await db.insert(topicStarterItems).values({ title, parentId, content, tags: JSON.stringify(["docx", published ? "public" : "private"]), published })
    imported++
  }
  return NextResponse.json({ root, imported }, { status: 201 })
}
