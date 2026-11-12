/**
 * @fileoverview Pre-generating a round's watch-page AI so readers open it
 * already done: the LLM summary and the Alternatives run (alternative
 * responses with predicted ballots) for the round's last three speeches —
 * in a policy round the 1AR, 2NR and 2AR.
 *
 * The admin "Watch page AI" batch job runs this per video on the server, with
 * the site's own AI key. It builds the round's speeches exactly the way the
 * watch page does (written documents, the shared speech detection, the hand
 * marks, then each speech's captions), so the keys it saves under are the
 * keys a reader's page looks up, and it saves through the same shared store
 * a reader's own run would (`lib/shared-video-ai.ts`). What a video already
 * holds is never run again or replaced.
 *
 * Everything that touches the network or the database is passed in, so the
 * plan and the run are testable without either.
 * @module lib/watch-ai-precompute
 */

import { resolveRoundSpeeches } from "./round-formats"
import {
  captionText,
  withCaptionTranscripts,
  withSpeechStarts,
  type RoundSpeech,
} from "./round-speeches"
import {
  SPEECH_SEGMENTATION_SYSTEM_PROMPT,
  applySpeechSegmentation,
  buildSpeechSegmentationPrompt,
  parseSpeechSegmentationResponse,
  type SpeechSegmentation,
} from "./speech-segmentation"
import { captionPauseSegmentation } from "./caption-speech-split"
import {
  SPEECH_SUMMARY_SYSTEM_PROMPT,
  buildSpeechSummaryPrompt,
  parseSpeechSummaryResponse,
} from "./speech-summary"
import {
  DEFAULT_ALTERNATIVE_COUNT,
  DEFAULT_JUDGE_LENS,
  SPEECH_OUTCOME_SYSTEM_PROMPT,
  buildSpeechOutcomePrompt,
  panelKey,
  parseSpeechOutcomeResponse,
  type JudgeLens,
  type RoundContext,
} from "./speech-outcomes"
import { outcomeMaxTokens } from "./speech-outcomes-client"
import { outcomeKey, type SharedVideoAi, type SharedVideoAiItem } from "./shared-video-ai"
import { groupIntoSentences, type TranscriptSnippet } from "../components/videos/transcript/transcriptUtils"
import type { VideoDocument } from "./video-documents"
import { DEBATE_STYLE_LABELS, type DebateStyle } from "../types/videos"

/** How many of the round's closing speeches get pre-generated. */
export const PRECOMPUTE_SPEECH_COUNT = 3

/**
 * The judge panel the batch runs Alternatives for: the watch page's default,
 * so a reader who never changed their panel sees the saved run.
 */
export const PRECOMPUTE_PANEL: JudgeLens[] = [DEFAULT_JUDGE_LENS]

/** Room for one speech outline, as the watch page asks. */
const SUMMARY_MAX_TOKENS = 1800
/** Room for the speech detection, as the watch page asks. */
const SEGMENTATION_MAX_TOKENS = 2000

/**
 * The last `count` speeches of a round, in speaking order — the rebuttals
 * that decide it. Cross-examinations, overviews and the decision are not
 * speeches here.
 */
export function closingSpeeches(speeches: RoundSpeech[], count = PRECOMPUTE_SPEECH_COUNT): RoundSpeech[] {
  const real = speeches.filter((speech) => speech.isSpeech && speech.side !== "cx")
  return count > 0 ? real.slice(-count) : []
}

/** What the watch page builds the round's speeches from. */
export interface WatchSpeechSources {
  documents: VideoDocument[]
  style: number | null | undefined
  segmentation: SpeechSegmentation | null
  starts: Record<string, number>
  /** Caption cues, raw; grouped into sentences here as the watch page does. */
  captions?: TranscriptSnippet[]
}

/**
 * The round speech by speech, built as `VideoWatchPage` builds it: the
 * written speeches (or the format's order), the detected timing over them,
 * the hand-marked starts, then each untyped speech given its captions.
 */
export function buildWatchSpeeches({ documents, style, segmentation, starts, captions = [] }: WatchSpeechSources): RoundSpeech[] {
  const base = resolveRoundSpeeches(documents, style)
  const timed = withSpeechStarts(applySpeechSegmentation(base, segmentation), starts)
  return withCaptionTranscripts(timed, groupIntoSentences(captions))
}

/** Whether any speech has a start the captions can be cut at. */
export function hasSpeechTiming(speeches: RoundSpeech[]): boolean {
  return speeches.some((speech) => speech.startSeconds !== null)
}

/** What a video still lacks among its closing speeches. */
export interface WatchAiGaps {
  /** Speech keys with no shared LLM summary. */
  summaries: string[]
  /** Speech keys with no shared Alternatives run for {@link PRECOMPUTE_PANEL}. */
  outcomes: string[]
}

/** The closing speeches' missing summaries and Alternatives runs. */
export function watchAiGaps(shared: SharedVideoAi, targets: RoundSpeech[], lens = panelKey(PRECOMPUTE_PANEL)): WatchAiGaps {
  return {
    summaries: targets.filter((speech) => !shared.summaries[speech.key]).map((speech) => speech.key),
    outcomes: targets.filter((speech) => !shared.outcomes[outcomeKey(speech.key, lens)]).map((speech) => speech.key),
  }
}

/** The video's metadata, as the batch reads it from the library row. */
export interface PrecomputeVideo {
  videoId: string
  title: string
  style: number | null
  tournament?: string | null
  roundLevel?: string | null
  affTeam?: string | null
  negTeam?: string | null
  judgeDecision?: string | null
}

/** The round as the Alternatives prompt describes it — the watch page's `roundContext`. */
export function precomputeRoundContext(video: PrecomputeVideo): RoundContext {
  return {
    format: video.style !== null ? DEBATE_STYLE_LABELS[video.style as DebateStyle] : undefined,
    tournament: video.tournament ?? null,
    roundLevel: video.roundLevel ?? null,
    aff: video.affTeam ?? null,
    neg: video.negTeam ?? null,
    decision: video.judgeDecision ?? null,
  }
}

/** The I/O one run needs; the server passes the real thing, tests pass fakes. */
export interface PrecomputeDeps {
  /** Asks the model; returns its text or throws. */
  ask: (system: string, prompt: string, maxTokens: number) => Promise<string>
  /** Saves one result for every viewer; must not replace one already stored. */
  share: (item: SharedVideoAiItem) => Promise<void>
  /** The video's caption cues, or `[]` when it has none. Only called when needed. */
  loadCaptions: () => Promise<TranscriptSnippet[]>
}

/** What one video's run did. */
export interface PrecomputeVideoResult {
  status: "done" | "skipped" | "failed"
  /** Why it was skipped or failed. */
  reason?: string
  /** The closing speeches' labels, e.g. `["1AR", "2NR", "2AR"]`. */
  speeches: string[]
  /** Whether this run detected (and shared) the round's speeches. */
  detected: boolean
  /** Labels of the speeches that got a new summary / Alternatives run. */
  summaries: string[]
  outcomes: string[]
  /** One line per speech step that failed; the rest of the video still ran. */
  errors: string[]
}

/** A quick look, without captions or model calls, at whether a video needs a run. */
export function precomputeNeeded(video: PrecomputeVideo, documents: VideoDocument[], shared: SharedVideoAi): boolean {
  const speeches = buildWatchSpeeches({
    documents,
    style: video.style,
    segmentation: shared.segmentation,
    starts: shared.starts,
  })
  if (speeches.length === 0) return false
  // Untimed speeches still need a detection, which can re-key the round.
  if (!shared.segmentation && !hasSpeechTiming(speeches)) return true
  const gaps = watchAiGaps(shared, closingSpeeches(speeches))
  return gaps.summaries.length > 0 || gaps.outcomes.length > 0
}

/**
 * Runs whatever a video is missing: the speech detection when nothing times
 * its speeches, then a summary and an Alternatives run for each of its last
 * three speeches that has none. One failed speech doesn't stop the others.
 */
export async function precomputeWatchAi(
  video: PrecomputeVideo,
  documents: VideoDocument[],
  shared: SharedVideoAi,
  deps: PrecomputeDeps,
): Promise<PrecomputeVideoResult> {
  const result: PrecomputeVideoResult = {
    status: "done",
    speeches: [],
    detected: false,
    summaries: [],
    outcomes: [],
    errors: [],
  }
  if (!precomputeNeeded(video, documents, shared)) {
    const speeches = buildWatchSpeeches({ documents, style: video.style, segmentation: shared.segmentation, starts: shared.starts })
    return {
      ...result,
      status: "skipped",
      reason: speeches.length === 0 ? "Not a round." : "Already pre-generated.",
      speeches: closingSpeeches(speeches).map((speech) => speech.label),
    }
  }

  const captions = await deps.loadCaptions().catch(() => [] as TranscriptSnippet[])
  let segmentation = shared.segmentation
  const untimed = buildWatchSpeeches({ documents, style: video.style, segmentation, starts: shared.starts })
  if (!segmentation && !hasSpeechTiming(untimed) && captions.length > 0) {
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
  const targets = closingSpeeches(speeches)
  result.speeches = targets.map((speech) => speech.label)
  const roundTranscript = captionText(groupIntoSentences(captions))
  const written = speeches.some((speech) => Object.keys(speech.parts).length > 0)
  if (targets.length === 0 || (!written && !roundTranscript)) {
    return { ...result, status: result.detected ? "done" : "skipped", reason: captions.length ? "No speeches found." : "No captions." }
  }

  const gaps = watchAiGaps(shared, targets)
  const lens = panelKey(PRECOMPUTE_PANEL)
  const round = precomputeRoundContext(video)

  for (const speech of targets) {
    const text = speech.parts.transcript?.trim() ?? ""
    if (gaps.summaries.includes(speech.key) && text) {
      try {
        const reply = await deps.ask(
          SPEECH_SUMMARY_SYSTEM_PROMPT,
          buildSpeechSummaryPrompt({ heading: speech.heading, side: speech.side, transcript: text, videoTitle: video.title, format: round.format }),
          SUMMARY_MAX_TOKENS,
        )
        const outline = parseSpeechSummaryResponse(reply)
        if (!outline) throw new Error("the reply had no outline")
        await deps.share({ kind: "summary", key: speech.key, data: outline })
        result.summaries.push(speech.label)
      } catch (error) {
        result.errors.push(`${speech.label} summary: ${message(error)}`)
      }
    }
    if (gaps.outcomes.includes(speech.key)) {
      try {
        const index = speeches.findIndex((other) => other.key === speech.key)
        const reply = await deps.ask(
          SPEECH_OUTCOME_SYSTEM_PROMPT,
          buildSpeechOutcomePrompt({
            videoTitle: video.title,
            round,
            speeches,
            index,
            panel: PRECOMPUTE_PANEL,
            count: DEFAULT_ALTERNATIVE_COUNT,
            roundTranscript,
          }),
          outcomeMaxTokens(DEFAULT_ALTERNATIVE_COUNT, PRECOMPUTE_PANEL.length),
        )
        const simulation = parseSpeechOutcomeResponse(reply, DEFAULT_ALTERNATIVE_COUNT, PRECOMPUTE_PANEL)
        if (!simulation) throw new Error("the reply couldn't be read as alternatives")
        await deps.share({ kind: "outcome", key: outcomeKey(speech.key, lens), data: simulation })
        result.outcomes.push(speech.label)
      } catch (error) {
        result.errors.push(`${speech.label} alternatives: ${message(error)}`)
      }
    }
  }

  const wrote = result.detected || result.summaries.length > 0 || result.outcomes.length > 0
  if (!wrote && result.errors.length > 0) return { ...result, status: "failed", reason: result.errors[0] }
  return result
}

/** "Detect speeches", as the watch page asks it. */
async function detectSpeeches(
  video: PrecomputeVideo,
  captions: TranscriptSnippet[],
  deps: PrecomputeDeps,
): Promise<SpeechSegmentation> {
  const reply = await deps.ask(
    SPEECH_SEGMENTATION_SYSTEM_PROMPT,
    buildSpeechSegmentationPrompt({
      captions,
      videoTitle: video.title,
      formatHint: video.style !== null ? DEBATE_STYLE_LABELS[video.style as DebateStyle] : undefined,
      aff: video.affTeam ?? undefined,
      neg: video.negTeam ?? undefined,
      pauseGuess: captionPauseSegmentation(captions, video.style)?.speeches,
    }),
    SEGMENTATION_MAX_TOKENS,
  )
  const last = captions.reduce((latest, caption) => Math.max(latest, caption.start + caption.duration), 0)
  const segmentation = parseSpeechSegmentationResponse(reply, { durationSeconds: last + 30 })
  if (!segmentation) throw new Error("the AI found no speeches in the captions")
  return segmentation
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
