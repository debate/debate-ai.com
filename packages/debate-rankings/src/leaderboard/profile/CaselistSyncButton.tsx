/**
 * @fileoverview "Sync from openCaselist" — the admin-only button on team,
 * past-team and school pages. It runs the same two-step sync as the admin
 * panel's "Sync team from openCaselist" card (`/api/admin/caselist-team-sync`):
 * for each team, find its pages in this season and every earlier season of its
 * format (school by name, team by debater surnames or the team code
 * openCaselist builds from them, e.g. `GaYo`), save rounds, round reports and
 * cites, then download each open-source file, paced under openCaselist's ten
 * downloads a minute. Only the teams on the page are scraped.
 *
 * Hidden from everyone but admins (the endpoint is admin-only); when the
 * server has no openCaselist session it says so instead of offering the button.
 * @module leaderboard/profile/CaselistSyncButton
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "../ui/primitives/button"

/** One team to sync, as the rankings name it. */
export interface CaselistSyncTarget {
  /** Rankings dataset id (`cpd`, `hscx`, `hsld`, `hspf`), which picks the caselist format. */
  dataset: string
  school: string
  team: string
}

const ENDPOINT = "/api/admin/caselist-team-sync"
/** openCaselist allows ten downloads a minute per account. */
const FILE_GAP_MS = 6500
const RATE_LIMIT_WAIT_MS = 61_000
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const fileName = (path: string) => path.split("/").pop() ?? path

/** Datasets the caselist sync knows the format of. */
const SYNCABLE_DATASETS = new Set(["cpd", "hscx", "hsld", "hsld_sepoct", "hspf"])

let adminCheck: Promise<boolean> | null = null

/** Whether the viewer is an admin, asked once per page load. */
function viewerIsAdmin(): Promise<boolean> {
  adminCheck ??= fetch("/api/admin/me", { credentials: "include" })
    .then(async (response) => (response.ok ? Boolean(((await response.json()) as { isAdmin?: boolean }).isAdmin) : false))
    .catch(() => false)
  return adminCheck
}

/** Test-only: forget the cached admin check. */
export function resetCaselistSyncAdminCheck(): void {
  adminCheck = null
}

interface Status {
  phase: "pages" | "files" | "done"
  teamIndex: number
  seasons: number
  filesDone: number
  filesTotal: number
  current: string | null
  waiting: boolean
  failures: string[]
}

async function post(body: Record<string, string>) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { status: response.status, ok: response.ok, data }
}

/**
 * The admin-only sync button.
 *
 * @param props.targets - The teams to sync (one on a team page, every ranked
 *   entry on a school page).
 * @param props.label - Button text; defaults to "Sync from openCaselist".
 * @param props.onSynced - Called after a run that stored anything, so the
 *   Caselist section can reload.
 */
export function CaselistSyncButton({
  targets,
  label,
  onSynced,
  className,
}: {
  targets: CaselistSyncTarget[]
  label?: string
  onSynced?: () => void
  className?: string
}) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)
  const syncable = targets.filter((target) => SYNCABLE_DATASETS.has(target.dataset) && target.school && target.team)

  useEffect(() => {
    let live = true
    void viewerIsAdmin().then(async (admin) => {
      if (!live || !admin) return
      setIsAdmin(true)
      const response = await fetch(ENDPOINT, { credentials: "include" }).catch(() => null)
      const data = response?.ok ? ((await response.json()) as { configured?: boolean }) : null
      if (live) setConfigured(data ? Boolean(data.configured) : null)
    })
    return () => {
      live = false
    }
  }, [])

  if (!isAdmin || syncable.length === 0) return null

  const run = async () => {
    setBusy(true)
    setError(null)
    stopRef.current = false
    const state: Status = { phase: "pages", teamIndex: 0, seasons: 0, filesDone: 0, filesTotal: 0, current: null, waiting: false, failures: [] }
    const pending: string[] = []
    try {
      for (const [index, target] of syncable.entries()) {
        if (stopRef.current) break
        state.teamIndex = index
        setStatus({ ...state })
        const result = await post({ action: "pages", dataset: target.dataset === "hsld_sepoct" ? "hsld" : target.dataset, school: target.school, team: target.team })
        if (result.status === 503) throw new Error(String(result.data.error ?? "openCaselist is not configured on the server."))
        if (!result.ok) {
          state.failures.push(`${target.school} ${target.team}: ${String(result.data.error ?? `HTTP ${result.status}`)}`)
          continue
        }
        const pages = (result.data.pages ?? []) as unknown[]
        if (pages.length === 0) state.failures.push(`${target.school} ${target.team}: not found on openCaselist`)
        state.seasons += pages.length
        for (const path of (result.data.pendingFiles ?? []) as string[]) if (!pending.includes(path)) pending.push(path)
      }

      state.phase = "files"
      state.filesTotal = pending.length
      setStatus({ ...state })
      for (const [index, path] of pending.entries()) {
        if (stopRef.current) break
        if (index > 0) await sleep(FILE_GAP_MS)
        state.current = path
        setStatus({ ...state })
        let result = await post({ action: "file", path })
        if (result.status === 429 && !stopRef.current) {
          state.waiting = true
          setStatus({ ...state })
          await sleep(RATE_LIMIT_WAIT_MS)
          state.waiting = false
          result = await post({ action: "file", path })
        }
        if (!result.ok) state.failures.push(`${fileName(path)}: ${String(result.data.error ?? `HTTP ${result.status}`)}`)
        state.filesDone += 1
        setStatus({ ...state })
      }
      state.phase = "done"
      state.current = null
      setStatus({ ...state })
      if (state.seasons > 0) onSynced?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const many = syncable.length > 1
  return (
    <div className={className} data-testid="caselist-sync">
      {configured === false ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs">
          Admin: openCaselist sync is not configured. Set the <code>OPENCASELIST_API_KEY</code> secret (a caselist_token
          cookie from a signed-in openCaselist session), or <code>CASELIST_USERNAME</code> and{" "}
          <code>CASELIST_PASSWORD</code> (a Tabroom login).
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run()}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Syncing…" : (label ?? "Sync from openCaselist")}
          </Button>
          {busy && (
            <Button type="button" size="sm" variant="ghost" onClick={() => (stopRef.current = true)}>
              Stop
            </Button>
          )}
          {status && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {status.phase === "pages" &&
                `Finding ${many ? `team ${status.teamIndex + 1} of ${syncable.length}` : "the team"} on openCaselist…`}
              {status.phase === "files" &&
                `${status.seasons} season${status.seasons === 1 ? "" : "s"} saved · files ${status.filesDone}/${status.filesTotal}${
                  status.current ? ` — ${status.waiting ? "waiting out openCaselist's limit" : `fetching ${fileName(status.current)}`}` : ""
                }`}
              {status.phase === "done" &&
                `Done: ${status.seasons} season${status.seasons === 1 ? "" : "s"} saved, ${status.filesDone} file${
                  status.filesDone === 1 ? "" : "s"
                } stored.`}
            </span>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {status && status.failures.length > 0 && (
        <details className="mt-1 text-xs text-muted-foreground">
          <summary>{status.failures.length} problem{status.failures.length === 1 ? "" : "s"}</summary>
          <ul className="list-disc pl-5">
            {status.failures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
