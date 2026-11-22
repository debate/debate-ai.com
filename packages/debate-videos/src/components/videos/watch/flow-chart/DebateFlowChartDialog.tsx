/**
 * @fileoverview The watch page's "Flow chart" modal: an editable prompt,
 * then the whole round drawn as a D3 mind map.
 *
 * Generating runs in two steps. First, the round's last speeches
 * (`MIN_SUMMARIZED_SPEECHES`, or every speech when asked) that have a
 * transcript but no LLM outline yet are outlined one by one — the same call
 * and the same shared store as a speech's "LLM summary" tab, so the outlines
 * are there for every viewer afterwards. Then every outline the round has is
 * sent with the viewer's instructions to `/api/reason-ai` (user's own key
 * first, then the site's `openrouter/free` key, via write-language) and the
 * reply is drawn: aff bubbles blue, neg red, related arguments linked.
 *
 * The last chart and the viewer's edited instructions are kept in this
 * browser, so reopening the modal shows the chart again without a model call.
 * @module components/watch/flow-chart/DebateFlowChartDialog
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Copy, Check, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../../ui/primitives/dialog"
import { Button } from "../../../../ui/primitives/button"
import { Textarea } from "../../../../ui/primitives/textarea"
import type { RoundSpeech } from "../../../../lib/round-speeches"
import type { RoundContext } from "../../../../lib/speech-outcomes"
import {
  DEFAULT_FLOW_CHART_INSTRUCTIONS,
  MIN_SUMMARIZED_SPEECHES,
  flowChartOutline,
  flowChartOutlines,
  flowChartSpeechColumns,
  isFlowChartSpeech,
  parseFlowChartResponse,
  speechesToSummarize,
  type DebateFlowChart,
} from "../../../../lib/debate-flow-chart"
import { requestFlowChart, requestSpeechSummary } from "../../../../lib/speech-ai-client"
import { readSpeechSummaries, writeSpeechSummary } from "../../../../state/speechAiCache"
import { shareVideoAiResult, useSharedVideoAi } from "../../../../state/sharedVideoAi"
import { DebateFlowChartGraph, FLOW_CHART_COLORS, type FlowChartLayout } from "./DebateFlowChartGraph"

const INSTRUCTIONS_KEY = "debate-ai:flow-chart:instructions"
const NO_FOCUS: ReadonlySet<string> = new Set()
const CHART_KEY_PREFIX = "debate-ai:flow-chart:"

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

/** The chart this browser last made for a video, if any. */
function readSavedChart(videoId: string): DebateFlowChart | null {
  const saved = readStorage(CHART_KEY_PREFIX + videoId)
  return saved ? parseFlowChartResponse(saved) : null
}

/** Saves a chart in the same JSON shape the model replies with, so one parser reads both. */
function saveChart(videoId: string, chart: DebateFlowChart): void {
  writeStorage(
    CHART_KEY_PREFIX + videoId,
    JSON.stringify({
      summary: chart.summary,
      nodes: chart.nodes.map(({ explanation, ...node }) => ({ ...node, text: explanation })),
      links: chart.links.map(({ source, target, ...link }) => ({ from: source, to: target, ...link })),
    }),
  )
}

type Progress =
  | { step: "idle" }
  | { step: "summarizing"; done: number; total: number; label: string }
  | { step: "charting" }

export interface DebateFlowChartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoId: string
  videoTitle?: string
  speeches: RoundSpeech[]
  round?: RoundContext
}

export default function DebateFlowChartDialog({
  open,
  onOpenChange,
  videoId,
  videoTitle,
  speeches,
  round,
}: DebateFlowChartDialogProps) {
  const shared = useSharedVideoAi(videoId)
  const [instructions, setInstructions] = useState(DEFAULT_FLOW_CHART_INSTRUCTIONS)
  const [summarizeAll, setSummarizeAll] = useState(false)
  const [progress, setProgress] = useState<Progress>({ step: "idle" })
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [chart, setChart] = useState<DebateFlowChart | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [layout, setLayout] = useState<FlowChartLayout>("columns")
  const [focusSpeeches, setFocusSpeeches] = useState<ReadonlySet<string>>(NO_FOCUS)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const saved = readStorage(INSTRUCTIONS_KEY)
    if (saved?.trim()) setInstructions(saved)
  }, [])

  useEffect(() => {
    setChart(readSavedChart(videoId))
    setSelectedId(null)
    setFocusSpeeches(NO_FOCUS)
    setError(null)
    setWarning(null)
  }, [videoId])

  // Closing the modal or leaving the video stops a run in flight.
  useEffect(() => {
    if (!open) abortRef.current?.abort()
  }, [open])
  useEffect(() => () => abortRef.current?.abort(), [videoId])

  const teamSpeeches = useMemo(() => speeches.filter(isFlowChartSpeech), [speeches])
  const outlines = useMemo(
    () => ({ ...shared.summaries, ...(open ? readSpeechSummaries(videoId) : {}) }),
    // Re-read this browser's outlines each time the modal opens or a run finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shared.summaries, videoId, open, progress.step],
  )
  const outlinedCount = teamSpeeches.filter((speech) => outlines[speech.key]?.trim()).length
  const pendingCount = speechesToSummarize(speeches, outlines, { all: summarizeAll }).length
  const busy = progress.step !== "idle"

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const forVideo = videoId
    setError(null)
    setWarning(null)
    setSelectedId(null)
    setFocusSpeeches(NO_FOCUS)
    writeStorage(INSTRUCTIONS_KEY, instructions === DEFAULT_FLOW_CHART_INSTRUCTIONS ? null : instructions)

    const current: Record<string, string> = { ...shared.summaries, ...readSpeechSummaries(forVideo) }
    const missing = speechesToSummarize(speeches, current, { all: summarizeAll })
    const failed: Array<{ key: string; label: string; reason: string }> = []
    try {
      for (const [index, speech] of missing.entries()) {
        setProgress({ step: "summarizing", done: index, total: missing.length, label: speech.label })
        try {
          const outline = await requestSpeechSummary(
            {
              heading: speech.heading,
              side: speech.side,
              transcript: speech.parts.transcript ?? "",
              videoTitle,
              format: round?.format,
            },
            { signal: controller.signal },
          )
          current[speech.key] = outline
          writeSpeechSummary(forVideo, speech.key, outline)
          void shareVideoAiResult(forVideo, { kind: "summary", key: speech.key, data: outline })
        } catch (summaryError) {
          if (controller.signal.aborted) return
          const reason = summaryError instanceof Error ? summaryError.message : String(summaryError)
          failed.push({ key: speech.key, label: speech.label, reason })
          // Signed out or over the plan's limit: the rest will fail the same way.
          if (/sign in|limit/i.test(reason)) throw summaryError
        }
      }

      // A speech whose summary still failed goes in as the start of its captions instead.
      const outlined = flowChartOutlines(speeches, current, new Set(failed.map((f) => f.key)))
      if (outlined.length === 0) {
        throw new Error(
          "No speech has a transcript or LLM summary yet. Turn on captions or run Detect speeches, then try again.",
        )
      }
      setProgress({ step: "charting" })
      const result = await requestFlowChart(
        {
          instructions,
          speeches: outlined,
          videoTitle,
          format: round?.format,
          aff: round?.aff,
          neg: round?.neg,
        },
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      setChart(result)
      saveChart(forVideo, result)
      if (failed.length > 0) {
        const reasons = [...new Set(failed.map((f) => f.reason))].join(" ")
        setWarning(
          `Couldn't summarize ${failed.map((f) => f.label).join(", ")} after 3 tries (${reasons}), so the chart read their captions instead.`,
        )
      }
    } catch (runError) {
      if (controller.signal.aborted) return
      setError(runError instanceof Error ? runError.message : "The flow chart failed.")
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setProgress({ step: "idle" })
      }
    }
  }

  // Keyed on the speeches' labels, not the array, so re-renders of the page don't rebuild the graph.
  const speechKey = speeches.map((speech) => `${speech.label}:${speech.side}`).join("|")
  const columns = useMemo(
    () => (chart ? flowChartSpeechColumns(chart, speeches) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chart, speechKey],
  )
  const toggleSpeech = (label: string) => {
    setLayout("columns")
    setFocusSpeeches((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }
  const selected = chart?.nodes.find((node) => node.id === selectedId) ?? null
  const selectedParent = selected?.parent ? chart?.nodes.find((node) => node.id === selected.parent) : undefined
  const selectedLinks = selected
    ? (chart?.links ?? []).filter((link) => link.source === selected.id || link.target === selected.id)
    : []
  const nodeLabel = (id: string) => chart?.nodes.find((node) => node.id === id)?.label ?? id

  const copyOutline = async () => {
    if (!chart) return
    try {
      await navigator.clipboard.writeText(flowChartOutline(chart))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked; nothing to do.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Debate flow chart</DialogTitle>
          <DialogDescription>
            A mind map of the whole round from the LLM summary of each speech. Each aff speech has its own shade of
            blue and each neg speech its own shade of red, and dashed lines connect arguments that answer or extend
            each other. Click a speech to focus it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="flow-chart-instructions" className="text-sm font-medium">
              Prompt
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || instructions === DEFAULT_FLOW_CHART_INSTRUCTIONS}
              onClick={() => setInstructions(DEFAULT_FLOW_CHART_INSTRUCTIONS)}
            >
              <RotateCcw className="size-3.5" />
              Reset to default
            </Button>
          </div>
          <Textarea
            id="flow-chart-instructions"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={chart ? 4 : 8}
            disabled={busy}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>
              {outlinedCount} of {teamSpeeches.length} speech{teamSpeeches.length === 1 ? "" : "es"} summarized
              {pendingCount > 0 && ` · ${pendingCount} more will be summarized first`}
            </span>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={summarizeAll}
                disabled={busy}
                onChange={(event) => setSummarizeAll(event.target.checked)}
              />
              Summarize every speech, not just the last {MIN_SUMMARIZED_SPEECHES}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void generate()} disabled={busy || teamSpeeches.length === 0}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {chart ? "Generate again" : "Generate flow chart"}
            </Button>
            {busy && (
              <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>
                Cancel
              </Button>
            )}
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {progress.step === "summarizing" &&
                `Summarizing ${progress.label} (${progress.done + 1} of ${progress.total})…`}
              {progress.step === "charting" && "Building the flow chart…"}
            </span>
          </div>
          {error && (
            <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          {warning && <p className="text-xs text-amber-600 dark:text-amber-400">{warning}</p>}
        </div>

        {chart && (
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
                Affirmative speeches (shades of blue)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-full" style={{ background: FLOW_CHART_COLORS.neg.strong }} />
                Negative speeches (shades of red)
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
            <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Speeches and layout">
              <span className="text-xs text-muted-foreground mr-1">Speeches:</span>
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
                  return (
                    <button
                      key={column.label}
                      type="button"
                      onClick={() => toggleSpeech(column.label)}
                      aria-pressed={active}
                      title={`Show ${column.label}'s arguments in colour and grey out the rest`}
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
                    ["columns", "Speech columns"],
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
                      {selected.side === "aff" ? "AFF" : "NEG"}
                    </span>
                    <span className="font-semibold">{selected.label}</span>
                    {selected.speech && <span className="text-xs text-muted-foreground">{selected.speech}</span>}
                  </div>
                  {selectedParent && (
                    <p className="text-xs text-muted-foreground">Part of: {selectedParent.label}</p>
                  )}
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
                        {node.side === "aff" ? "AFF" : "NEG"} · {node.label}
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
        )}
      </DialogContent>
    </Dialog>
  )
}
