/**
 * @fileoverview The docs pages' "Flow chart" modal: an editable prompt,
 * then the current page's arguments drawn as the same D3 mind map the watch
 * page draws for a round.
 *
 * On submit the page's Markdown is fetched from `markdownUrl` (the same file
 * the Copy button copies), split into sections at its headings
 * (`pageFlowChartSections`), and sent with the reader's instructions to
 * `/api/reason-ai` in one call (`requestPageFlowChart`). The sections are the
 * chart's columns, as speeches are on the watch page. The last chart for a
 * page and the reader's edited instructions are kept in this browser, so
 * reopening the modal shows the chart again without a model call.
 * @module components/watch/flow-chart/PageFlowChartDialog
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../../ui/primitives/dialog"
import { Button } from "../../../../ui/primitives/button"
import { Textarea } from "../../../../ui/primitives/textarea"
import { flowChartSpeechColumns, parseFlowChartResponse, type DebateFlowChart } from "../../../../lib/debate-flow-chart"
import {
  DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS,
  pageFlowChartSections,
  type PageFlowChartSection,
} from "../../../../lib/page-flow-chart"
import { requestPageFlowChart } from "../../../../lib/speech-ai-client"
import { FlowChartView } from "./FlowChartView"

const INSTRUCTIONS_KEY = "debate-ai:page-flow-chart:instructions"
const CHART_KEY_PREFIX = "debate-ai:page-flow-chart:"

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Private mode or full storage: the chart just isn't remembered.
  }
}

/** What this browser keeps for a page: the chart, and its sections' headings for the column titles. */
interface SavedPageChart {
  chart: DebateFlowChart
  sections: Array<Pick<PageFlowChartSection, "label" | "heading">>
}

function readSavedChart(pageKey: string): SavedPageChart | null {
  const saved = readStorage(CHART_KEY_PREFIX + pageKey)
  if (!saved) return null
  try {
    const parsed = JSON.parse(saved) as { chart?: unknown; sections?: SavedPageChart["sections"] }
    const chart = parseFlowChartResponse(JSON.stringify(parsed.chart ?? null))
    return chart ? { chart, sections: Array.isArray(parsed.sections) ? parsed.sections : [] } : null
  } catch {
    return null
  }
}

/** Saves the chart in the model's reply shape, so one parser reads both. */
function saveChart(pageKey: string, { chart, sections }: SavedPageChart): void {
  writeStorage(
    CHART_KEY_PREFIX + pageKey,
    JSON.stringify({
      chart: {
        summary: chart.summary,
        nodes: chart.nodes.map(({ explanation, ...node }) => ({ ...node, text: explanation })),
        links: chart.links.map(({ source, target, ...link }) => ({ from: source, to: target, ...link })),
      },
      sections,
    }),
  )
}

export interface PageFlowChartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A stable key for the page, e.g. its URL path; the saved chart is kept under it. */
  pageKey: string
  /** The page's title, sent with the prompt. */
  title?: string
  /** Where the page's Markdown is served (the Copy button's source). */
  markdownUrl: string
}

export default function PageFlowChartDialog({ open, onOpenChange, pageKey, title, markdownUrl }: PageFlowChartDialogProps) {
  const [instructions, setInstructions] = useState(DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedPageChart | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const stored = readStorage(INSTRUCTIONS_KEY)
    if (stored?.trim()) setInstructions(stored)
  }, [])

  useEffect(() => {
    setSaved(readSavedChart(pageKey))
    setError(null)
  }, [pageKey])

  // Closing the modal or leaving the page stops a run in flight.
  useEffect(() => {
    if (!open) abortRef.current?.abort()
  }, [open])
  useEffect(() => () => abortRef.current?.abort(), [pageKey])

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const forPage = pageKey
    setError(null)
    setBusy(true)
    writeStorage(INSTRUCTIONS_KEY, instructions === DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS ? null : instructions)
    try {
      const res = await fetch(markdownUrl, { signal: controller.signal })
      if (!res.ok) throw new Error(`Couldn't load this page's text (${res.status}).`)
      const sections = pageFlowChartSections(await res.text())
      if (sections.length === 0) throw new Error("This page has no text to chart.")
      const chart = await requestPageFlowChart({ instructions, title, sections }, { signal: controller.signal })
      if (controller.signal.aborted) return
      const result: SavedPageChart = {
        chart,
        sections: sections.map(({ label, heading }) => ({ label, heading })),
      }
      setSaved(result)
      saveChart(forPage, result)
    } catch (runError) {
      if (controller.signal.aborted) return
      setError(runError instanceof Error ? runError.message : "The flow chart failed.")
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setBusy(false)
      }
    }
  }

  const chart = saved?.chart ?? null
  const columns = useMemo(() => {
    if (!saved) return []
    const headings = new Map(saved.sections.map((section) => [section.label, section.heading]))
    const sectionColumns = saved.sections.map((section) => ({ label: section.label, side: "neutral" as const }))
    return flowChartSpeechColumns(saved.chart, sectionColumns).map((column) => ({
      ...column,
      title: headings.get(column.label),
    }))
  }, [saved])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Flow chart of this page</DialogTitle>
          <DialogDescription>
            A mind map of {title ? <q>{title}</q> : "this page"}: the page's own claims in blue, the views it raises
            or answers in red, one column per section, and dashed lines between arguments that answer or build on
            each other. Click a section to focus it.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            void generate()
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="page-flow-chart-instructions" className="text-sm font-medium">
              Prompt
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || instructions === DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS}
              onClick={() => setInstructions(DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS)}
            >
              <RotateCcw className="size-3.5" />
              Reset to default
            </Button>
          </div>
          <Textarea
            id="page-flow-chart-instructions"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={chart ? 4 : 8}
            disabled={busy}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {chart ? "Generate again" : "Generate flow chart"}
            </Button>
            {busy && (
              <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>
                Cancel
              </Button>
            )}
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {busy && "Building the flow chart…"}
            </span>
          </div>
          {error && (
            <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </form>

        {chart && (
          <FlowChartView
            chart={chart}
            columns={columns}
            legend={{ aff: "The page's claims (shades of blue)", neg: "Views it raises or answers (shades of red)" }}
            columnsName="Sections"
            columnName="Section"
            sideNames={{ aff: "CLAIM", neg: "OPPOSING" }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
