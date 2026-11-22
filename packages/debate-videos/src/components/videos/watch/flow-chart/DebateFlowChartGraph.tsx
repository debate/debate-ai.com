/**
 * @fileoverview The round's mind map, drawn with D3: one bubble per
 * argument (aff blue, neg red), smaller sub-bubbles for its warrants hung off
 * it, and dashed links between bubbles that answer, extend or relate to each
 * other. A force layout keeps aff to the left and neg to the right so the
 * clash reads across the middle, like a flow.
 *
 * D3 is imported inside the effect, so it only ever loads in the browser,
 * when a chart is shown — never in the server bundle's render path.
 * Drag a bubble to move it, scroll or pinch to zoom, click one to read it.
 * @module components/watch/flow-chart/DebateFlowChartGraph
 */

"use client"

import { useEffect, useRef } from "react"
import type { DebateFlowChart, FlowChartLinkKind, FlowChartNode } from "../../../../lib/debate-flow-chart"

/** Bubble colors by side: strong fill for a main argument, light fill for a sub-bubble. */
export const FLOW_CHART_COLORS = {
  aff: { strong: "#2563eb", light: "#dbeafe", stroke: "#1d4ed8", text: "#1e3a8a" },
  neg: { strong: "#dc2626", light: "#fee2e2", stroke: "#b91c1c", text: "#7f1d1d" },
} as const

const LINK_STYLES: Record<FlowChartLinkKind, { color: string; dash: string; width: number }> = {
  answers: { color: "#9333ea", dash: "6 4", width: 2 },
  extends: { color: "#64748b", dash: "2 4", width: 2 },
  related: { color: "#94a3b8", dash: "6 4", width: 1.5 },
}

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
}

interface SimLink {
  source: string | SimNode
  target: string | SimNode
  kind: FlowChartLinkKind | "parent"
  label?: string
}

export interface DebateFlowChartGraphProps {
  chart: DebateFlowChart
  selectedId: string | null
  onSelect: (id: string | null) => void
  className?: string
}

export function DebateFlowChartGraph({ chart, selectedId, onSelect, className }: DebateFlowChartGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  /** Re-highlights the selection without re-running the layout. */
  const highlightRef = useRef<((id: string | null) => void) | null>(null)
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

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

        const nodes: SimNode[] = chart.nodes.map((node, index) => {
          const isMain = !node.parent
          const lines = wrapLabel(node.label, isMain ? 18 : 22)
          const longest = Math.max(...lines.map((line) => line.length), 4)
          const charWidth = isMain ? 7.4 : 6.4
          const lineHeight = isMain ? 15 : 13
          const side = node.side === "aff" ? -1 : 1
          return {
            ...node,
            lines,
            isMain,
            width: longest * charWidth + (isMain ? 28 : 20),
            height: lines.length * lineHeight + (isMain ? 20 : 14),
            x: side * (width / 4) + (index % 3) * 10,
            y: ((index % 7) - 3) * 40,
          }
        })
        const byId = new Map(nodes.map((node) => [node.id, node]))
        const links: SimLink[] = [
          ...nodes
            .filter((node) => node.parent && byId.has(node.parent))
            .map((node) => ({ source: node.parent as string, target: node.id, kind: "parent" as const })),
          ...chart.links.map((link) => ({ ...link })),
        ]

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
          .scaleExtent([0.2, 3])
          .on("zoom", (event) => root.attr("transform", event.transform.toString()))
        svg.call(zoom).on("dblclick.zoom", null)
        svg.on("click", (event: MouseEvent) => {
          if (event.target === svgElement) onSelectRef.current(null)
        })

        const linkGroup = root.append("g").attr("fill", "none")
        const link = linkGroup
          .selectAll<SVGPathElement, SimLink>("path")
          .data(links)
          .join("path")
          .attr("stroke", (d) => {
            if (d.kind !== "parent") return LINK_STYLES[d.kind].color
            const target = typeof d.target === "string" ? byId.get(d.target) : d.target
            return target ? FLOW_CHART_COLORS[target.side].stroke : "#94a3b8"
          })
          .attr("stroke-width", (d) => (d.kind === "parent" ? 2 : LINK_STYLES[d.kind].width))
          .attr("stroke-dasharray", (d) => (d.kind === "parent" ? null : LINK_STYLES[d.kind].dash))
          .attr("stroke-opacity", (d) => (d.kind === "parent" ? 0.7 : 0.9))
          .attr("marker-end", (d) => (d.kind === "parent" ? null : `url(#flow-arrow-${d.kind})`))
        link
          .filter((d) => d.kind !== "parent")
          .append("title")
          .text((d) => `${d.kind}${d.label ? `: ${d.label}` : ""}`)

        const linkLabel = root
          .append("g")
          .selectAll<SVGTextElement, SimLink>("text")
          .data(links.filter((d) => d.kind !== "parent" && d.label))
          .join("text")
          .attr("font-size", 10)
          .attr("text-anchor", "middle")
          .attr("fill", "currentColor")
          .attr("opacity", 0.75)
          .attr("pointer-events", "none")
          .text((d) => ((d.label ?? "").length > 32 ? `${(d.label ?? "").slice(0, 31)}…` : (d.label ?? "")))

        const node = root
          .append("g")
          .selectAll<SVGGElement, SimNode>("g")
          .data(nodes)
          .join("g")
          .attr("cursor", "pointer")
          .attr("role", "button")
          .attr("tabindex", 0)
          .attr("aria-label", (d) => `${d.side === "aff" ? "Affirmative" : "Negative"}: ${d.label}. ${d.explanation}`)
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

        node
          .append("rect")
          .attr("x", (d) => -d.width / 2)
          .attr("y", (d) => -d.height / 2)
          .attr("width", (d) => d.width)
          .attr("height", (d) => d.height)
          .attr("rx", (d) => Math.min(d.height / 2, 22))
          .attr("fill", (d) => (d.isMain ? FLOW_CHART_COLORS[d.side].strong : FLOW_CHART_COLORS[d.side].light))
          .attr("stroke", (d) => FLOW_CHART_COLORS[d.side].stroke)
          .attr("stroke-width", (d) => (d.isMain ? 0 : 1.5))

        node
          .append("text")
          .attr("text-anchor", "middle")
          .attr("font-size", (d) => (d.isMain ? 13 : 11))
          .attr("font-weight", (d) => (d.isMain ? 600 : 500))
          .attr("fill", (d) => (d.isMain ? "#ffffff" : FLOW_CHART_COLORS[d.side].text))
          .attr("pointer-events", "none")
          .each(function (d) {
            const lineHeight = d.isMain ? 15 : 13
            const top = -((d.lines.length - 1) * lineHeight) / 2
            const text = d3Selection.select(this)
            d.lines.forEach((line, i) => {
              text
                .append("tspan")
                .attr("x", 0)
                .attr("y", top + i * lineHeight)
                .attr("dominant-baseline", "middle")
                .text(line)
            })
          })
        node.append("title").text((d) => (d.explanation ? `${d.label}\n${d.explanation}` : d.label))

        const highlight = (id: string | null) => {
          const neighbors = new Set<string>()
          if (id) {
            neighbors.add(id)
            for (const l of links) {
              const s = (l.source as SimNode).id ?? l.source
              const t = (l.target as SimNode).id ?? l.target
              if (s === id) neighbors.add(t as string)
              if (t === id) neighbors.add(s as string)
            }
          }
          node
            .attr("opacity", (d) => (!id || neighbors.has(d.id) ? 1 : 0.3))
            .select("rect")
            .attr("stroke-width", (d) => (d.id === id ? 3 : d.isMain ? 0 : 1.5))
            .attr("stroke", (d) => (d.id === id ? "#f59e0b" : FLOW_CHART_COLORS[d.side].stroke))
          link.attr("opacity", (l) => {
            if (!id) return 1
            const s = (l.source as SimNode).id
            const t = (l.target as SimNode).id
            return s === id || t === id ? 1 : 0.15
          })
        }
        highlightRef.current = highlight
        highlight(selectedRef.current)

        const collideRadius = (d: SimNode) => Math.hypot(d.width, d.height) / 2 + 6
        const simulation = d3Force
          .forceSimulation<SimNode>(nodes)
          .force(
            "link",
            d3Force
              .forceLink<SimNode, SimLink>(links)
              .id((d) => d.id)
              .distance((l) => (l.kind === "parent" ? 40 + ((l.target as SimNode).width + (l.source as SimNode).width) / 4 : 200))
              .strength((l) => (l.kind === "parent" ? 0.9 : 0.08)),
          )
          .force("charge", d3Force.forceManyBody<SimNode>().strength((d) => (d.isMain ? -520 : -200)))
          .force("collide", d3Force.forceCollide<SimNode>().radius(collideRadius).strength(0.9))
          .force(
            "side",
            d3Force.forceX<SimNode>((d) => (d.side === "aff" ? -width / 4 : width / 4)).strength((d) => (d.isMain ? 0.12 : 0.04)),
          )
          .force("y", d3Force.forceY<SimNode>(0).strength(0.05))

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
          const pad = 24
          const scale = Math.min(1.4, (width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1))
          const transform = d3Zoom.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-(minX + maxX) / 2, -(minY + maxY) / 2)
          svg.call(zoom.transform, transform)
        }

        // Settle most of the layout before the first paint, so the chart opens framed.
        simulation.stop()
        for (let i = 0; i < 220; i++) simulation.tick()

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
            const end = l.kind === "parent" ? { x: t.x ?? 0, y: t.y ?? 0 } : edgePoint(s, t)
            if (l.kind === "parent") return `M${s.x},${s.y}L${end.x},${end.y}`
            // Cross links curve gently so two links between the same columns don't overlap.
            const mx = ((s.x ?? 0) + end.x) / 2
            const my = ((s.y ?? 0) + end.y) / 2 - 30
            return `M${s.x},${s.y}Q${mx},${my} ${end.x},${end.y}`
          })
          linkLabel
            .attr("x", (l) => (((l.source as SimNode).x ?? 0) + ((l.target as SimNode).x ?? 0)) / 2)
            .attr("y", (l) => (((l.source as SimNode).y ?? 0) + ((l.target as SimNode).y ?? 0)) / 2 - 18)
          node.attr("transform", (d) => `translate(${d.x},${d.y})`)
        }
        render()
        fit()
        simulation.on("tick", render)

        node.call(
          d3Drag
            .drag<SVGGElement, SimNode>()
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

        stop = () => {
          simulation.stop()
          svg.on(".zoom", null)
        }
      },
    )

    return () => {
      cancelled = true
      highlightRef.current = null
      stop?.()
    }
  }, [chart])

  useEffect(() => {
    highlightRef.current?.(selectedId)
  }, [selectedId, chart])

  return (
    <svg
      ref={svgRef}
      className={className}
      role="img"
      aria-label="Mind map of the round's arguments: affirmative in blue, negative in red"
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    />
  )
}
