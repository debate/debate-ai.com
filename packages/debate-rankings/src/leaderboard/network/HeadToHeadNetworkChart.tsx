/**
 * @fileoverview "Who debated whom": the season's top entries as a network
 * graph, linked by the rounds they debated each other. Hovering (or tapping)
 * an entry fades everyone it never met and thickens its links, like ECharts'
 * `emphasis.focus: "adjacency"`; hovering a link shows that pairing's record.
 * Drawn as plain SVG in the same card and tooltip style as the rankings
 * page's Recharts charts (Recharts has no graph series).
 * @module @debate-ai/rankings/leaderboard/network/HeadToHeadNetworkChart
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { Minus, Network, Plus, RotateCcw, X } from "lucide-react"
import { formatSiteRating, loadCsvRankingDataset } from "../../rating-offset"
import { teamSearchNames } from "../../team-lookup"
import type { RankingDatasetId, RankingEntry } from "../../types"
import type { VideoDebateStyle as DebateStyle } from "../../topics/debate-topics"
import { teamHref } from "../profile/rankingProfileHelpers"
import {
  buildHeadToHeadNetwork,
  nodeOpponents,
  tabroomRoundUrl,
  tournamentLabel,
  type HeadToHeadNetwork,
  type NetworkMeeting,
  type HeadToHeadRound,
} from "./headToHeadNetwork"
import { HeadToHeadVideos } from "./HeadToHeadVideosSlot"
import { loadHeadToHeadRounds } from "./loadHeadToHeadRounds"
import { wheelZoomFactor, zoomAbout, type NetworkView } from "./networkZoom"

/** Video library style each rankings dataset covers (Policy / PF / LD / College). */
const DATASET_VIDEO_STYLE: Partial<Record<RankingDatasetId, DebateStyle>> = {
  hscx: 1,
  hspf: 2,
  hsld: 3,
  hsld_sepoct: 3,
  cpd: 4,
}

/** One color per rank band, best band first. */
export const NETWORK_COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#16a34a", "#ca8a04"]

/** Fewest matched entries before the graph falls back to the bundled CSV rankings. */
const MIN_MATCHED_NODES = 12

/** Top-ranked entries labelled without hovering. */
const ALWAYS_LABELLED = 10

/** What is hovered or pinned. */
type Focus = { kind: "node"; index: number } | { kind: "link"; index: number }

/** A node's radius: 4–14px by rating within the graph. */
function radii(network: HeadToHeadNetwork): number[] {
  const ratings = network.nodes.map((node) => node.entry.adjustedRating)
  const min = Math.min(...ratings)
  const span = Math.max(...ratings) - min || 1
  return ratings.map((rating) => 4 + ((rating - min) / span) * 10)
}

/** A curved link path (ECharts' `curveness: 0.3`). */
function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const cx = mx + (y2 - y1) * 0.15
  const cy = my - (x2 - x1) * 0.15
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`
}

/** Short label for a node: the school without "University", plus the team code. */
function nodeLabel(entry: RankingEntry): string {
  const school = entry.school.replace(/\s*\([^)]*\)\s*$/, "")
  const surnames = entry.name
    .split("&")
    .map((name) => name.trim().split(/\s+/).at(-1)?.[0] ?? "")
    .join("")
  return entry.name.includes("&") ? `${school} ${surnames}` : entry.name
}

function sameFocus(a: Focus | null, b: Focus | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.index === b.index
}

/** "Kentucky RR Round 3", or the tournament alone when the round has no name. */
function meetingLabel(meeting: Pick<NetworkMeeting, "tournament" | "roundLabel">): string {
  return [tournamentLabel(meeting.tournament), meeting.roundLabel].filter(Boolean).join(" ")
}

/** A link to a round's Tabroom pairing, or plain text when its id is unknown. */
function RoundLink({
  meeting,
  className,
  title,
  children,
}: {
  meeting: Pick<NetworkMeeting, "roundId" | "tournament" | "roundLabel">
  className?: string
  title?: string
  children: ReactNode
}) {
  if (!meeting.roundId) return <span className={className} title={title}>{children}</span>
  return (
    <a
      href={tabroomRoundUrl(meeting.roundId)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className ?? ""} hover:underline`}
      title={title ?? `${meetingLabel(meeting)} on Tabroom`}
    >
      {children}
    </a>
  )
}

/**
 * What a hovered or clicked entry or link shows. `interactive` (the pinned
 * corner card) lists every opponent with links to the rounds and matching
 * library videos; the hover card shows the first ten opponents only.
 */
function FocusCard({
  network,
  focus,
  interactive = false,
  videoStyles = [],
}: {
  network: HeadToHeadNetwork
  focus: Focus
  interactive?: boolean
  /** Debate styles for the active rankings format (empty skips the videos slot). */
  videoStyles?: readonly DebateStyle[]
}) {
  if (focus.kind === "node") {
    const node = network.nodes[focus.index]
    const opponents = nodeOpponents(network, focus.index)
    const shown = interactive ? opponents : opponents.slice(0, 10)
    const competitors = teamSearchNames(node.entry)
    return (
      <>
        <p className="font-semibold">
          <span className="tabular-nums text-muted-foreground">#{node.entry.rank}</span>{" "}
          {interactive ? (
            <Link href={teamHref(node.entry)} className="hover:underline">
              {node.entry.school}
            </Link>
          ) : (
            node.entry.school
          )}
        </p>
        <p className="mb-1.5 text-muted-foreground">
          {node.entry.name} · rating {formatSiteRating(node.entry.adjustedRating)}
        </p>
        <p className="mb-1 font-medium">
          Met {opponents.length} of the top {network.nodes.length} in {node.rounds} round{node.rounds === 1 ? "" : "s"}
        </p>
        <ul className="space-y-0.5">
          {shown.map((o) => (
            <li key={o.node.id}>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: NETWORK_COLORS[o.node.category] }} />
                <span className="tabular-nums text-muted-foreground">#{o.node.entry.rank}</span>
                {interactive ? (
                  <RoundLink
                    meeting={o.meetings[0]}
                    className="min-w-0 flex-1 truncate text-blue-600 dark:text-blue-400"
                    title={`vs ${nodeLabel(o.node.entry)}: ${meetingLabel(o.meetings[0])} on Tabroom`}
                  >
                    {nodeLabel(o.node.entry)}
                  </RoundLink>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{nodeLabel(o.node.entry)}</span>
                )}
                <span
                  className={`tabular-nums font-medium ${
                    o.wins > o.losses ? "text-green-600" : o.wins < o.losses ? "text-red-600" : ""
                  }`}
                >
                  {o.wins}–{o.losses}
                </span>
              </div>
              {interactive && o.meetings.length > 1 && (
                <div className="mb-0.5 ml-3.5 flex flex-wrap gap-1">
                  {o.meetings.map((m, k) => (
                    <RoundLink
                      key={k}
                      meeting={m}
                      className={`rounded border px-1 text-[10px] leading-4 ${m.won ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
                    >
                      {meetingLabel(m)} {m.won ? "W" : "L"}
                    </RoundLink>
                  ))}
                </div>
              )}
            </li>
          ))}
          {opponents.length > shown.length && (
            <li className="text-muted-foreground">+{opponents.length - shown.length} more · click to see all</li>
          )}
        </ul>
        {interactive && videoStyles.length > 0 && (
          <HeadToHeadVideos competitors={competitors} styles={videoStyles} />
        )}
      </>
    )
  }
  const link = network.links[focus.index]
  const sides: [HeadToHeadNetwork["nodes"][number], number][] = [
    [network.nodes[link.source], link.sourceWins],
    [network.nodes[link.target], link.targetWins],
  ]
  const groupA = teamSearchNames(sides[0][0].entry)
  const groupB = teamSearchNames(sides[1][0].entry)
  return (
    <>
      {sides.map(([n, wins]) => (
        <p key={n.id} className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: NETWORK_COLORS[n.category] }} />
          <span className="tabular-nums text-muted-foreground">#{n.entry.rank}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{nodeLabel(n.entry)}</span>
          <span className="tabular-nums font-semibold">{wins}</span>
        </p>
      ))}
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {link.meetings.map((m, k) => (
          <li key={k}>
            {interactive ? (
              <RoundLink meeting={m} className="text-blue-600 dark:text-blue-400">
                {meetingLabel(m)}
              </RoundLink>
            ) : (
              meetingLabel(m)
            )}
            : {nodeLabel((m.sourceWon ? sides[0] : sides[1])[0].entry)} won
          </li>
        ))}
      </ul>
      {interactive && videoStyles.length > 0 && (
        <HeadToHeadVideos
          competitors={[...groupA, ...groupB]}
          styles={videoStyles}
          requireGroups={[groupA, groupB]}
        />
      )}
    </>
  )
}

export function HeadToHeadNetworkChart({
  network,
  formatLabel,
  videoStyles = [],
  className = "",
}: {
  network: HeadToHeadNetwork
  /** Format name for the copy, e.g. "Policy". */
  formatLabel: string
  /** Debate styles used to find library videos for pinned cards. */
  videoStyles?: readonly DebateStyle[]
  className?: string
}) {
  const [hovered, setHovered] = useState<Focus | null>(null)
  const [pinned, setPinned] = useState<Focus | null>(null)
  const [hiddenCategories, setHiddenCategories] = useState<Set<number>>(() => new Set())
  const [view, setView] = useState<NetworkView>({ x: 0, y: 0, k: 1 })
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)
  const focus = hovered ?? pinned

  const r = useMemo(() => radii(network), [network])
  const visible = useMemo(
    () => network.nodes.map((node) => !hiddenCategories.has(node.category)),
    [network, hiddenCategories],
  )

  /** Nodes and links lit by the focus; `null` when nothing is focused. */
  const lit = useMemo(() => {
    if (!focus) return null
    const nodes = new Set<number>()
    const links = new Set<number>()
    if (focus.kind === "node") {
      nodes.add(focus.index)
      for (const n of network.nodes[focus.index].neighbors) nodes.add(n)
      network.links.forEach((link, i) => {
        if (link.source === focus.index || link.target === focus.index) links.add(i)
      })
    } else {
      const link = network.links[focus.index]
      nodes.add(link.source).add(link.target)
      links.add(focus.index)
    }
    return { nodes, links }
  }, [focus, network])

  /** Node indexes in paint order: the focused entry and its opponents last, so they sit on top. */
  const drawOrder = useMemo(() => {
    const all = network.nodes.map((_, i) => i)
    if (!lit) return all
    const focusIndex = focus?.kind === "node" ? focus.index : -1
    return [
      ...all.filter((i) => !lit.nodes.has(i)),
      ...all.filter((i) => lit.nodes.has(i) && i !== focusIndex),
      ...(focusIndex >= 0 ? [focusIndex] : []),
    ]
  }, [network, lit, focus])

  const counts = useMemo(
    () => network.categories.map((_, c) => network.nodes.filter((node) => node.category === c).length),
    [network],
  )

  const toggleCategory = (c: number) =>
    setHiddenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  const zoom = (factor: number) => setView((v) => zoomAbout(v, factor, network.width / 2, network.height / 2))

  /** A client-space point in the graph's own (viewBox) coordinates. */
  const toGraph = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || !rect.width) return { x: network.width / 2, y: network.height / 2 }
    const scale = network.width / rect.width
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale }
  }

  // React attaches wheel listeners as passive, which cannot stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const scale = rect.width ? network.width / rect.width : 1
      const x = (event.clientX - rect.left) * scale
      const y = (event.clientY - rect.top) * scale
      setView((v) => zoomAbout(v, wheelZoomFactor(event), x, y))
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [network.width, network.nodes.length])

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()]
        pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
        drag.current = null
        return
      }
    }
    drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y, moved: false }
  }
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (rect) setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    if (touches.current.has(event.pointerId)) {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touches.current.size === 2 && pinch.current) {
        const [a, b] = [...touches.current.values()]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const mid = toGraph((a.x + b.x) / 2, (a.y + b.y) / 2)
        const factor = distance / pinch.current
        pinch.current = distance
        setView((v) => zoomAbout(v, factor, mid.x, mid.y))
        return
      }
    }
    const d = drag.current
    if (!d || !rect) return
    const scale = network.width / rect.width
    const dx = (event.clientX - d.x) * scale
    const dy = (event.clientY - d.y) * scale
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    ;(event.currentTarget as SVGSVGElement).setPointerCapture?.(event.pointerId)
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }))
  }
  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    touches.current.delete(event.pointerId)
    if (touches.current.size < 2) pinch.current = null
    drag.current = null
  }
  /** A click pins its card in the corner until another entry or link is clicked (or it is closed). */
  const pin = (next: Focus) => {
    if (drag.current?.moved) return
    setPinned(next)
  }

  if (!network.nodes.length) return null

  const width = wrapRef.current?.clientWidth ?? 640
  const tooltipStyle = pointer
    ? {
        left: Math.min(Math.max(pointer.x + 14, 4), Math.max(width - 264, 4)),
        top: Math.max(pointer.y + 14, 4),
      }
    : { left: 8, top: 8 }

  return (
    <section aria-labelledby="h2h-network-title" className={`mb-4 rounded-lg border p-3 sm:p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <Network className="h-4 w-4 text-violet-500" aria-hidden />
        <h2 id="h2h-network-title" className="text-base font-semibold">
          Who debated whom
        </h2>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Rank bands">
        {network.categories.map((category, c) =>
          counts[c] ? (
            <button
              key={category.name}
              type="button"
              aria-pressed={!hiddenCategories.has(c)}
              onClick={() => toggleCategory(c)}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-opacity ${
                hiddenCategories.has(c) ? "opacity-40" : ""
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: NETWORK_COLORS[c] }} aria-hidden />
              {category.name}
              <span className="tabular-nums text-muted-foreground">{counts[c]}</span>
            </button>
          ) : null,
        )}
        <span className="ml-auto flex gap-1">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)} className="rounded border p-1 hover:bg-muted">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(0.8)} className="rounded border p-1 hover:bg-muted">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Reset view"
            onClick={() => setView({ x: 0, y: 0, k: 1 })}
            className="rounded border p-1 hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <div ref={wrapRef} className="relative rounded-md bg-muted/20" onMouseLeave={() => setHovered(null)}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${network.width} ${network.height}`}
          className="block h-auto w-full touch-none select-none"
          role="img"
          aria-label={`Network of ${network.nodes.length} ${formatLabel} entries and ${network.links.length} head-to-head pairings`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(event) => {
            touches.current.delete(event.pointerId)
            pinch.current = null
            drag.current = null
            setPointer(null)
          }}
          style={{ cursor: drag.current?.moved ? "grabbing" : "grab" }}
        >
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            <g fill="none">
              {network.links.map((link, i) => {
                if (!visible[link.source] || !visible[link.target]) return null
                const a = network.nodes[link.source]
                const b = network.nodes[link.target]
                const on = lit?.links.has(i)
                const base = 0.6 + Math.min(link.rounds, 4) * 0.5
                return (
                  <g key={`${link.source}-${link.target}`}>
                    <path
                      d={curvePath(a.x, a.y, b.x, b.y)}
                      stroke={NETWORK_COLORS[a.category]}
                      strokeWidth={(on ? base + 2.5 : base) / view.k}
                      strokeOpacity={lit ? (on ? 0.9 : 0.04) : 0.3}
                      className="transition-[stroke-opacity] duration-150"
                    />
                    {/* Wide invisible hit area for hovering thin links. */}
                    <path
                      d={curvePath(a.x, a.y, b.x, b.y)}
                      stroke="transparent"
                      strokeWidth={8 / view.k}
                      className="cursor-pointer"
                      onMouseEnter={() => setHovered({ kind: "link", index: i })}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => pin({ kind: "link", index: i })}
                    />
                  </g>
                )
              })}
            </g>
            {drawOrder.map((i) => {
              const node = network.nodes[i]
              if (!visible[i]) return null
              const on = !lit || lit.nodes.has(i)
              const isFocus = focus?.kind === "node" && focus.index === i
              const showLabel = lit ? lit.nodes.has(i) : node.entry.rank <= ALWAYS_LABELLED
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  opacity={on ? 1 : 0.12}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={() => setHovered({ kind: "node", index: i })}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => pin({ kind: "node", index: i })}
                >
                  <circle
                    r={(isFocus ? r[i] + 2 : r[i]) / Math.sqrt(view.k)}
                    fill={NETWORK_COLORS[node.category]}
                    stroke="var(--background)"
                    strokeWidth={1.5 / view.k}
                  />
                  {showLabel && (
                    <text
                      x={(r[i] + 3) / Math.sqrt(view.k)}
                      dy="0.35em"
                      fontSize={(isFocus ? 12 : 10) / Math.sqrt(view.k)}
                      fontWeight={isFocus ? 600 : 400}
                      className="pointer-events-none fill-foreground"
                      paintOrder="stroke"
                      stroke="var(--background)"
                      strokeWidth={3 / view.k}
                    >
                      {nodeLabel(node.entry)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {pinned && (
          <div className="absolute left-2 top-2 z-20 max-h-[calc(100%-1rem)] w-[260px] overflow-y-auto rounded-lg border bg-background/95 p-2.5 text-xs shadow-lg">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPinned(null)}
              className="float-right -mr-1 -mt-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <FocusCard network={network} focus={pinned} interactive videoStyles={videoStyles} />
          </div>
        )}
        {hovered && !sameFocus(hovered, pinned) && (
          <div
            className="pointer-events-none absolute z-30 w-[250px] rounded-lg border bg-background/95 p-2.5 text-xs shadow-lg"
            style={tooltipStyle}
          >
            <FocusCard network={network} focus={hovered} />
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        From the ballots behind the season&apos;s ratings.{" "}
        {pinned?.kind === "node" && (
          <Link href={teamHref(network.nodes[pinned.index].entry)} className="underline">
            Open {nodeLabel(network.nodes[pinned.index].entry)}
          </Link>
        )}
      </p>
    </section>
  )
}

/** Whether the viewport is phone-width (under 640px); `false` on the server. */
function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 639px)")
    if (!query) return
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return narrow
}

/**
 * The graph as a section of the rankings page: loads the format's rounds and
 * draws them over the page's entries, falling back to the bundled CSV
 * rankings when the page's (live Elo) names don't match the ballots.
 *
 * @param props.datasetId - The dataset the page shows.
 * @param props.entries - The page's ranked entries.
 */
export function HeadToHeadNetworkSection({
  datasetId,
  entries,
  formatLabel,
  className = "",
}: {
  datasetId: RankingDatasetId
  entries: readonly RankingEntry[]
  formatLabel: string
  className?: string
}) {
  const videoStyles = useMemo(() => {
    const style = DATASET_VIDEO_STYLE[datasetId]
    return style ? ([style] as DebateStyle[]) : []
  }, [datasetId])
  const [state, setState] = useState<{ id: RankingDatasetId; rounds: HeadToHeadRound[]; csv: RankingEntry[] | null }>()
  useEffect(() => {
    let live = true
    loadHeadToHeadRounds(datasetId).then(
      async (rounds) => {
        if (!live) return
        setState({ id: datasetId, rounds, csv: null })
        const csv = await loadCsvRankingDataset(datasetId).catch(() => null)
        if (live && csv) setState({ id: datasetId, rounds, csv: csv.entries })
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [datasetId])

  const narrow = useNarrowScreen()
  const network = useMemo(() => {
    if (!state || state.id !== datasetId || !state.rounds.length) return null
    const singles = datasetId === "hsld" || datasetId === "hsld_sepoct"
    // A short, wide box keeps the graph low on the page; phones get a squarer one so it is not a thin strip.
    const box = narrow ? { width: 420, height: 480 } : { width: 800, height: 380 }
    const fromPage = buildHeadToHeadNetwork(entries, state.rounds, { singles, ...box })
    if (fromPage.nodes.length >= MIN_MATCHED_NODES) return fromPage
    // Wait for the CSV rankings rather than flash a near-empty graph.
    if (!state.csv) return null
    const fromCsv = buildHeadToHeadNetwork(state.csv, state.rounds, { singles, ...box })
    return fromCsv.nodes.length > fromPage.nodes.length ? fromCsv : fromPage
  }, [state, datasetId, entries, narrow])

  if (!network || network.nodes.length < 2) return null
  return (
    <HeadToHeadNetworkChart
      key={`${datasetId}-${network.width}`}
      network={network}
      formatLabel={formatLabel}
      videoStyles={videoStyles}
      className={className}
    />
  )
}
