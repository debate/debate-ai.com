/**
 * @fileoverview Pre-generating a round's flow: the LLM summaries of its last
 * four team speeches and the whole-round flow chart (the watch page's "Flow
 * chart" mind map, with the default instructions).
 *
 * The admin hourly round flow job runs this on one round an hour, newest
 * first, on the server with the site's AI key. It works the way the watch
 * page's Flow chart modal does — Detect speeches when nothing times the
 * round, outline the last {@link ROUND_FLOW_SPEECH_COUNT} team speeches that
 * have no outline yet, then send every outline the round has to the chart
 * prompt — and saves each result through the shared store
 * (`lib/shared-video-ai.ts`) first-come, so the modal opens on the saved
 * chart and the speeches' LLM summary tabs are already filled.
 *
 * Everything that touches the network or the database is passed in, so the
 * run is testable without either.
 * @module lib/round-flow-precompute
 */

import {
  DEFAULT_FLOW_CHART_INSTRUCTIONS,
  FLOW_CHART_SYSTEM_PROMPT,
  MIN_SUMMARIZED_SPEECHES,
  buildFlowChartPrompt,
  flowChartOutlines,
  isFlowChartSpeech,
  parseFlowChartResponse,
  speechesToSummarize,
} from "./debate-flow-chart"
import {
  SPEECH_SUMMARY_SYSTEM_PROMPT,
  buildSpeechSummaryPrompt,
  parseSpeechSummaryResponse,
} from "./speech-summary"
import type { SharedVideoAi } from "./shared-video-ai"
import {
  buildWatchSpeeches,
  detectSpeeches,
  hasSpeechTiming,
  precomputeRoundContext,
  type PrecomputeDeps,
  type PrecomputeVideo,
} from "./watch-ai-precompute"
import type { TranscriptSnippet } from "../components/videos/transcript/transcriptUtils"
import type { VideoDocument } from "./video-documents"

/** How many of the round's last team speeches get an outline: the modal's default. */
export const ROUND_FLOW_SPEECH_COUNT = MIN_SUMMARIZED_SPEECHES

/** Room for one speech outline, as the watch page asks. */
const SUMMARY_MAX_TOKENS = 1800
/** Room for the chart's JSON, as the watch page asks. */
const FLOW_CHART_MAX_TOKENS = 6000

/** What one round's run did. */
export interface RoundFlowResult {
  status: "done" | "skipped" | "failed"
  /** Why it was skipped or failed. */
  reason?: string
  /** Labels of the last team speeches, e.g. `["1NR", "1AR", "2NR", "2AR"]`. */
  speeches: string[]
  /** Whether this run detected (and shared) the round's speeches. */
  detected: boolean
  /** Labels of the speeches that got a new LLM summary. */
  summaries: string[]
  /** Whether this run saved the round's flow chart. */
  flowChart: boolean
  /** Bubbles on the saved chart. */
  nodes: number
  /** One line per step that failed; the rest of the round still ran. */
  errors: string[]
}

/** Whether a round still lacks its shared flow chart (and so needs a run). */
export function roundFlowNeeded(shared: SharedVideoAi): boolean {
  return !shared.flowChart
}

/**
 * Runs whatever a round's flow is missing: Detect speeches when nothing times
 * it, the LLM summaries of its last four team speeches, then the flow chart.
 * A failed summary doesn't stop the chart — that speech goes in as the start
 * of its captions, as in the modal.
 */
export async function precomputeRoundFlow(
  video: PrecomputeVideo,
  documents: VideoDocument[],
  shared: SharedVideoAi,
  deps: PrecomputeDeps,
): Promise<RoundFlowResult> {
  const result: RoundFlowResult = {
    status: "done",
    speeches: [],
    detected: false,
    summaries: [],
    flowChart: false,
    nodes: 0,
    errors: [],
  }
  if (!roundFlowNeeded(shared)) return { ...result, status: "skipped", reason: "Already has a flow chart." }
  const base = buildWatchSpeeches({ documents, style: video.style, segmentation: shared.segmentation, starts: shared.starts })
  if (base.length === 0) return { ...result, status: "skipped", reason: "Not a round." }

  const captions = await deps.loadCaptions().catch(() => [] as TranscriptSnippet[])
  let segmentation = shared.segmentation
  if (!segmentation && !hasSpeechTiming(base) && captions.length > 0) {
    segmentation = await detectSpeeches(video, captions, deps).catch((error: unknown) => {
      result.errors.push(`Detect speeches: ${message(error)}`)
      return null
    })
    if (segmentation) {
      await deps.share({ kind: "segmentation", key: "", data: segmentation })
      result.detected = true
    }
  }

  const speeches = buildWatchSpeeches({ documents, style: video.style, segmentation, starts: shared.starts, captions })
  const withText = speeches.filter((speech) => isFlowChartSpeech(speech) && speech.parts.transcript?.trim())
  result.speeches = withText.slice(-ROUND_FLOW_SPEECH_COUNT).map((speech) => speech.label)
  const outlines: Record<string, string> = { ...shared.summaries }
  const hasOutline = speeches.some((speech) => isFlowChartSpeech(speech) && outlines[speech.key]?.trim())
  if (withText.length === 0 && !hasOutline) {
    return {
      ...result,
      status: result.detected ? "done" : "skipped",
      reason: captions.length ? "No speeches found in the captions." : "No captions.",
    }
  }

  const round = precomputeRoundContext(video)
  const failedSummaries = new Set<string>()
  for (const speech of speechesToSummarize(speeches, outlines, { count: ROUND_FLOW_SPEECH_COUNT })) {
    try {
      const reply = await deps.ask(
        SPEECH_SUMMARY_SYSTEM_PROMPT,
        buildSpeechSummaryPrompt({
          heading: speech.heading,
          side: speech.side,
          transcript: speech.parts.transcript ?? "",
          videoTitle: video.title,
          format: round.format,
        }),
        SUMMARY_MAX_TOKENS,
      )
      const outline = parseSpeechSummaryResponse(reply)
      if (!outline) throw new Error("the reply had no outline")
      await deps.share({ kind: "summary", key: speech.key, data: outline })
      outlines[speech.key] = outline
      result.summaries.push(speech.label)
    } catch (error) {
      failedSummaries.add(speech.key)
      result.errors.push(`${speech.label} summary: ${message(error)}`)
    }
  }

  const outlined = flowChartOutlines(speeches, outlines, failedSummaries)
  if (outlined.length === 0) {
    return { ...result, status: "failed", reason: result.errors[0] ?? "No speech could be outlined." }
  }
  try {
    const reply = await deps.ask(
      FLOW_CHART_SYSTEM_PROMPT,
      buildFlowChartPrompt({
        instructions: DEFAULT_FLOW_CHART_INSTRUCTIONS,
        speeches: outlined,
        videoTitle: video.title,
        format: round.format,
        aff: round.aff,
        neg: round.neg,
      }),
      FLOW_CHART_MAX_TOKENS,
    )
    const chart = parseFlowChartResponse(reply)
    if (!chart) throw new Error("the reply couldn't be read as a flow chart")
    await deps.share({ kind: "flowchart", key: "", data: chart })
    result.flowChart = true
    result.nodes = chart.nodes.length
  } catch (error) {
    result.errors.push(`Flow chart: ${message(error)}`)
    return { ...result, status: "failed", reason: `Flow chart: ${message(error)}` }
  }
  return result
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
