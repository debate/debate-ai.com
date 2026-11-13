"use client"

/**
 * @fileoverview Admin-only manual Topic Starter file upload.
 *
 * Accepts one `.docx` or a `.zip` of them and posts it to
 * `/api/admin/topic-starters`, which converts each file to Debate Editor's
 * native `.cmir` and files it under the chosen topic's tree. This complements
 * the openCaselist sync by letting admins upload a local archive of starters.
 */

import { useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, FileWarning, Loader2, Upload } from "lucide-react"
import { Button } from "../../../ui/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card"
import { Input } from "../../../ui/primitives/input"
import {
  TOPIC_FORMATS,
  findTopicByCode,
  topicOptionLabel,
  topicOrDefault,
  topicsForFormat,
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

const selectClass =
  "h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm font-normal text-foreground focus:outline-none focus:ring-1 focus:ring-ring"

/** "Policy 2027 · National Health Insurance" — how a topic is named in copy. */
function topicLabel(topic: { format: TopicFormat; year: number; name: string }): string {
  const format = TOPIC_FORMATS.find((item) => item.id === topic.format)?.label ?? topic.format
  return `${format} ${topic.year} · ${topic.name}`
}

/**
 * Reads a response body without assuming it is JSON.
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

/** Admin-only manual upload. ZIP directory names are retained as folders. */
export function TopicStarterFileUpload({ onImported }: { onImported?: () => void } = {}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [published, setPublished] = useState(true)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const [uploading, setUploading] = useState(false)

  const [topicCode, setTopicCode] = useState(() => topicOrDefault(null)?.code ?? "")
  const topic = findTopicByCode(topicCode)
  const format: TopicFormat = topic?.format ?? "vcx"
  const topicsByYear = useMemo(() => {
    const groups = new Map<number, ReturnType<typeof topicsForFormat>>()
    for (const item of topicsForFormat(format)) groups.set(item.year, [...(groups.get(item.year) ?? []), item])
    return [...groups.entries()]
  }, [format])

  /** Same year in the new format when it has one, else its newest topic. */
  const pickFormat = (next: TopicFormat) => {
    const candidates = topicsForFormat(next)
    setTopicCode((candidates.find((item) => item.year === topic?.year) ?? candidates[0])?.code ?? "")
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
      form.set("published", String(published))
      if (topic?.code) form.set("topicCode", topic.code)
      const response = await fetch("/api/admin/topic-starters", { method: "POST", body: form })
      const data = await readResponseBody(response)
      const failures: ImportFailure[] = Array.isArray(data.failures) ? data.failures : []

      if (!response.ok) {
        console.error("Topic Starter upload failed", { status: response.status, ...data })
        setOutcome({
          tone: "error",
          summary: data.error || `Upload failed (HTTP ${response.status}).`,
          detail: data.code ? `Cause: ${data.code}` : undefined,
          failures,
          importId: data.importId,
        })
        return
      }

      if (failures.length > 0) console.warn("Topic Starter upload completed with failures", data)
      setOutcome({
        tone: failures.length > 0 ? "partial" : "success",
        summary:
          data.summary ||
          `${data.imported} file${data.imported === 1 ? "" : "s"} converted to .cmir and added to Topic Starters${topic ? ` under ${topicLabel(topic)}` : ""}.`,
        detail:
          failures.length > 0
            ? `${data.found} file${data.found === 1 ? "" : "s"} found in the upload — the ones below were skipped and can be fixed and re-uploaded on their own.`
            : "Stored as .cmir and published to Debate Editor.",
        failures,
        importId: data.importId,
      })
      setFile(null)
      if (inputRef.current) inputRef.current.value = ""
      onImported?.()
    } catch (error) {
      console.error("Topic Starter upload request failed", error)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4" aria-hidden="true" />
          Upload Topic Starters
        </CardTitle>
        <CardDescription>
          Upload one <span className="font-mono">.docx</span> or a <span className="font-mono">.zip</span> of starters. Each file is converted to
          Debate Editor&rsquo;s native <span className="font-mono">.cmir</span> (preserving card outline, highlighting and comments) and filed under the
          selected topic. ZIP directory names are kept as folders.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Format
            <select aria-label="Format" className={selectClass} value={format} onChange={(event) => pickFormat(event.target.value as TopicFormat)}>
              {TOPIC_FORMATS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Topic
            <select aria-label="Topic" title={topic?.text} className={selectClass} value={topicCode} onChange={(event) => setTopicCode(event.target.value)}>
              {topicsByYear.map(([year, items]) => (
                <optgroup key={year} label={String(year)}>
                  {items.map((item) => (
                    <option key={item.code} value={item.code} title={item.text}>
                      {year} · {topicOptionLabel(item)} ({item.code})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Files imported here appear in the tree for {topic ? topicLabel(topic) : "the selected topic"}.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            DOCX or ZIP
            <Input
              ref={inputRef}
              type="file"
              accept=".docx,.zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setOutcome(null)
              }}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Share publicly
          </label>
          <Button onClick={() => void upload()} disabled={!file || uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {uploading ? "Importing…" : "Upload files"}
          </Button>
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
                Import <span className="font-mono">{outcome.importId}</span> — quote this id when reading the server logs.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
