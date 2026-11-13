"use client"

/**
 * @fileoverview Admin-only "Sync Topic Starters from openCaselist" UI.
 *
 * The panel used to take a DOCX or ZIP from the operator's machine. A season
 * archive from openCaselist is far larger, so this now starts a server-side
 * sync: the route streams the newest bulk ZIP into R2 and returns a job id,
 * and a background pass converts it to Debate Editor's native `.cmir`
 * (`app/api/admin/topic-starters/sync`, `lib/topic-starters/sync.ts`). The
 * card follows that job — queued, converting with a count, or finished with
 * the per-file failures — and reloads the tree when it lands.
 *
 * Format and topic dropdowns pick the resolution the imported files are filed
 * under, exactly as the old uploader did. The caselist and season pickers
 * choose what openCaselist archive to pull; the season dump is used when the
 * caselist has one, else its newest weekly archive.
 *
 * @module components/admin/topic-starters/TopicStarterUpload
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, FileWarning, FolderSync, Loader2, RefreshCw } from "lucide-react"
import { Button } from "../../../ui/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card"
import { TopicStarterLibraryTree } from "./TopicStarterLibraryTree"
import {
  CURRENT_SEASON,
  caselistSeasons,
  caselistsForSeason,
  seasonLabel,
} from "@debate-ai/research-evidence/src/caselist/caselist-config"
import {
  TOPIC_FORMATS,
  findTopicByCode,
  topicOptionLabel,
  topicOrDefault,
  topicsForFormat,
  type TopicFormat,
} from "@debate-ai/reason-docs/lib/reason-docs/topic-codes"

/** One file the sync could not convert, as returned by the API. */
interface ImportFailure {
  path: string
  code: string
  reason: string
}

/** The job row the sync endpoint returns and the panel polls. */
interface SyncJob {
  id: string
  caselistSlug: string
  caselistLabel: string
  archiveFileName: string
  topicCode: string | null
  year: number | null
  published: boolean
  status: "queued" | "processing" | "succeeded" | "partial" | "failed"
  found: number
  imported: number
  failed: number
  failures: ImportFailure[]
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

const TONE_STYLES = {
  success: "border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400",
  partial: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  error: "border-destructive/40 bg-destructive/5 text-destructive",
  progress: "border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-400",
} as const

const TONE_ICONS = { success: CheckCircle2, partial: FileWarning, error: AlertTriangle, progress: Loader2 } as const

const selectClass =
  "h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm font-normal text-foreground focus:outline-none focus:ring-1 focus:ring-ring"

/** "Policy 2027 · National Health Insurance" — how a topic is named in copy. */
function topicLabel(topic: { format: TopicFormat; year: number; name: string }): string {
  const format = TOPIC_FORMATS.find((item) => item.id === topic.format)?.label ?? topic.format
  return `${format} ${topic.year} · ${topic.name}`
}

/**
 * Reads a response body without assuming it is JSON.
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

/**
 * Admin-only sync. The newest archive of the picked caselist is downloaded to
 * R2 and converted in the background.
 *
 * @param props.onImported - Called when a sync finishes, so a surrounding
 *   panel (the admin Topic starters section) can reload its own tree.
 */
export function TopicStarterUpload({ onImported }: { onImported?: () => void } = {}) {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const [caselistSlug, setCaselistSlug] = useState(() => caselistsForSeason()[0]?.slug ?? "")
  const [published, setPublished] = useState(true)
  const [job, setJob] = useState<SyncJob | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [libraryVersion, setLibraryVersion] = useState(0)
  // The resolution the imported files are filed under; starts on the default
  // topic (the current high-school policy one), the library older imports
  // belong to.
  const [topicCode, setTopicCode] = useState(() => topicOrDefault(null)?.code ?? "")
  const topic = findTopicByCode(topicCode)
  const format: TopicFormat = topic?.format ?? "vcx"
  const caselists = useMemo(() => caselistsForSeason(season), [season])
  // Every topic of the format, grouped by year (newest first) for the dropdown.
  const topicsByYear = useMemo(() => {
    const groups = new Map<number, ReturnType<typeof topicsForFormat>>()
    for (const item of topicsForFormat(format)) groups.set(item.year, [...(groups.get(item.year) ?? []), item])
    return [...groups.entries()]
  }, [format])
  const announced = useRef<string | null>(null)

  /** Same year in the new format when it has one, else its newest topic. */
  const pickFormat = (next: TopicFormat) => {
    const candidates = topicsForFormat(next)
    setTopicCode((candidates.find((item) => item.year === topic?.year) ?? candidates[0])?.code ?? "")
  }

  const start = async () => {
    setStarting(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/topic-starters/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caselist: caselistSlug, topicCode: topic?.code ?? "", published }),
      })
      const data = await readResponseBody(response)
      if (!response.ok || !data.job) {
        setError(data.error || `The sync could not start (HTTP ${response.status}).`)
        return
      }
      setJob(data.job as SyncJob)
    } catch (caught) {
      setError(`The sync request never reached the server: ${(caught as Error).message}.`)
    } finally {
      setStarting(false)
    }
  }

  // Follow the job while it is queued or converting. The effect keys on the id
  // and status only, so a poll's own state update does not tear down the timer.
  const jobId = job?.id
  const jobStatus = job?.status
  useEffect(() => {
    if (!jobId || jobStatus === "succeeded" || jobStatus === "partial" || jobStatus === "failed") return
    let cancelled = false
    const tick = async () => {
      try {
        const response = await fetch(`/api/admin/topic-starters/sync?jobId=${encodeURIComponent(jobId)}`)
        const data = await readResponseBody(response)
        if (cancelled || !response.ok || !data.job) return
        setJob(data.job as SyncJob)
      } catch {
        // A dropped poll is not a failed sync; the next tick tries again.
      }
    }
    const timer = window.setInterval(() => void tick(), 3_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [jobId, jobStatus])

  // A finished sync lands its files in the tree below; reload it once per job.
  useEffect(() => {
    if (!job) return
    if (job.status !== "succeeded" && job.status !== "partial") return
    if (announced.current === job.id) return
    announced.current = job.id
    setLibraryVersion((version) => version + 1)
    onImported?.()
  }, [job, onImported])

  const tone = !job
    ? null
    : job.status === "succeeded"
      ? "success"
      : job.status === "partial"
        ? "partial"
        : job.status === "failed"
          ? "error"
          : "progress"
  const ToneIcon = tone ? TONE_ICONS[tone] : null
  const summary = !job
    ? null
    : job.status === "queued"
      ? `${job.archiveFileName} is stored in R2. Waiting for a background pass to convert it.`
      : job.status === "processing"
        ? `Converting ${job.archiveFileName}${job.found > 0 ? ` — ${job.imported} of ${job.found} file${job.found === 1 ? "" : "s"}` : ""}.`
        : job.status === "succeeded"
          ? `${job.imported} file${job.imported === 1 ? "" : "s"} converted to .cmir and added to Topic Starters${topic ? ` under ${topicLabel(topic)}` : ""}.`
          : job.status === "partial"
            ? `${job.imported} of ${job.found} files imported; ${job.failed} failed.`
            : job.error || "The sync failed."

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <FolderSync className="h-4 w-4" aria-hidden="true" />
        Sync Topic Starters from openCaselist
      </CardTitle>
      <CardDescription>Downloads a caselist&rsquo;s newest bulk archive from openCaselist into R2, then converts every <span className="font-mono">.docx</span> to Debate Editor&rsquo;s native <span className="font-mono">.cmir</span> in the background. The card outline, highlighting and comments survive the import, and every imported folder and file is published to Debate Editor. You can close this page once the archive is stored; the conversion carries on.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium">Season
          <select aria-label="Season" className={selectClass} value={season} onChange={(event) => {
            const next = Number(event.target.value)
            setSeason(next)
            setCaselistSlug(caselistsForSeason(next)[0]?.slug ?? "")
          }}>
            {caselistSeasons().map((option) => <option key={option} value={option}>{seasonLabel(option)}{option === CURRENT_SEASON ? " (this season)" : ""}</option>)}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">Caselist
          <select aria-label="Caselist" className={selectClass} value={caselistSlug} onChange={(event) => setCaselistSlug(event.target.value)}>
            {caselists.map((caselist) => <option key={caselist.slug} value={caselist.slug}>{caselist.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium">Format
          <select aria-label="Format" className={selectClass} value={format} onChange={(event) => pickFormat(event.target.value as TopicFormat)}>
            {TOPIC_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">Topic
          <select aria-label="Topic" title={topic?.text} className={selectClass} value={topicCode} onChange={(event) => setTopicCode(event.target.value)}>
            {topicsByYear.map(([year, items]) => (
              <optgroup key={year} label={String(year)}>
                {items.map((item) => <option key={item.code} value={item.code} title={item.text}>{year} · {topicOptionLabel(item)} ({item.code})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Each format and topic (topics are listed by year) has its own file tree in Debate Editor. Files imported here appear only in the tree for {topic ? topicLabel(topic) : "the selected topic"}, and the list below shows that tree.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Share publicly</label>
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          {job && (job.status === "queued" || job.status === "processing") && (
            <Button variant="outline" onClick={() => setJob(null)}>
              <RefreshCw className="mr-2 h-4 w-4" />Clear
            </Button>
          )}
          <Button onClick={() => void start()} disabled={starting || !caselistSlug || (job !== null && (job.status === "queued" || job.status === "processing"))}>
            {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderSync className="mr-2 h-4 w-4" />}
            {starting ? "Uploading…" : job && (job.status === "queued" || job.status === "processing") ? "Syncing…" : "Sync from openCaselist"}
          </Button>
        </div>
      </div>

      {error && (
        <div role="status" aria-live="polite" className={`flex items-start gap-2 rounded-md border p-3 text-sm ${TONE_STYLES.error}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {job && tone && (
        <div role="status" aria-live="polite" className={`flex flex-col gap-2 rounded-md border p-3 text-sm ${TONE_STYLES[tone]}`}>
          <div className="flex items-start gap-2">
            {ToneIcon && <ToneIcon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "progress" ? "animate-spin" : ""}`} aria-hidden="true" />}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium">{summary}</p>
              <p className="text-xs opacity-80">
                {job.caselistLabel} · {job.status}
                {job.finishedAt ? ` · ${new Date(job.finishedAt).toLocaleString()}` : ""}
              </p>
            </div>
          </div>

          {job.failures.length > 0 && (
            <ul className="flex flex-col gap-1 border-t pt-2">
              {job.failures.map((failure) => (
                <li key={`${failure.path}-${failure.code}`} className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs break-all">{failure.path}</span>
                  <span className="text-xs opacity-90">{failure.reason}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs opacity-70">
            Sync <span className="font-mono">{job.id}</span> — quote this id when reading the server logs.
          </p>
        </div>
      )}

      <TopicStarterLibraryTree reloadKey={libraryVersion} topicCode={topic?.code ?? null} />
    </CardContent>
  </Card>
}