"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "../../lib/ui/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../lib/ui/primitives/card"
import { Input } from "../../lib/ui/primitives/input"

/** Admin-only importer. ZIP directory names are retained as public folders. */
export function TopicStarterUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [published, setPublished] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async () => {
    if (!file) return
    setUploading(true); setMessage(null)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("title", title)
      form.set("published", String(published))
      const response = await fetch("/api/admin/topic-starters", { method: "POST", body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Upload failed")
      setMessage(`${data.imported} public DOCX file${data.imported === 1 ? "" : "s"} added to Topic Starters.`)
      setFile(null); setTitle("")
      if (inputRef.current) inputRef.current.value = ""
    } catch (error) { setMessage((error as Error).message) } finally { setUploading(false) }
  }

  return <Card>
    <CardHeader>
      <CardTitle>Topic Starter library</CardTitle>
      <CardDescription>Upload one DOCX or a ZIP containing up to 100 DOCX files. Every imported folder and file is published to CardMirror for everyone.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">Folder name (optional)
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. 2026 energy topic" />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">DOCX or ZIP
        <Input ref={inputRef} type="file" accept=".docx,.zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Share publicly</label>
      <Button onClick={upload} disabled={!file || uploading}><Upload className="mr-2 h-4 w-4" />{uploading ? "Importing…" : "Publish files"}</Button>
      {message && <p className="text-sm text-muted-foreground sm:col-span-full">{message}</p>}
    </CardContent>
  </Card>
}
