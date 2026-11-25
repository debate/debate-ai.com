/**
 * @fileoverview The round's mind map, drawn with D3: one bubble per
 * argument, smaller sub-bubbles for its warrants hung off it, and dashed
 * links between bubbles that answer, extend or relate to each other. Every
 * bubble carries its speech's label and colour — a shade of blue for each aff
 * speech, of red for each neg speech (`flowChartSpeechColumns`).
 *
 * Two layouts:
 * - **Columns** — one column per speech in round order, each speech's
 *   arguments stacked down it with their sub-bubbles under them. Fixed: no
 *   dragging.
 * - **Free arrange** — a force layout that swirls the bubbles out from the
 *   columns, the most-connected arguments pulled to the middle; bubbles can
 *   be dragged.
 *
 * Focusing speeches (the speech buttons) greys out every other speech's
 * bubbles. D3 is imported inside the effect, so it only ever loads in the
 * browser, when a chart is shown. Scroll or pinch to zoom, click to read.
 * @module components/watch/flow-chart/DebateFlowChartGraph
 */

"use client"

import { useEffect, useRef } from "react"
import {
  speechColumnOf,
  type DebateFlowChart,
  type FlowChartLinkKind,
  type FlowChartNode,
  type FlowChartSpeechColumn,
} from "../../../../lib/debate-flow-chart"

/** Bubble colors by side, for the legend and the side badge. */
export const FLOW_CHART_COLORS = {
  aff: { strong: "#2563eb", light: "#dbeafe", stroke: "#1d4ed8", text: "#1e3a8a" },
  neg: { strong: "#dc2626", light: "#fee2e2", stroke: "#b91c1c", text: "#7f1d1d" },
} as const

const GREY = { fill: "#e5e7eb", stroke: "#cbd5e1", text: "#9ca3af" }

const LINK_STYLES: Record<FlowChartLinkKind, { color: string; dash: string; width: number }> = {
  answers: { color: "#9333ea", dash: "6 4", width: 2 },
  extends: { color: "#64748b", dash: "2 4", width: 2 },
  related: { color: "#94a3b8", dash: "6 4", width: 1.5 },
}

/** The two arrangements of the chart. */
export type FlowChartLayout = "columns" | "free"

/** Splits a label into lines of at most `max` characters, breaking at spaces. */
export function wrapLabel(label: string, max: number): string[] {
  const words = label.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= max || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 4)
}

const COLUMN_WIDTH = 230
const COLUMN_GAP = 24
const ROW_GAP = 10
const HEADER_HEIGHT = 34

interface SimNode extends FlowChartNode {
  index?: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
  lines: string[]
  width: number
  height: number
  isMain: boolean
  column: number
  /** How many links touch this bubble — the free layout pulls well-connected ones to the middle. */
  degree: number
}

interface SimLink {
  source: string | SimNode
  target: string | SimNode
  kind: FlowChartLinkKind | "parent"
  label?: string
}

/**
 * Where each bubble sits in the columns layout: speeches left to right,
 * each column's main arguments top to bottom in chart order with their
 * sub-bubbles (in the same column) straight under them.
 */
export function columnPositions(
  nodes: Array<Pick<SimNode, "id" | "parent" | "column" | "height" | "isMain">>,
  columnCount: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const nextY = Array.from({ length: columnCount }, () => HEADER_HEIGHT + 12)
  const x = (column: number) => column * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_WIDTH / 2
  const place = (node: Pick<SimNode, "id" | "column" | "height">) => {
    positions.set(node.id, { x: x(node.column), y: nextY[node.column] + node.height / 2 })
    nextY[node.column] += node.height + ROW_GAP
  }
  const childrenOf = new Map<string, typeof nodes>()
  for (const node of nodes) {
    if (node.parent) childrenOf.set(node.parent, [...(childrenOf.get(node.parent) ?? []), node])
  }
  const visit = (node: (typeof nodes)[number]) => {
    if (positions.has(node.id)) return
    place(node)
    for (const child of childrenOf.get(node.id) ?? []) visit(child)
  }
  for (const node of nodes) if (!node.parent) visit(node)
  for (const node of nodes) visit(node)
  return positions
}

/** A column header's text: the speech label, then its title (a page section's heading) clipped to fit. */
export function headerText(column: Pick<FlowChartSpeechColumn, "label" | "title">, max = 22): string {
  const label = column.label || "Other"
  if (!column.title) return label
  const full = `${label} ${column.title}`
  return full.length > max ? `${full.slice(0, max - 1).trimEnd()}…` : full
}

export interface DebateFlowChartGraphProps {
  chart: DebateFlowChart
  /** The chart's speeches in round order, with their colours. */
  columns: FlowChartSpeechColumn[]
  layout: FlowChartLayout
  /** Speech labels to show in colour; every other speech's bubbles go grey. Empty shows all. */
  focusSpeeches: ReadonlySet<string>
  selectedId: string | null
  onSelect: (id: string | null) => void
  className?: string
}

/** Functions the D3 effect hands back, so layout and highlight changes don't rebuild the chart. */
interface GraphControls {
  setLayout: (layout: FlowChartLayout) => void
  highlight: (focus: ReadonlySet<string>, selectedId: string | null) => void
}

export function DebateFlowChartGraph({
  chart,
  columns,
  layout,
  focusSpeeches,
  selectedId,
  onSelect,
  className,
}: DebateFlowChartGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const controlsRef = useRef<GraphControls | null>(null)
  const stateRef = useRef({ layout, focusSpeeches, selectedId })
  stateRef.current = { layout, focusSpeeches, selectedId }

  useEffect(() => {
    const svgElement = svgRef.current
    if (!svgElement) return
    let cancelled = false
    let stop: (() => void) | null = null

    void Promise.all([import("d3-selection"), import("d3-force"), import("d3-zoom"), import("d3-drag")]).then(
      ([d3Selection, d3Force, d3Zoom, d3Drag]) => {
        if (cancelled) return
        const width = svgElement.clientWidth || 900
        const height = svgElement.clientHeight || 560
        const columnCount = Math.max(columns.length, 1)

        const degree = new Map<string, number>()
        for (const link of chart.links) {
          degree.set(link.source, (degree.get(link.source) ?? 0) + 1)
          degree.set(link.target, (degree.get(link.target) ?? 0) + 1)
        }
        for (const node of chart.nodes) {
          if (node.parent) degree.set(node.parent, (degree.get(node.parent) ?? 0) + 0.5)
        }

        const nodes: SimNode[] = chart.nodes.map((node) => {
          const isMain = !node.parent
          const lines = wrapLabel(node.label, isMain ? 24 : 28)
          const longest = Math.max(...lines.map((line) => line.length), (node.speech ?? "").length + 4, 6)
          const charWidth = isMain ? 7.2 : 6.3
          const lineHeight = isMain ? 15 : 13
          return {
            ...node,
            lines,
            isMain,
            column: speechColumnOf(node, columns),
            degree: degree.get(node.id) ?? 0,
            width: Math.min(COLUMN_WIDTH - (isMain ? 0 : 16), longest * charWidth + (isMain ? 26 : 18)),
            // One line for the speech tag above the label.
            height: (lines.length + 1) * lineHeight + (isMain ? 14 : 10),
          }
        })
        const byId = new Map(nodes.map((node) => [node.id, node]))
        const links: SimLink[] = [
          ...nodes
            .filter((node) => node.parent && byId.has(node.parent))
            .map((node) => ({ source: node.parent as string, target: node.id, kind: "parent" as const })),
          ...chart.links.map((link) => ({ ...link })),
        ]
        const columnColor = (node: SimNode) => columns[node.column] ?? columns[columns.length - 1]

        const targets = columnPositions(nodes, columnCount)
        for (const node of nodes) {
          const target = targets.get(node.id)
          node.x = target?.x ?? 0
          node.y = target?.y ?? 0
        }

        const svg = d3Selection.select(svgElement)
        svg.selectAll("*").remove()

        const defs = svg.append("defs")
        for (const [kind, style] of Object.entries(LINK_STYLES)) {
          defs
            .append("marker")
            .attr("id", `flow-arrow-${kind}`)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 10)
            .attr("refY", 0)
            .attr("markerWidth", 7)
            .attr("markerHeight", 7)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", style.color)
        }

        const root = svg.append("g")
        const zoom = d3Zoom
          .zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.15, 3])
          .on("zoom", (event) => root.attr("transform", event.transform.toString()))
        svg.call(zoom).on("dblclick.zoom", null)
        svg.on("click", (event: MouseEvent) => {
          if (event.target === svgElement) onSelectRef.current(null)
        })

        // Column headers: the speech labels across the top, shown in the columns layout.
        const headers = root
          .append("g")
          .selectAll<SVGGElement, FlowChartSpeechColumn>("g")
          .data(columns)
          .join("g")
          .attr("transform", (_, i) => `translate(${i * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_WIDTH / 2},0)`)
        headers
          .append("rect")
          .attr("x", -COLUMN_WIDTH / 2)
          .attr("y", 0)
          .attr("width", COLUMN_WIDTH)
          .attr("height", HEADER_HEIGHT)
          .attr("rx", 8)
          .attr("fill", (d) => d.color)
        headers
          .append("text")
          .attr("text-anchor", "middle")
          .attr("y", HEADER_HEIGHT / 2)
          .attr("dominant-baseline", "middle")
          .attr("font-size", 14)
          .attr("font-weight", 700)
          .attr("fill", "#ffffff")
          .text((d) => headerText(d))
        headers.append("title").text((d) => (d.title ? `${d.label} ${d.title}` : d.label || "Other"))

        const linkGroup = root.append("g").attr("fill", "none")
        const link = linkGroup
          .selectAll<SVGPathElement, SimLink>("path")
          .data(links)
          .join("path")
          .attr("stroke-width", (d) => (d.kind === "parent" ? 2 : LINK_STYLES[d.kind].width))
          .attr("stroke-dasharray", (d) => (d.kind === "parent" ? null : LINK_STYLES[d.kind].dash))
          .attr("marker-end", (d) => (d.kind === "parent" ? null : `url(#flow-arrow-${d.kind})`))
        link
          .filter((d) => d.kind !== "parent")
          .append("title")
          .text((d) => `${d.kind}${d.label ? `: ${d.label}` : ""}`)

        const node = root
          .append("g")
          .selectAll<SVGGElement, SimNode>("g")
          .data(nodes)
          .join("g")
          .attr("role", "button")
          .attr("tabindex", 0)
          .attr(
            "aria-label",
            (d) => `${d.speech ? `${d.speech}, ` : ""}${d.side === "aff" ? "Affirmative" : "Negative"}: ${d.label}. ${d.explanation}`,
          )
          .on("click", (event: MouseEvent, d) => {
            event.stopPropagation()
            onSelectRef.current(d.id)
          })
          .on("keydown", (event: KeyboardEvent, d) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onSelectRef.current(d.id)
            }
          })

        const bubble = node
          .append("rect")
          .attr("x", (d) => -d.width / 2)
          .attr("y", (d) => -d.height / 2)
          .attr("width", (d) => d.width)
          .attr("height", (d) => d.height)
          .attr("rx", (d) => Math.min(d.height / 2, 18))

        const label = node
          .append("text")
          .attr("text-anchor", "middle")
          .attr("pointer-events", "none")
          .each(function (d) {
            const lineHeight = d.isMain ? 15 : 13
            const top = -(d.lines.length * lineHeight) / 2
            const text = d3Selection.select(this)
            text
              .append("tspan")
              .attr("class", "speech-tag")
              .attr("x", 0)
              .attr("y", top)
              .attr("dominant-baseline", "middle")
              .attr("font-size", 10)
              .attr("font-weight", 700)
              .attr("letter-spacing", "0.06em")
              .text(`${d.speech ?? "?"} · ${d.side === "aff" ? "AFF" : "NEG"}`)
            d.lines.forEach((line, i) => {
              text
                .append("tspan")
                .attr("x", 0)
                .attr("y", top + (i + 1) * lineHeight)
                .attr("dominant-baseline", "middle")
                .attr("font-size", d.isMain ? 13 : 11)
                .attr("font-weight", d.isMain ? 600 : 500)
                .text(line)
            })
          })
        node.append("title").text((d) => (d.explanation ? `${d.label}\n${d.explanation}` : d.label))

        const highlight = (focus: ReadonlySet<string>, selected: string | null) => {
          const inFocus = (d: SimNode) => focus.size === 0 || focus.has(columnColor(d).label)
          const neighbors = new Set<string>()
          if (selected) {
            neighbors.add(selected)
            for (const l of links) {
              const s = (l.source as SimNode).id
              const t = (l.target as SimNode).id
              if (s === selected) neighbors.add(t)
              if (t === selected) neighbors.add(s)
            }
          }
          const dimmed = (d: SimNode) => (selected ? !neighbors.has(d.id) : false)
          bubble
            .attr("fill", (d) => (!inFocus(d) ? GREY.fill : d.isMain ? columnColor(d).color : columnColor(d).light))
            .attr("stroke", (d) => (d.id === selected ? "#f59e0b" : inFocus(d) ? columnColor(d).color : GREY.stroke))
            .attr("stroke-width", (d) => (d.id === selected ? 3 : d.isMain ? 0 : 1.5))
          label.attr("fill", (d) => (!inFocus(d) ? GREY.text : d.isMain ? "#ffffff" : columnColor(d).color))
          label.selectAll(".speech-tag").attr("opacity", 0.85)
          node.attr("opacity", (d) => (dimmed(d) ? 0.35 : 1))
          headers.attr("opacity", (d) => (focus.size === 0 || focus.has(d.label) ? 1 : 0.3))
          link
            .attr("stroke", (l) => {
              const t = l.target as SimNode
              const s = l.source as SimNode
              if (focus.size > 0 && !inFocus(s) && !inFocus(t)) return GREY.stroke
              return l.kind === "parent" ? columnColor(t).color : LINK_STYLES[l.kind].color
            })
            .attr("opacity", (l) => {
              const s = (l.source as SimNode).id
              const t = (l.target as SimNode).id
              if (selected) return s === selected || t === selected ? 1 : 0.12
              return 0.85
            })
        }

        /** Ends a link at the edge of the target bubble, so arrowheads show. */
        const edgePoint = (from: SimNode, to: SimNode) => {
          const dx = (from.x ?? 0) - (to.x ?? 0)
          const dy = (from.y ?? 0) - (to.y ?? 0)
          if (dx === 0 && dy === 0) return { x: to.x ?? 0, y: to.y ?? 0 }
          const scale = Math.min(
            Math.abs(dx) > 0 ? to.width / 2 / Math.abs(dx) : Infinity,
            Math.abs(dy) > 0 ? to.height / 2 / Math.abs(dy) : Infinity,
          )
          return { x: (to.x ?? 0) + dx * Math.min(scale, 1), y: (to.y ?? 0) + dy * Math.min(scale, 1) }
        }
        const render = () => {
          link.attr("d", (l) => {
            const s = l.source as SimNode
            const t = l.target as SimNode
            if (l.kind === "parent") {
              // In columns a child sits under its parent: an elbow down the left edge reads as a tree.
              if (stateRef.current.layout === "columns" && s.column === t.column) {
                const x = (s.x ?? 0) - s.width / 2 + 10
                return `M${x},${s.y}V${t.y}H${(t.x ?? 0) - t.width / 2}`
              }
              return `M${s.x},${s.y}L${t.x},${t.y}`
            }
            const end = edgePoint(s, t)
            const mx = ((s.x ?? 0) + end.x) / 2
            const my = ((s.y ?? 0) + end.y) / 2 - 30
            return `M${s.x},${s.y}Q${mx},${my} ${end.x},${end.y}`
          })
          node.attr("transform", (d) => `translate(${d.x},${d.y})`)
        }

        const fit = () => {
          if (nodes.length === 0) return
          let minX = Infinity
          let minY = Infinity
          let maxX = -Infinity
          let maxY = -Infinity
          for (const d of nodes) {
            minX = Math.min(minX, (d.x ?? 0) - d.width / 2)
            maxX = Math.max(maxX, (d.x ?? 0) + d.width / 2)
            minY = Math.min(minY, (d.y ?? 0) - d.height / 2)
            maxY = Math.max(maxY, (d.y ?? 0) + d.height / 2)
          }
          if (stateRef.current.layout === "columns") {
            minY = Math.min(minY, 0)
            minX = Math.min(minX, 0)
          }
          const pad = 20
          const scale = Math.min(1.2, (width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1))
          // Tall columns: fit the width and start at the top rather than shrinking to nothing.
          const fitScale = Math.max(scale, stateRef.current.layout === "columns" ? Math.min(0.9, (width - pad * 2) / (maxX - minX || 1)) : 0)
          const top = stateRef.current.layout === "columns" ? pad / fitScale - minY : null
          const transform =
            top !== null
              ? d3Zoom.zoomIdentity
                  .translate(width / 2, 0)
                  .scale(fitScale)
                  .translate(-(minX + maxX) / 2, top)
              : d3Zoom.zoomIdentity
                  .translate(width / 2, height / 2)
                  .scale(scale)
                  .translate(-(minX + maxX) / 2, -(minY + maxY) / 2)
          svg.call(zoom.transform, transform)
        }

        const center = ((columnCount - 1) * (COLUMN_WIDTH + COLUMN_GAP)) / 2 + COLUMN_WIDTH / 2
        const maxDegree = Math.max(1, ...nodes.map((d) => d.degree))
        const simulation = d3Force
          .forceSimulation<SimNode>(nodes)
          .force(
            "link",
            d3Force
              .forceLink<SimNode, SimLink>(links)
              .id((d) => d.id)
              .distance((l) => (l.kind === "parent" ? 50 + ((l.target as SimNode).width + (l.source as SimNode).width) / 4 : 190))
              .strength((l) => (l.kind === "parent" ? 0.9 : 0.12)),
          )
          .force("charge", d3Force.forceManyBody<SimNode>().strength((d) => (d.isMain ? -560 : -220)))
          .force("collide", d3Force.forceCollide<SimNode>().radius((d) => Math.hypot(d.width, d.height) / 2 + 6).strength(0.9))
          // The most-connected arguments sit in the middle; loosely tied ones ring the outside.
          .force(
            "radial",
            d3Force
              .forceRadial<SimNode>((d) => (1 - d.degree / maxDegree) * Math.min(width, height) * 0.55, center, height / 2)
              .strength((d) => (d.isMain ? 0.25 : 0.05)),
          )
          .force(
            "side",
            d3Force.forceX<SimNode>((d) => center + (d.side === "aff" ? -1 : 1) * width * 0.12).strength(0.03),
          )
          .stop()

        let animation = 0
        /** Glides every bubble to its column slot. */
        const toColumns = () => {
          simulation.stop()
          cancelAnimationFrame(animation)
          const from = new Map(nodes.map((d) => [d.id, { x: d.x ?? 0, y: d.y ?? 0 }]))
          const started = performance.now()
          const duration = 550
          for (const d of nodes) {
            d.fx = null
            d.fy = null
          }
          const step = (now: number) => {
            const t = Math.min(1, (now - started) / duration)
            const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
            for (const d of nodes) {
              const a = from.get(d.id) as { x: number; y: number }
              const b = targets.get(d.id) ?? a
              d.x = a.x + (b.x - a.x) * ease
              d.y = a.y + (b.y - a.y) * ease
            }
            render()
            if (t < 1) animation = requestAnimationFrame(step)
            else fit()
          }
          animation = requestAnimationFrame(step)
        }
        /** Lets the force layout swirl the bubbles out from wherever they are. */
        const toFree = () => {
          cancelAnimationFrame(animation)
          refitOnEnd = true
          simulation.alpha(1).restart()
        }
        simulation.on("tick", render)
        // Frame the swirl once it settles (not after a drag, which would jump the view).
        let refitOnEnd = false
        simulation.on("end", () => {
          if (refitOnEnd && stateRef.current.layout === "free") fit()
          refitOnEnd = false
        })

        const setLayout = (next: FlowChartLayout) => {
          headers.attr("display", next === "columns" ? null : "none")
          node.attr("cursor", next === "free" ? "grab" : "pointer")
          if (next === "columns") toColumns()
          else toFree()
        }

        // Dragging only moves bubbles in the free layout.
        node.call(
          d3Drag
            .drag<SVGGElement, SimNode>()
            .filter((event: MouseEvent) => stateRef.current.layout === "free" && !event.button)
            .on("start", (event, d) => {
              if (!event.active) simulation.alphaTarget(0.2).restart()
              d.fx = d.x
              d.fy = d.y
            })
            .on("drag", (event, d) => {
              d.fx = event.x
              d.fy = event.y
            })
            .on("end", (event, d) => {
              if (!event.active) simulation.alphaTarget(0)
              d.fx = null
              d.fy = null
            }),
        )

        controlsRef.current = { setLayout, highlight }
        highlight(stateRef.current.focusSpeeches, stateRef.current.selectedId)
        headers.attr("display", stateRef.current.layout === "columns" ? null : "none")
        node.attr("cursor", stateRef.current.layout === "free" ? "grab" : "pointer")
        if (stateRef.current.layout === "free") {
          // Settle before the first paint so free arrange opens framed.
          for (let i = 0; i < 260; i++) simulation.tick()
        }
        render()
        fit()

        stop = () => {
          simulation.stop()
          cancelAnimationFrame(animation)
          svg.on(".zoom", null)
        }
      },
    )

    return () => {
      cancelled = true
      controlsRef.current = null
      stop?.()
    }
  }, [chart, columns])

  useEffect(() => {
    controlsRef.current?.setLayout(layout)
  }, [layout])

  useEffect(() => {
    controlsRef.current?.highlight(focusSpeeches, selectedId)
  }, [focusSpeeches, selectedId])

  return (
    <svg
      ref={svgRef}
      className={className}
      role="img"
      aria-label="Mind map of the round's arguments: affirmative speeches in shades of blue, negative in shades of red"
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    />
  )
}
