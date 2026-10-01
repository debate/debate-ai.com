/**
 * @fileoverview The argument map's graphical views, each a d3 layout drawn
 * as React SVG: a Kialo-style tiered tree, a sunburst, a left/right mind
 * map (pros right, cons left), a bubble (circle-pack) map and a sankey.
 * Clicking any claim focuses it in the Kialo-style focus view below the
 * chart; hovering shows its full text.
 *
 * This module is the only one that imports d3, and `ArgumentMapView`
 * loads it with `React.lazy`, so d3 stays out of the panel's main chunk.
 *
 * @module panels/argument-map/ArgumentMapChart
 */

"use client"

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { hierarchy, pack, partition, tree, type HierarchyNode } from "d3-hierarchy"
import { arc, linkHorizontal } from "d3-shape"
import { sankey, sankeyLeft, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey"
import type { ArgumentMapNode, ArgumentMapViewMode } from "../../flow/argument-map"
import { stanceFill, stanceStroke } from "./colors"

export type ArgumentMapChartProps = {
  root: ArgumentMapNode
  mode: ArgumentMapViewMode
  focusId: string
  onFocus: (id: string) => void
}

type Hover = { node: ArgumentMapNode; x: number; y: number }

type HoverHandlers = {
  onHover: (node: ArgumentMapNode, event: MouseEvent) => void
  onLeave: () => void
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Ids of the focused claim and every ancestor, so views can highlight the path to it. */
function focusPathIds(root: ArgumentMapNode, focusId: string): Set<string> {
  const ids = new Set<string>()
  const visit = (node: ArgumentMapNode): boolean => {
    if (node.id === focusId || node.children.some(visit)) {
      ids.add(node.id)
      return true
    }
    return false
  }
  visit(root)
  return ids
}

export default function ArgumentMapChart({ root, mode, focusId, onFocus }: ArgumentMapChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const pathIds = useMemo(() => focusPathIds(root, focusId), [root, focusId])

  // A chart wider than the panel (a deep mind map or tree) opens scrolled to its root, not its left edge.
  useEffect(() => {
    const scroller = scrollRef.current
    const rootMark = scroller?.querySelector<SVGElement>("[data-map-root]")
    if (!scroller || !rootMark || scroller.scrollWidth <= scroller.clientWidth) return
    const offset = rootMark.getBoundingClientRect().left - scroller.getBoundingClientRect().left
    scroller.scrollLeft += offset + rootMark.getBoundingClientRect().width / 2 - scroller.clientWidth / 2
  }, [mode, root])

  const handlers: HoverHandlers = {
    onHover: (node, event) => {
      const box = containerRef.current?.getBoundingClientRect()
      if (!box) return
      setHover({ node, x: event.clientX - box.left, y: event.clientY - box.top })
    },
    onLeave: () => setHover(null),
  }

  const viewProps = { root, focusId, pathIds, onFocus, ...handlers }
  let view: ReactNode
  switch (mode) {
    case "sunburst":
      view = <SunburstView {...viewProps} />
      break
    case "mindmap":
      view = <MindMapView {...viewProps} />
      break
    case "bubble":
      view = <BubbleView {...viewProps} />
      break
    case "sankey":
      view = <SankeyView {...viewProps} />
      break
    default:
      view = <TieredTreeView {...viewProps} />
  }

  return (
    <div ref={containerRef} className="relative" onMouseLeave={handlers.onLeave}>
      {/* "safe center" keeps a chart wider than the panel scrollable from its left edge instead of clipped. */}
      <div ref={scrollRef} className="flex max-h-[560px] overflow-auto" style={{ justifyContent: "safe center" }}>
        {view}
      </div>
      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
          style={{ left: Math.min(hover.x + 14, (containerRef.current?.clientWidth ?? 0) - 260), top: hover.y + 14 }}
        >
          <div className="mb-1 h-1 w-16 rounded-full" style={{ background: stanceStroke(hover.node.stance) }} />
          {hover.node.speech && <div className="text-xs text-muted-foreground">{hover.node.speech}</div>}
          {hover.node.label}
        </div>
      )}
    </div>
  )
}

type ViewProps = HoverHandlers & {
  root: ArgumentMapNode
  focusId: string
  pathIds: Set<string>
  onFocus: (id: string) => void
}

/** Shared props that make an SVG mark a clickable, hoverable claim. */
function claimProps(node: ArgumentMapNode, { onFocus, onHover, onLeave }: ViewProps) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": node.label,
    className: "cursor-pointer outline-none",
    onClick: () => onFocus(node.id),
    onKeyDown: (event: { key: string }) => {
      if (event.key === "Enter" || event.key === " ") onFocus(node.id)
    },
    onMouseEnter: (event: MouseEvent) => onHover(node, event),
    onMouseMove: (event: MouseEvent) => onHover(node, event),
    onMouseLeave: onLeave,
  }
}

/** Kialo's minimap: small boxes per claim in tiers, outlined by stance, elbow links, path to focus highlighted. */
function TieredTreeView(props: ViewProps) {
  const { root, focusId, pathIds } = props
  const boxW = 30
  const boxH = 20
  const layout = useMemo(() => tree<ArgumentMapNode>().nodeSize([boxW + 10, 56])(hierarchy(root)), [root])
  const nodes = layout.descendants()
  const minX = Math.min(...nodes.map((n) => n.x)) - boxW
  const maxX = Math.max(...nodes.map((n) => n.x)) + boxW
  const maxY = Math.max(...nodes.map((n) => n.y)) + boxH + 8
  const width = maxX - minX

  return (
    <svg width={width} height={maxY + 8} viewBox={`${minX} -8 ${width} ${maxY + 8}`} className="shrink-0">
      <g fill="none">
        {layout.links().map((link) => {
          const onPath = pathIds.has(link.target.data.id)
          const midY = (link.source.y + boxH + link.target.y) / 2
          return (
            <path
              key={link.target.data.id}
              d={`M${link.source.x},${link.source.y + boxH}V${midY}H${link.target.x}V${link.target.y}`}
              stroke={onPath ? stanceStroke(link.target.data.stance) : "currentColor"}
              className={onPath ? undefined : "text-muted-foreground/50"}
              strokeWidth={onPath ? 2.5 : 1}
            />
          )
        })}
      </g>
      {nodes.map((node) => {
        const focused = node.data.id === focusId
        return (
          <rect
            key={node.data.id}
            {...claimProps(node.data, props)}
            data-map-root={node.depth === 0 ? "" : undefined}
            x={node.x - boxW / 2}
            y={node.y}
            width={boxW}
            height={boxH}
            rx={3}
            fill={focused ? stanceFill(node.data.stance, 1) : "transparent"}
            fillOpacity={focused ? 0.35 : 1}
            stroke={stanceStroke(node.data.stance)}
            strokeWidth={focused ? 3 : 2}
          />
        )
      })}
    </svg>
  )
}

/** Kialo's sunburst: the root at the center, every ring one level deeper, each wedge sized by its leaf claims. */
function SunburstView(props: ViewProps) {
  const { root, focusId, pathIds } = props
  const size = 520
  const radius = size / 2
  const layout = useMemo(() => {
    const h = hierarchy(root).count()
    return partition<ArgumentMapNode>().size([2 * Math.PI, radius])(h)
  }, [root, radius])
  const ringWidth = radius / (layout.height + 1)
  const arcPath = arc<{ x0: number; x1: number; y0: number; y1: number }>()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => d.y1)
    .padAngle(0.004)

  return (
    <svg width={size} height={size} viewBox={`${-radius} ${-radius} ${size} ${size}`} className="max-w-full shrink-0">
      {layout.descendants().map((node) => {
        const ring = { x0: node.x0, x1: node.x1, y0: node.depth * ringWidth, y1: (node.depth + 1) * ringWidth }
        const focused = node.data.id === focusId
        if (node.depth === 0) {
          return (
            <circle
              key={node.data.id}
              {...claimProps(node.data, props)}
              r={ringWidth - 2}
              fill={stanceFill("root")}
              stroke={focused ? "currentColor" : "none"}
              strokeWidth={3}
              className="cursor-pointer text-foreground outline-none"
            />
          )
        }
        return (
          <path
            key={node.data.id}
            {...claimProps(node.data, props)}
            d={arcPath(ring) ?? undefined}
            fill={stanceFill(node.data.stance, node.depth)}
            fillOpacity={pathIds.size > 1 && !pathIds.has(node.data.id) && !isWithin(node, focusId) ? 0.55 : 1}
            strokeWidth={focused ? 3 : 0.75}
            className={`cursor-pointer outline-none ${focused ? "stroke-foreground" : "stroke-background"}`}
          />
        )
      })}
    </svg>
  )
}

/** True when `node` sits inside the focused claim's subtree. */
function isWithin(node: HierarchyNode<ArgumentMapNode>, focusId: string): boolean {
  return node.ancestors().some((ancestor) => ancestor.data.id === focusId)
}

/** Mind map: the round in the middle, pros branching right and cons branching left, labelled pills. */
function MindMapView(props: ViewProps) {
  const { root, focusId, pathIds } = props
  const colW = 190
  const rowH = 34
  const pillW = 170
  const pillH = 24

  const sides = useMemo(() => {
    const layoutSide = (stance: "pro" | "con") => {
      const sideRoot = { ...root, children: root.children.filter((child) => child.stance === stance) }
      if (sideRoot.children.length === 0) return []
      const laid = tree<ArgumentMapNode>().nodeSize([rowH, colW])(hierarchy(sideRoot))
      const dir = stance === "pro" ? 1 : -1
      return laid.links().map((link) => ({
        source: { x: link.source.y * dir, y: link.source.x, data: link.source.data },
        target: { x: link.target.y * dir, y: link.target.x, data: link.target.data },
      }))
    }
    return [...layoutSide("pro"), ...layoutSide("con")]
  }, [root])

  const placed = [{ x: 0, y: 0, data: root }, ...sides.map((link) => link.target)]
  const xs = placed.map((p) => p.x)
  const ys = placed.map((p) => p.y)
  const minX = Math.min(...xs) - pillW / 2 - 8
  const maxX = Math.max(...xs) + pillW / 2 + 8
  const minY = Math.min(...ys) - pillH
  const maxY = Math.max(...ys) + pillH
  const link = linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()

  return (
    <svg width={maxX - minX} height={maxY - minY} viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="shrink-0">
      <g fill="none">
        {sides.map((edge) => {
          const dir = edge.target.x >= 0 ? 1 : -1
          return (
            <path
              key={edge.target.data.id}
              d={
                link({
                  source: [edge.source.x + (dir * pillW) / 2, edge.source.y],
                  target: [edge.target.x - (dir * pillW) / 2, edge.target.y],
                }) ?? undefined
              }
              stroke={stanceStroke(edge.target.data.stance)}
              strokeOpacity={pathIds.has(edge.target.data.id) ? 1 : 0.45}
              strokeWidth={pathIds.has(edge.target.data.id) ? 2.5 : 1.5}
            />
          )
        })}
      </g>
      {placed.map((p) => {
        const focused = p.data.id === focusId
        return (
          <g
            key={p.data.id}
            {...claimProps(p.data, props)}
            data-map-root={p.data.id === root.id ? "" : undefined}
            transform={`translate(${p.x - pillW / 2},${p.y - pillH / 2})`}>
            <rect
              width={pillW}
              height={pillH}
              rx={pillH / 2}
              fill={stanceFill(p.data.stance, p.data.stance === "root" ? 0 : 1)}
              fillOpacity={p.data.stance === "root" ? 1 : 0.18}
              stroke={stanceStroke(p.data.stance)}
              strokeWidth={focused ? 3 : 1.25}
            />
            <text x={pillW / 2} y={pillH / 2} dy="0.35em" textAnchor="middle" className="fill-foreground text-[11px]">
              {truncate(p.data.label, 28)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Bubble map: nested circles (d3 pack), each claim's bubble containing its responses. */
function BubbleView(props: ViewProps) {
  const { root, focusId } = props
  const size = 520
  const layout = useMemo(() => pack<ArgumentMapNode>().size([size, size]).padding(4)(hierarchy(root).count()), [root])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full shrink-0">
      {layout.descendants().map((node) => {
        const focused = node.data.id === focusId
        return (
          <g key={node.data.id} {...claimProps(node.data, props)}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill={stanceFill(node.data.stance, Math.max(node.depth, 1))}
              fillOpacity={node.depth === 0 ? 0.15 : node.children ? 0.35 : 0.9}
              stroke={focused ? "currentColor" : stanceStroke(node.data.stance)}
              strokeWidth={focused ? 3 : 1}
              className="text-foreground"
            />
            {!node.children && node.r > 22 && (
              <text
                x={node.x}
                y={node.y}
                dy="0.35em"
                textAnchor="middle"
                className="pointer-events-none fill-foreground text-[10px]"
              >
                {truncate(node.data.label, Math.floor(node.r / 3.2))}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

type SankeyDatum = { id: string; claim: ArgumentMapNode }
type SankeyEdge = { source: string; target: string; value: number }

/** Sankey: every claim a column node, the round flowing into contentions, arguments and responses, widths by leaf count. */
function SankeyView(props: ViewProps) {
  const { root, focusId, pathIds } = props
  const width = 900

  const graph = useMemo(() => {
    const h = hierarchy(root).count()
    const nodes: SankeyDatum[] = h.descendants().map((node) => ({ id: node.data.id, claim: node.data }))
    const links: SankeyEdge[] = h
      .links()
      .map((link) => ({ source: link.source.data.id, target: link.target.data.id, value: link.target.value ?? 1 }))
    const height = Math.max(320, (h.value ?? 1) * 22)
    const layout = sankey<SankeyDatum, SankeyEdge>()
      .nodeId((node) => node.id)
      .nodeAlign(sankeyLeft)
      .nodeWidth(12)
      .nodePadding(8)
      .extent([
        [1, 1],
        [width - 160, height - 1],
      ])
    const result = layout({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) })
    return { ...result, height }
  }, [root])

  const linkPath = sankeyLinkHorizontal<SankeyDatum, SankeyEdge>()

  return (
    <svg width={width} height={graph.height} viewBox={`0 0 ${width} ${graph.height}`} className="shrink-0">
      <g fill="none">
        {graph.links.map((edge: SankeyLink<SankeyDatum, SankeyEdge>) => {
          const target = edge.target as SankeyNode<SankeyDatum, SankeyEdge>
          const onPath = pathIds.has(target.id)
          return (
            <path
              key={target.id}
              d={linkPath(edge) ?? undefined}
              stroke={stanceFill(target.claim.stance, 2)}
              strokeOpacity={onPath ? 0.8 : 0.4}
              strokeWidth={Math.max(1, edge.width ?? 1)}
            />
          )
        })}
      </g>
      {graph.nodes.map((node: SankeyNode<SankeyDatum, SankeyEdge>) => {
        const x0 = node.x0 ?? 0
        const x1 = node.x1 ?? 0
        const y0 = node.y0 ?? 0
        const y1 = node.y1 ?? 0
        const focused = node.id === focusId
        return (
          <g key={node.id} {...claimProps(node.claim, props)}>
            <rect
              x={x0}
              y={y0}
              width={x1 - x0}
              height={Math.max(1, y1 - y0)}
              fill={stanceStroke(node.claim.stance)}
              stroke={focused ? "currentColor" : "none"}
              strokeWidth={2}
              className="text-foreground"
            />
            {y1 - y0 >= 10 && (
              <text
                x={x1 + 4}
                y={(y0 + y1) / 2}
                dy="0.35em"
                strokeWidth={3}
                paintOrder="stroke"
                className="pointer-events-none fill-foreground stroke-background text-[10px]"
              >
                {truncate(node.claim.label, 26)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
