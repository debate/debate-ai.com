/**
 * @fileoverview AI "split into sections" for a speech's full transcript
 * (`recorder/SpeechTranscriptDialog.tsx`). The transcript's timed caption
 * words (`recorder/speech-captions.ts`) are grouped into short numbered
 * lines, the model names where each section starts, and those line numbers
 * are mapped back to caption words so a section heading can seek the audio.
 *
 * The prompt building and parsing are pure; {@link requestTranscriptSections}
 * posts to the existing `/api/reason-ai` Anthropic proxy with the same
 * `{ system, messages, maxTokens }` contract the practice-drill AI calls use.
 * Results are cached per speech in localStorage and dropped when the
 * transcript changes.
 *
 * @module recorder/transcript-sections
 */

import type { CaptionWord } from "./speech-captions"

/** A run of caption words shown as one line of the transcript. */
export interface TranscriptLine {
  /** Index of the line's first word in the caption words. */
  wordIndex: number
  /** Seconds into the recording where the line starts. */
  start: number
  text: string
}

/** A titled section of the transcript, starting at a caption word. */
export interface TranscriptSection {
  title: string
  /** Index of the section's first word in the caption words. */
  wordIndex: number
  /** Seconds into the recording where the section starts. */
  start: number
}

/** Longest line, in words, when the transcript has no sentence breaks. */
const LINE_WORDS = 20
/** The reply is a short JSON list of headings. */
const MAX_TOKENS = 1024

/**
 * Groups caption words into lines, breaking after sentence punctuation or
 * every {@link LINE_WORDS} words (browser transcripts are often unpunctuated).
 */
export function buildTranscriptLines(words: readonly CaptionWord[], maxWords = LINE_WORDS): TranscriptLine[] {
  const lines: TranscriptLine[] = []
  let first = 0
  for (let i = 0; i < words.length; i++) {
    const count = i - first + 1
    if (i === words.length - 1 || count >= maxWords || /[.!?]["')\]]?$/.test(words[i].word)) {
      lines.push({
        wordIndex: first,
        start: words[first].start,
        text: words.slice(first, i + 1).map((w) => w.word).join(" "),
      })
      first = i + 1
    }
  }
  return lines
}

/** Formats seconds as m:ss. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}

export const TRANSCRIPT_SECTIONS_SYSTEM_PROMPT = [
  "You split transcripts of competitive debate speeches (policy, LD, public forum) into sections.",
  "Sections follow the speech's structure: e.g. the framework, each contention or advantage, each off-case position, each response to the other side, the overview, voters.",
  "You get the transcript as numbered lines. Reply with only a JSON array, no prose:",
  '[{"title": "Short heading", "line": 0}, ...]',
  "`line` is the number of the line where the section starts. The first section starts at line 0.",
  "Use 2 to 12 sections in order, each title at most 6 words, in the speaker's own terms (e.g. \"Contention 1: Economy\").",
].join("\n")

/** The user prompt: the speech name, then each line as `[n] (m:ss) text`. */
export function buildTranscriptSectionsPrompt(speechName: string, lines: readonly TranscriptLine[]): string {
  const body = lines.map((line, i) => `[${i}] (${formatClock(line.start)}) ${line.text}`).join("\n")
  return `Speech: ${speechName}\n\nTranscript:\n${body}`
}

/**
 * Parses the model's reply into sections mapped onto caption words. Ignores
 * malformed entries, out-of-range lines and duplicates, sorts by position,
 * and makes the first section start at the top. Returns null when nothing
 * usable is left.
 */
export function parseTranscriptSections(
  text: string,
  lines: readonly TranscriptLine[],
): TranscriptSection[] | null {
  const open = text.indexOf("[")
  const close = text.lastIndexOf("]")
  if (open === -1 || close <= open || lines.length === 0) return null
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(open, close + 1))
  } catch {
    return null
  }
  if (!Array.isArray(raw)) return null

  const byLine = new Map<number, string>()
  for (const item of raw) {
    const title = typeof item?.title === "string" ? item.title.trim() : ""
    const line = Number(item?.line)
    if (!title || !Number.isInteger(line) || line < 0 || line >= lines.length) continue
    if (!byLine.has(line)) byLine.set(line, title)
  }
  if (byLine.size === 0) return null

  const sorted = [...byLine.entries()].sort((a, b) => a[0] - b[0])
  sorted[0][0] = 0
  return sorted.map(([line, title]) => ({
    title,
    wordIndex: lines[line].wordIndex,
    start: lines[line].start,
  }))
}

/**
 * Asks `/api/reason-ai` (or `endpoint`) to split the transcript into
 * sections. Throws an `Error` with the proxy's message (e.g. "Sign in to use
 * AI features.") when the request fails or the reply can't be parsed.
 */
export async function requestTranscriptSections(
  speechName: string,
  words: readonly CaptionWord[],
  endpoint = "/api/reason-ai",
): Promise<TranscriptSection[]> {
  const lines = buildTranscriptLines(words)
  if (lines.length === 0) throw new Error("There's no transcript to split yet.")

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: TRANSCRIPT_SECTIONS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildTranscriptSectionsPrompt(speechName, lines) }],
      maxTokens: MAX_TOKENS,
    }),
  })

  if (!res.ok) {
    let detail = ""
    try {
      const payload = (await res.json()) as { error?: string }
      detail = payload?.error ?? ""
    } catch {
      // Body wasn't JSON.
    }
    throw new Error(detail || `AI sections request failed (${res.status}).`)
  }

  const json = (await res.json()) as { text?: string }
  const sections = parseTranscriptSections(json.text ?? "", lines)
  if (!sections) throw new Error("The AI reply couldn't be read as sections. Try again.")
  return sections
}

export function transcriptSectionsKey(speechName: string): string {
  return `debate-transcript-sections-${speechName}`
}

/** Cached sections for the speech, or null when absent or made for an older transcript. */
export function loadTranscriptSections(speechName: string, transcriptVersion: string): TranscriptSection[] | null {
  try {
    const raw = localStorage.getItem(transcriptSectionsKey(speechName))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: string; sections?: TranscriptSection[] }
    if (parsed.version !== transcriptVersion || !Array.isArray(parsed.sections)) return null
    return parsed.sections
  } catch {
    return null
  }
}

export function saveTranscriptSections(
  speechName: string,
  transcriptVersion: string,
  sections: TranscriptSection[],
): void {
  try {
    localStorage.setItem(
      transcriptSectionsKey(speechName),
      JSON.stringify({ version: transcriptVersion, sections }),
    )
  } catch {
    // Storage full or blocked — sections just won't persist.
  }
}
