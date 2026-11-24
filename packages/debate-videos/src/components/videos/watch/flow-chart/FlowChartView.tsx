/**
 * @fileoverview A generated flow chart, as both flow-chart modals show it:
 * the bottom line, the colour legend, the speech (or section) focus chips,
 * the layout switch, the D3 graph with the clicked bubble's details, and
 * every argument written out underneath.
 *
 * Shared by the watch page's round chart (`DebateFlowChartDialog`) and the
 * docs pages' page chart (`PageFlowChartDialog`); only the legend wording
 * and the chips' name differ.
 * @module components/watch/flow-chart/FlowChartView
 */

"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "../../../../ui/primitives/button"
import {
  flowChartOutline,
  type DebateFlowChart,
  type FlowChartSpeechColumn,
} from "../../../../lib/debate-flow-chart"
import { DebateFlowChartGraph, FLOW_CHART_COLORS, type FlowChartLayout } from "./DebateFlowChartGraph"

const NO_FOCUS: ReadonlySet<string> = new Set()

export interface FlowChartViewProps {
  chart: DebateFlowChart
  /** The chart's columns in order (speeches, or a page's sections), with their colours. */
  columns: FlowChartSpeechColumn[]
  /** Legend text for the two colours. */
  legend: { aff: string; neg: string }
  /** What the focus chips are, e.g. `Speeches` or `Sections`. */
  columnsName: string
  /** One of them, for the layout switch: `Speech` → "Speech columns". */
  columnName: string
  /** What an aff / neg badge says on a bubble's details. */
  sideNames?: { aff: string; neg: string }
}

export function FlowChartView({
  chart,
  columns,
  legend,
  columnsName,
  columnName,
  sideNames = { aff: "AFF", neg: "NEG" },
}: FlowChartViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [layout, setLayout] = useState<FlowChartLayout>("columns")
  const [focusSpeeches, setFocusSpeeches] = useState<ReadonlySet<string>>(NO_FOCUS)

  // A new chart starts with nothing selected or focused.
  useEffect(() => {
    setSelectedId(null)
    setFocusSpeeches(NO_FOCUS)
  }, [chart])

  const toggleSpeech = (label: string) => {
    setLayout("columns")
    setFocusSpeeches((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }
  const selected = chart.nodes.find((node) => node.id === selectedId) ?? null
  const selectedParent = selected?.parent ? chart.nodes.find((node) => node.id === selected.parent) : undefined
  const selectedLinks = selected
    ? chart.links.filter((link) => link.source === selected.id || link.target === selected.id)
    : []
  const nodeLabel = (id: string) => chart.nodes.find((node) => node.id === id)?.label ?? id

  const copyOutline = async () => {
    try {
      await navigator.clipboard.writeText(flowChartOutline(chart))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked; nothing to do.
    }
  }

  return (
    <div className="space-y-3">
      {chart.summary && (
        <p className="text-sm">
          <span className="font-semibold">Bottom line: </span>
          {chart.summary}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ background: FLOW_CHART_COLORS.aff.strong }} />
          {legend.aff}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ background: FLOW_CHART_COLORS.neg.strong }} />
          {legend.neg}
        </span>
        <span>Purple dashes: answers · grey dots: extensions · grey dashes: related</span>
        <span>
          {layout === "free" ? "Drag bubbles to rearrange, scroll" : "Scroll"} to zoom, click a bubble to read it.
        </span>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => void copyOutline()}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          Copy as outline
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={`${columnsName} and layout`}>
        <span className="text-xs text-muted-foreground mr-1">{columnsName}:</span>
        <button
          type="button"
          onClick={() => setFocusSpeeches(NO_FOCUS)}
          aria-pressed={focusSpeeches.size === 0}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${focusSpeeches.size === 0 ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
        >
          All
        </button>
        {columns
          .filter((column) => column.label)
          .map((column) => {
            const active = focusSpeeches.has(column.label)
            const shown = focusSpeeches.size === 0 || active
            const name = column.title ? `${column.label} ${column.title}` : column.label
            return (
              <button
                key={column.label}
                type="button"
                onClick={() => toggleSpeech(column.label)}
                aria-pressed={active}
                title={`Show ${name}'s arguments in colour and grey out the rest`}
                className="rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-opacity"
                style={{
                  background: shown ? column.color : "transparent",
                  borderColor: column.color,
                  color: shown ? "#ffffff" : column.color,
                  boxShadow: active ? `0 0 0 2px var(--background, #fff), 0 0 0 4px ${column.color}` : undefined,
                }}
              >
                {column.label}
              </button>
            )
          })}
        <div className="ml-auto inline-flex rounded-md border p-0.5" role="group" aria-label="Layout">
          {(
            [
              ["columns", `${columnName} columns`],
              ["free", "Free arrange"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => setLayout(value)}
              aria-pressed={layout === value}
              className={`rounded px-2.5 py-1 text-xs font-medium ${layout === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[60vh] min-h-[360px] rounded-lg border bg-muted/20 overflow-hidden">
        <DebateFlowChartGraph
          chart={chart}
          columns={columns}
          layout={layout}
          focusSpeeches={focusSpeeches}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm rounded-md border bg-background/95 p-3 shadow-md text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ background: FLOW_CHART_COLORS[selected.side].strong }}
              >
                {sideNames[selected.side]}
              </span>
              <span className="font-semibold">{selected.label}</span>
              {selected.speech && <span className="text-xs text-muted-foreground">{selected.speech}</span>}
            </div>
            {selectedParent && <p className="text-xs text-muted-foreground">Part of: {selectedParent.label}</p>}
            {selected.explanation && <p>{selected.explanation}</p>}
            {selectedLinks.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-4">
                {selectedLinks.map((link) => (
                  <li key={`${link.source}-${link.target}`}>
                    {link.source === selected.id
                      ? `${link.kind} → ${nodeLabel(link.target)}`
                      : `${nodeLabel(link.source)} ${link.kind} this`}
                    {link.label ? `: ${link.label}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Every argument, explained</summary>
        <ul className="mt-2 space-y-1.5">
          {chart.nodes
            .filter((node) => !node.parent)
            .map((node) => (
              <li key={node.id}>
                <span className="font-semibold" style={{ color: FLOW_CHART_COLORS[node.side].strong }}>
                  {sideNames[node.side]} · {node.label}
                </span>
                {node.explanation && <span> — {node.explanation}</span>}
                <ul className="ml-4 mt-0.5 list-disc pl-4 text-muted-foreground">
                  {chart.nodes
                    .filter((child) => child.parent === node.id)
                    .map((child) => (
                      <li key={child.id}>
                        <span className="font-medium">{child.label}</span>
                        {child.explanation && ` — ${child.explanation}`}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
        </ul>
      </details>
    </div>
  )
}
