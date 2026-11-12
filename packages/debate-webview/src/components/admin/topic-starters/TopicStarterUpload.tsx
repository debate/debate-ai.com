"use client"

/**
 * @fileoverview Admin-only Topic Starter importer UI.
 *
 * Uploads are DOCX; what the library keeps is Debate Editor's native `.cmir`,
 * converted server-side (see `app/api/admin/topic-starters/route.ts`), which
 * the copy below says plainly — an operator who uploads a Verbatim file
 * should know which format their teammates will open.
 *
 * Reports what actually happened to an upload: which files landed, which
 * failed, why each one failed, and the import id to quote when reading server
 * logs. A bulk DOCX import that silently drops half a camp file is worse than
 * one that refuses outright, so partial runs are shown as partial.
 *
 * Format, year and topic dropdowns pick the resolution an upload is filed
 * under. Its topic code (`vcx27`, `lda27`) goes with the upload and is
 * stamped on every imported row, and each topic has its own file tree in
 * Debate Editor — the one its format / topic picker shows
 * (`@debate-ai/reason-docs/lib/topic-starters/topic-scope`).
 *
 * Below the form, {@link TopicStarterLibraryTree} lists what has been
 * imported under the selected topic so an admin can move or delete it; it
 * reloads after each upload and whenever the dropdowns change.
 */

import { useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, FileWarning, Upload } from "lucide-react"
import { Button } from "../../../ui/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card"
import { Input } from "../../../ui/primitives/input"
import { TopicStarterLibraryTree } from "./TopicStarterLibraryTree"
import {
  TOPIC_FORMATS,
  findTopicByCode,
  topicOptionLabel,
  topicOrDefault,
  topicsForFormat,
  yearsForFormat,
  type TopicFormat,
} from "@debate-ai/reason-docs/lib/reason-docs/topic-codes"

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

const selectClass =
  "h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm font-normal text-foreground focus:outline-none focus:ring-1 focus:ring-ring"

/** "Policy 2027 · National Health Insurance" — how a topic is named in copy. */
function topicLabel(topic: { format: TopicFormat; year: number; name: string }): string {
  const format = TOPIC_FORMATS.find((item) => item.id === topic.format)?.label ?? topic.format
  return `${format} ${topic.year} · ${topic.name}`
}

/**
 * Admin-only importer. ZIP directory names are retained as public folders.
 *
 * @param props.onImported - Called after an upload lands, so a surrounding
 *   panel (the admin Topic starters section) can reload its own tree.
 */
export function TopicStarterUpload({ onImported }: { onImported?: () => void } = {}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [published, setPublished] = useState(true)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const [uploading, setUploading] = useState(false)
  const [libraryVersion, setLibraryVersion] = useState(0)
  // The resolution the upload is filed under; starts on the default topic
  // (the current high-school policy one), the library older imports belong to.
  const [topicCode, setTopicCode] = useState(() => topicOrDefault(null)?.code ?? "")
  const topic = findTopicByCode(topicCode)
  const format: TopicFormat = topic?.format ?? "vcx"
  const years = useMemo(() => yearsForFormat(format), [format])
  const yearTopics = useMemo(
    () => topicsForFormat(format).filter((item) => item.year === topic?.year),
    [format, topic?.year],
  )

  /** Same year in the new format when it has one, else its newest topic. */
  const pickFormat = (next: TopicFormat) => {
    const candidates = topicsForFormat(next)
    setTopicCode((candidates.find((item) => item.year === topic?.year) ?? candidates[0])?.code ?? "")
  }

  /** That year's first topic of the current format. */
  const pickYear = (year: number) => {
    setTopicCode(topicsForFormat(format).find((item) => item.year === year)?.code ?? "")
  }

  const upload = async () => {
    if (!file) return

    if (file.size === 0) {
      setOutcome({ tone: "error", summary: `"${file.name}" is empty (0 bytes).`, failures: [] })
      return
    }

    setUploading(true)
    setOutcome(null)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("title", title)
      form.set("published", String(published))
      if (topic) form.set("topicCode", topic.code)
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

      setLibraryVersion((version) => version + 1)
      onImported?.()
      if (failures.length > 0) console.warn("Topic Starter import completed with failures", data)
      setOutcome({
        tone: failures.length > 0 ? "partial" : "success",
        summary:
          data.summary ||
          `${data.imported} file${data.imported === 1 ? "" : "s"} converted to .cmir and added to Topic Starters${topic ? ` under ${topicLabel(topic)}` : ""}.`,
        detail:
          failures.length > 0
            ? `${data.found} file${data.found === 1 ? "" : "s"} found in the upload — the ones below were skipped and can be fixed and re-uploaded on their own.`
            : "Stored as .cmir and published to Debate Editor for everyone.",
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
      <CardTitle>Upload Topic Starters</CardTitle>
      <CardDescription>Upload one DOCX or a ZIP of them — there is no cap on how many files an archive holds or how large they are. Each file is converted to Debate Editor&rsquo;s native <span className="font-mono">.cmir</span> format and stored that way, so the card outline, highlighting and comments survive the import. Every imported folder and file is published to Debate Editor for everyone. Files that fail to convert are listed below with the reason, and the rest of the batch still imports.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium">Format
          <select aria-label="Format" className={selectClass} value={format} onChange={(event) => pickFormat(event.target.value as TopicFormat)}>
            {TOPIC_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Year
          <select aria-label="Year" className={selectClass} value={topic?.year ?? ""} onChange={(event) => pickYear(Number(event.target.value))}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">Topic
          <select aria-label="Topic" title={topic?.text} className={selectClass} value={topicCode} onChange={(event) => setTopicCode(event.target.value)}>
            {yearTopics.map((item) => <option key={item.code} value={item.code} title={item.text}>{topicOptionLabel(item)} ({item.code})</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Each format, year and topic has its own file tree in Debate Editor. Files imported here appear only in the tree for {topic ? topicLabel(topic) : "the selected topic"}, and the list below shows that tree.</p>
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

      <TopicStarterLibraryTree reloadKey={libraryVersion} topicCode={topic?.code ?? null} />
    </CardContent>
  </Card>
}
