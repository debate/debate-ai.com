/**
 * @fileoverview Network side of the speech start labeler (the speech menu's
 * "Select YouTube Start"): searches the site's own video library, loads a
 * video's captions from `/api/transcript`, and asks `/api/reason-ai` to place
 * the format's speeches on a recording — a YouTube video or an audio file
 * such as the round's joined MP3, given its captions. The caption-gap placement it starts from is pure and lives in
 * `debate-timer` (`recorder/youtube-speech-segments.ts`); the prompt lives in
 * `debate-speech-writer` (`prompts/youtube-speech-timestamps.ts`).
 *
 * @module round/youtube-speech-client
 */

import {
  buildSpokenBlocks,
  scheduleSpeechSegments,
  suggestSpeechSegments,
  type CaptionSnippet,
  type SpeechSegment,
} from "@debate-ai/timer/src/recorder/youtube-speech-segments"
import {
  YOUTUBE_SPEECH_TIMESTAMPS_SYSTEM_PROMPT,
  buildYouTubeSpeechTimestampsUserPrompt,
  parseYouTubeSpeechTimestampsResponse,
} from "@debate-ai/speech-writer/src/prompts/youtube-speech-timestamps"
import type { TimerSpeech } from "@debate-ai/types"

/** A video from the site's library, as the picker lists it. */
export type SiteVideo = {
  videoId: string
  title: string
  channel: string
  publishedAt: string
  /** Numeric debate style (1 Policy, 2 PF, 3 LD, 4 College), when it's a round. */
  style: number | null
}

/**
 * Searches the site's videos (`/api/videos`, rounds first). Each row is the
 * compact tuple the video grid uses: `[videoId, title, publishedAt, channel,
 * viewCount, description, style, ...]`.
 */
export async function searchSiteVideos(query: string, limit = 12): Promise<SiteVideo[]> {
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit), sort: "Views" })
  const res = await fetch(`/api/videos?${params.toString()}`)
  const json = (await res.json().catch(() => ({}))) as { videos?: unknown[][]; error?: string }
  if (!res.ok) throw new Error(json.error || `Video search failed (${res.status}).`)
  return (json.videos ?? [])
    .filter((row) => Array.isArray(row) && typeof row[0] === "string")
    .map((row) => ({
      videoId: row[0] as string,
      title: String(row[1] ?? ""),
      publishedAt: String(row[2] ?? ""),
      channel: String(row[3] ?? ""),
      style: typeof row[6] === "number" ? row[6] : null,
    }))
}

/** A video's captions; `unavailable` says why when there are none. */
export async function fetchCaptions(videoId: string): Promise<{ snippets: CaptionSnippet[]; unavailable?: string }> {
  const res = await fetch(`/api/transcript?videoId=${encodeURIComponent(videoId)}`)
  const json = (await res.json().catch(() => ({}))) as { snippets?: CaptionSnippet[]; unavailable?: string; error?: string }
  if (!res.ok) return { snippets: [], unavailable: json.error || `Captions request failed (${res.status}).` }
  return { snippets: json.snippets ?? [], unavailable: json.unavailable }
}

/** Where each speech was placed, and how. */
export type SpeechTimestampSuggestion = {
  segments: SpeechSegment[]
  /** `ai` — the model placed them; `captions` — caption gaps alone; `schedule` — rule lengths from a start time. */
  source: "ai" | "captions" | "schedule"
  notes: string
}

/** The video's `debateStyles` index (see `debateStyleMap`) for a library style number. */
export function styleIndexForVideoStyle(style: number | null): number | null {
  switch (style) {
    case 1:
      return 2 // policy
    case 2:
      return 0 // publicForum
    case 3:
      return 1 // lincolnDouglas
    case 4:
      return 3 // collegePolicy
    default:
      return null
  }
}

/** The library style number (1 Policy, 2 PF, 3 LD, 4 College) for a `debateStyles` index. */
export function videoStyleForStyleIndex(index: number): number | null {
  for (const style of [1, 2, 3, 4]) if (styleIndexForVideoStyle(style) === index) return style
  return null
}

const MAX_TOKENS = 2048

/**
 * Place every speech of the format on the video. Captions are split at
 * silences and placed by length; then the AI refines that from what's said.
 * Falls back to the caption-only placement when the AI is unavailable, and to
 * rule lengths laid end to end from `firstStart` when there are no captions.
 */
export async function suggestSpeechTimestamps(options: {
  /** The recording's captions — a YouTube video's (see `fetchCaptions`) or an audio file's. */
  snippets: CaptionSnippet[]
  /** Why there are no captions, when there are none. */
  unavailable?: string
  formatName: string
  speeches: TimerSpeech[]
  prepMinutes: number
  /** Where the user marked the first speech starting, if they did. */
  firstStart?: number | null
  /** Skip the AI step. */
  captionsOnly?: boolean
  endpoint?: string
}): Promise<SpeechTimestampSuggestion> {
  const { snippets, unavailable, formatName, speeches, prepMinutes, firstStart = null, captionsOnly = false } = options
  // Captions before the marked start belong to no speech.
  const usable = firstStart != null ? snippets.filter((s) => s.start + s.duration >= firstStart - 2) : snippets
  const baseline = usable.length > 0 ? suggestSpeechSegments(usable, speeches) : null

  if (!baseline) {
    return {
      segments: scheduleSpeechSegments(speeches, firstStart ?? 0, prepMinutes),
      source: "schedule",
      notes: `${unavailable || "Not enough captions to read the round"}, so speeches are laid out by their rule lengths${firstStart != null ? " from your start point" : ""} with prep time between them.`,
    }
  }
  const captionNotes = "Placed from pauses in the captions and each speech's rule length."
  if (captionsOnly) return { segments: baseline, source: "captions", notes: captionNotes }

  const keys = baseline.map((s) => s.key)
  try {
    const res = await fetch(options.endpoint ?? "/api/reason-ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system: YOUTUBE_SPEECH_TIMESTAMPS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildYouTubeSpeechTimestampsUserPrompt({
              formatName,
              prepMinutes,
              speeches: baseline.map((s) => ({ key: s.key, expectedSeconds: s.expectedSeconds })),
              blocks: buildSpokenBlocks(usable),
              baseline,
              firstStart,
            }),
          },
        ],
        maxTokens: MAX_TOKENS,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
    if (!res.ok) throw new Error(json.error || `AI request failed (${res.status}).`)
    const parsed = parseYouTubeSpeechTimestampsResponse(json.text ?? "", keys)
    if (!parsed) throw new Error("The AI reply couldn't be read.")
    return {
      segments: baseline.map((s, i) => ({ ...s, start: parsed.segments[i].start, end: parsed.segments[i].end })),
      source: "ai",
      notes: parsed.notes || "Placed by AI from the captions.",
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { segments: baseline, source: "captions", notes: `${captionNotes} (AI unavailable: ${reason})` }
  }
}
