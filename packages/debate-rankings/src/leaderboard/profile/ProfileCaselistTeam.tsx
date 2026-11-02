/**
 * @fileoverview The Caselist section of a team profile, under the videos: the
 * team's openCaselist page, modelled on openCaselist's own team page — a
 * rounds table (tournament, round, side, opponent, judge, round report and
 * the open-source `.docx`) and the wiki "Cites" list (argument titles that
 * expand to their cite text), both filterable by side.
 *
 * Data comes from `/api/caselist-team` (the host resolves the ranked team to
 * its caselist page). When the server has no openCaselist session, or no
 * page matches, the section falls back to {@link ProfileCaselistDocuments} —
 * the files already unpacked from the weekly bulk archives.
 * @module leaderboard/profile/ProfileCaselistTeam
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Copy, Download, ExternalLink, FileText } from "lucide-react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/primitives/tabs"
import { CaselistMarkdown } from "./CaselistMarkdown"
import { ProfileCaselistDocuments } from "./ProfileCaselistDocuments"

/** One round, as `/api/caselist-team` returns it. */
export interface CaselistTeamRound {
  id: number
  side: string
  sideLabel: string
  tournament: string
  round: string
  roundLabel: string
  opponent: string | null
  judge: string | null
  report: string | null
  video: string | null
  file: { path: string; name: string; url: string } | null
}

/** One wiki cite entry, as `/api/caselist-team` returns it. */
export interface CaselistTeamCite {
  id: number
  roundId: number
  title: string
  cites: string
  side: string
  sideLabel: string
  tournament: string | null
  roundLabel: string
  opponent: string | null
  judge: string | null
  createdAt: string | null
}

/** The `/api/caselist-team` payload. */
export interface CaselistTeamPayload {
  configured: boolean
  found: boolean
  caselist: { name: string; displayName: string; event: string | null; level: string | null; year: number } | null
  school: { name: string; displayName: string } | null
  team: { name: string; displayName: string; debaters: string[] } | null
  pageUrl: string | null
  rounds: CaselistTeamRound[]
  cites: CaselistTeamCite[]
  error?: string
}

interface ProfileCaselistTeamProps {
  /** Rankings dataset id (`hspf`, `hsld`, `hscx`, `cpd`), which picks the caselist format. */
  dataset: string
  /** School and team name as the rankings show them. */
  school: string
  team: string
}

type SideFilter = "all" | "A" | "N"

/** The side chip, coloured like the team labels: blue aff/pro, red neg/con. */
function SideBadge({ side, label }: { side: string; label: string }) {
  if (!label) return null
  const tone =
    side === "A"
      ? "border-blue-500/50 text-blue-700 dark:text-blue-300"
      : side === "N"
        ? "border-red-500/50 text-red-700 dark:text-red-300"
        : "text-muted-foreground"
  return (
    <Badge variant="outline" className={`text-xs ${tone}`}>
      {label}
    </Badge>
  )
}

/** All / Aff / Neg chips, as on openCaselist's team page. */
function SideFilterChips({
  value,
  onChange,
  labels,
}: {
  value: SideFilter
  onChange: (value: SideFilter) => void
  labels: { A: string; N: string }
}) {
  const options: { id: SideFilter; label: string }[] = [
    { id: "all", label: "Both" },
    { id: "A", label: labels.A },
    { id: "N", label: labels.N },
  ]
  return (
    <div role="group" aria-label="Filter by side" className="flex gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
            value === option.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** The rounds table: one row per disclosed round, with its report and file. */
function RoundsTable({ rounds }: { rounds: CaselistTeamRound[] }) {
  const [openReports, setOpenReports] = useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setOpenReports((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (rounds.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No rounds disclosed for this side.</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Tournament</th>
            <th className="px-3 py-2 font-medium">Round</th>
            <th className="px-3 py-2 font-medium">Side</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Opponent</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Judge</th>
            <th className="px-3 py-2 font-medium">Round report</th>
            <th className="px-3 py-2 font-medium">Open source</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => {
            const open = openReports.has(round.id)
            return (
              <tr key={round.id} className="border-t align-top">
                <td className="px-3 py-2 font-medium">{round.tournament}</td>
                <td className="whitespace-nowrap px-3 py-2">{round.roundLabel}</td>
                <td className="px-3 py-2">
                  <SideBadge side={round.side} label={round.sideLabel} />
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">{round.opponent || "—"}</td>
                <td className="hidden px-3 py-2 md:table-cell">{round.judge || "—"}</td>
                <td className="max-w-xs px-3 py-2">
                  {round.report ? (
                    <button
                      type="button"
                      onClick={() => toggle(round.id)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
                    >
                      {open ? (
                        <ChevronDown className="mt-0.5 h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />
                      )}
                      <span className={open ? "whitespace-pre-wrap" : "line-clamp-2"}>{round.report}</span>
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {round.file ? (
                    <a
                      href={round.file.url}
                      download={round.file.name}
                      title={round.file.name}
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Download className="h-3 w-3" />
                      .{round.file.name.split(".").pop()}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** The wiki cites: titles that expand to their cite text, newest first. */
function CitesList({ cites }: { cites: CaselistTeamCite[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState<number | null>(null)
  const allOpen = cites.length > 0 && cites.every((cite) => open.has(cite.id))
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (cites.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No cited arguments for this side.</p>
  }
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setOpen(allOpen ? new Set() : new Set(cites.map((cite) => cite.id)))}
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <ul className="divide-y rounded-lg border">
        {cites.map((cite) => {
          const isOpen = open.has(cite.id)
          const meta = [cite.tournament, cite.roundLabel, cite.opponent && `vs ${cite.opponent}`, cite.judge]
            .filter(Boolean)
            .join(" · ")
          return (
            <li key={cite.id} className="px-3 py-2">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => toggle(cite.id)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium">{cite.title}</span>
                    {meta && <span className="block text-xs text-muted-foreground">{meta}</span>}
                  </span>
                </button>
                <SideBadge side={cite.side} label={cite.sideLabel} />
                <button
                  type="button"
                  title="Copy cites"
                  aria-label={`Copy cites for ${cite.title}`}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    void navigator.clipboard?.writeText(`${cite.title}\n${cite.cites}`)
                    setCopied(cite.id)
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              {copied === cite.id && <p className="ml-6 text-xs text-muted-foreground">Copied</p>}
              {isOpen && (
                <div className="ml-6 mt-2 rounded border bg-muted/30 p-3">
                  {cite.cites.trim() ? (
                    <CaselistMarkdown text={cite.cites} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No cite text.</p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The team's caselist page under its videos; see the module note. */
export function ProfileCaselistTeam({ dataset, school, team }: ProfileCaselistTeamProps) {
  const [payload, setPayload] = useState<CaselistTeamPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [side, setSide] = useState<SideFilter>("all")

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setPayload(null)
    const params = new URLSearchParams({ dataset, school, team })
    fetch(`/api/caselist-team?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as CaselistTeamPayload) : null))
      .then((data) => setPayload(data))
      .catch(() => setPayload(null))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [dataset, school, team])

  const pf = payload?.caselist?.event === "pf"
  const sideLabels = { A: pf ? "Pro" : "Aff", N: pf ? "Con" : "Neg" }
  const rounds = useMemo(
    () => (payload?.rounds ?? []).filter((round) => side === "all" || round.side === side),
    [payload, side],
  )
  const cites = useMemo(
    () => (payload?.cites ?? []).filter((cite) => side === "all" || cite.side === side),
    [payload, side],
  )

  if (loading) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Caselist</h2>
        <p className="py-6 text-center text-sm text-muted-foreground">Loading caselist…</p>
      </section>
    )
  }

  // No session on the server, or no matching page: show the archive files instead.
  if (!payload?.found || !payload.caselist || !payload.team) {
    return <ProfileCaselistDocuments school={school} team={team} />
  }

  const fileCount = payload.rounds.filter((round) => round.file).length
  return (
    <section className="mt-8" aria-label="Caselist">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-foreground">Caselist</h2>
        <span className="text-sm text-muted-foreground">
          {payload.caselist.displayName} · {payload.team.displayName}
        </span>
        {payload.pageUrl && (
          <a
            href={payload.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            openCaselist page <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <Tabs defaultValue="rounds">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="rounds">
              <FileText className="mr-1 h-3.5 w-3.5" />
              Rounds &amp; files ({payload.rounds.length})
            </TabsTrigger>
            <TabsTrigger value="cites">Cited arguments ({payload.cites.length})</TabsTrigger>
          </TabsList>
          <SideFilterChips value={side} onChange={setSide} labels={sideLabels} />
        </div>
        <TabsContent value="rounds">
          <RoundsTable rounds={rounds} />
          <p className="mt-2 text-xs text-muted-foreground">
            {fileCount} open-source document{fileCount === 1 ? "" : "s"} disclosed.
          </p>
        </TabsContent>
        <TabsContent value="cites">
          <CitesList cites={cites} />
        </TabsContent>
      </Tabs>
      {payload.error && <p className="mt-2 text-xs text-muted-foreground">{payload.error}</p>}
      <div className="mt-3">
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/search?caselist=1&school=${encodeURIComponent(payload.school?.name ?? school)}&team=${encodeURIComponent(
              payload.team.name,
            )}`}
          >
            Search these files&apos; cards
          </a>
        </Button>
      </div>
    </section>
  )
}
