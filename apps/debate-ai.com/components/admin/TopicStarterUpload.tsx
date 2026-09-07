"use client"

/**
 * @fileoverview Admin-only Topic Starter importer UI.
 *
 * Reports what actually happened to an upload: which files landed, which
 * failed, why each one failed, and the import id to quote when reading server
 * logs. A bulk DOCX import that silently drops half a camp file is worse than
 * one that refuses outright, so partial runs are shown as partial.
 */

import { useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, FileWarning, Upload } from "lucide-react"
import { Button } from "../../lib/ui/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../lib/ui/primitives/card"
import { Input } from "../../lib/ui/primitives/input"

/** One file the importer could not read, as returned by the API. */
interface ImportFailure {
  path: string
  code: string
  reason: string
}

/** Outcome of one import run, as rendered below the form. */
interface ImportOutcome {
  tone: "success" | "partial" | "error"
  summary: string
  detail?: string
  failures: ImportFailure[]
  importId?: string
}

/** Client-side ceiling, mirroring the server's upload limit. */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

const TONE_STYLES = {
  success: "border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400",
  partial: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  error: "border-destructive/40 bg-destructive/5 text-destructive",
} as const

const TONE_ICONS = { success: CheckCircle2, partial: FileWarning, error: AlertTriangle } as const

/**
 * Reads a response body without assuming it is JSON.
 *
 * A framework-level crash returns an HTML error page, and calling
 * `response.json()` on it throws `Unexpected token '<'` — an error message
 * that says nothing about the upload and sends the operator looking in the
 * wrong place. Falling back to the raw text surfaces the real status instead.
 *
 * @param response - The fetch response.
 * @returns Parsed JSON, or an error object describing the non-JSON body.
 */
async function readResponseBody(response: Response): Promise<Record<string, any>> {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    const snippet = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
    return {
      error: `The server returned ${response.status} ${response.statusText || "error"} instead of a result${snippet ? `: ${snippet}` : "."}`,
    }
  }
}

/** Admin-only importer. ZIP directory names are retained as public folders. */
export function TopicStarterUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [published, setPublished] = useState(true)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async () => {
    if (!file) return

    if (file.size === 0) {
      setOutcome({ tone: "error", summary: `"${file.name}" is empty (0 bytes).`, failures: [] })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setOutcome({
        tone: "error",
        summary: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB, over the 100MB upload limit. Split the archive and upload it in parts.`,
        failures: [],
      })
      return
    }

    setUploading(true)
    setOutcome(null)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("title", title)
      form.set("published", String(published))
      const response = await fetch("/api/admin/topic-starters", { method: "POST", body: form })
      const data = await readResponseBody(response)
      const failures: ImportFailure[] = Array.isArray(data.failures) ? data.failures : []

      if (!response.ok) {
        // Log the full body too — the summary shown here is deliberately
        // short, and the console keeps the codes and per-file detail.
        console.error("Topic Starter import failed", { status: response.status, ...data })
        setOutcome({
          tone: "error",
          summary: data.error || `Upload failed (HTTP ${response.status}).`,
          detail: data.code ? `Cause: ${data.code}` : undefined,
          failures,
          importId: data.importId,
        })
        return
      }

      if (failures.length > 0) console.warn("Topic Starter import completed with failures", data)
      setOutcome({
        tone: failures.length > 0 ? "partial" : "success",
        summary:
          data.summary ||
          `${data.imported} DOCX file${data.imported === 1 ? "" : "s"} added to Topic Starters.`,
        detail:
          failures.length > 0
            ? `${data.found} file${data.found === 1 ? "" : "s"} found in the upload — the ones below were skipped and can be fixed and re-uploaded on their own.`
            : "Published to CardMirror for everyone.",
        failures,
        importId: data.importId,
      })
      setFile(null)
      setTitle("")
      if (inputRef.current) inputRef.current.value = ""
    } catch (error) {
      // A network drop or an aborted request never reaches the server logs, so
      // this is the only record of it.
      console.error("Topic Starter import request failed", error)
      setOutcome({
        tone: "error",
        summary: `The upload never reached the server: ${(error as Error).message}. Check the connection and try again.`,
        failures: [],
      })
    } finally {
      setUploading(false)
    }
  }

  const ToneIcon = outcome ? TONE_ICONS[outcome.tone] : null

  return <Card>
    <CardHeader>
      <CardTitle>Topic Starter library</CardTitle>
      <CardDescription>Upload one DOCX or a ZIP containing up to 100 DOCX files (100MB max, 25MB per file). Every imported folder and file is published to CardMirror for everyone. Files that fail to convert are listed below with the reason, and the rest of the batch still imports.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">Folder name (optional)
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. 2026 energy topic" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">DOCX or ZIP
          <Input ref={inputRef} type="file" accept=".docx,.zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setOutcome(null) }} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Share publicly</label>
        <Button onClick={upload} disabled={!file || uploading}><Upload className="mr-2 h-4 w-4" />{uploading ? "Importing…" : "Publish files"}</Button>
      </div>

      {outcome && (
        <div role="status" aria-live="polite" className={`flex flex-col gap-2 rounded-md border p-3 text-sm ${TONE_STYLES[outcome.tone]}`}>
          <div className="flex items-start gap-2">
            {ToneIcon && <ToneIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium">{outcome.summary}</p>
              {outcome.detail && <p className="opacity-80">{outcome.detail}</p>}
            </div>
          </div>

          {outcome.failures.length > 0 && (
            <ul className="flex flex-col gap-1 border-t pt-2">
              {outcome.failures.map((failure) => (
                <li key={`${failure.path}-${failure.code}`} className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs break-all">{failure.path}</span>
                  <span className="text-xs opacity-90">{failure.reason}</span>
                </li>
              ))}
            </ul>
          )}

          {outcome.importId && (
            <p className="text-xs opacity-70">
              Import <span className="font-mono">{outcome.importId}</span> — search the server logs for this id, or open the browser console for the full response.
            </p>
          )}
        </div>
      )}
    </CardContent>
  </Card>
}
