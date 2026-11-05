/**
 * @fileoverview Lines a recorded speech up with its speech doc, for the
 * "Speech doc playback" view (`recorder/SpeechDocPlaybackDialog.tsx`): which
 * card was being read at each moment of the recording, the caption line
 * being said, and an H1/H2/H3 outline of the speech to flow from.
 *
 * Nothing records which card was on screen while a speech was given, so the
 * card is estimated:
 *
 * 1. **From the transcript** — the caption words are cut into short chunks
 *    and each chunk is scored against every card's read-aloud words
 *    (tags, analytics and highlighted card text, rarer words count more).
 *    A dynamic-programming pass picks the best in-order path through the
 *    cards, so a card can be skipped but the reader never jumps backward.
 * 2. **From reading pace** — with no transcript, or one that matches too
 *    little of the doc, each card gets a slice of the speech in proportion
 *    to how many words it has to read.
 *
 * Accepts both speech doc shapes (Debate Editor HTML and a flow's markdown),
 * like `formats/speech-doc-word-stats.ts`. Pure and DOM-free so it runs in
 * the `node` test environment.
 *
 * @module recorder/speech-doc-sync
 */

import { looksLikeHtml, speechMarkdownToHtml } from "../formats/speech-doc-word-stats"
import type { CaptionCue } from "./round-recording"
import type { CaptionWord } from "./speech-captions"

/** A stretch of text with the formatting in effect where it sits. */
export interface DocRun {
  text: string
  highlight: boolean
  underline: boolean
  bold: boolean
}

/**
 * One paragraph of the speech doc. `level` is 1–3 for headings (pocket, hat,
 * block / `#`–`###`), 4 for a card tag (`.pmd-tag`, `<h4>`, `####`), and
 * null for card text, cites and analytics.
 */
export interface DocParagraph {
  level: number | null
  /** An analytic (`.pmd-analytic`): read aloud in full, like a tag. */
  analytic: boolean
  runs: DocRun[]
  text: string
}

/** A heading or card and the paragraphs under it, up to the next heading or tag. */
export interface DocSection {
  index: number
  level: number | null
  title: string
  paragraphs: DocParagraph[]
  /** Normalized, distinctive words read aloud from this section — what the transcript is matched on. */
  tokens: string[]
  /** How many words are read aloud from it — what the reading-pace estimate is weighted by. */
  readWordCount: number
}

/** Where a section starts being read, in seconds. */
export interface SectionTiming {
  section: number
  start: number
}

export type SyncMethod = "transcript" | "pace"

export interface SpeechDocSync {
  timings: SectionTiming[]
  method: SyncMethod
}

/** One bullet of the flowable outline. */
export interface OutlineItem {
  level: 1 | 2 | 3
  text: string
  /** Seconds into the recording where it is said. */
  start: number
}

// ---------------------------------------------------------------------------
// Parsing the doc

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "wbr", "col", "source"])
const BLOCK_TAGS = new Set([
  "p", "div", "li", "ul", "ol", "tr", "td", "th", "table", "section", "article",
  "h1", "h2", "h3", "h4", "h5", "h6", "br", "blockquote",
])
const CLASS_LEVELS: Record<string, number> = { "pmd-pocket": 1, "pmd-hat": 2, "pmd-block": 3, "pmd-tag": 4 }

type Frame = { tag: string; level: number | null; analytic: boolean; highlight: boolean; underline: boolean; bold: boolean }

function attr(attrs: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs)
  return match ? (match[2] ?? match[3] ?? match[4] ?? "") : ""
}

function classify(tag: string, attrs: string): Omit<Frame, "tag"> {
  const classes = attr(attrs, "class").split(/\s+/).filter(Boolean)
  const style = attr(attrs, "style").toLowerCase()
  const heading = /^h([1-4])$/.exec(tag)
  let level: number | null = heading ? Number(heading[1]) : null
  for (const name of classes) if (CLASS_LEVELS[name]) level = CLASS_LEVELS[name]
  return {
    level,
    analytic: classes.includes("pmd-analytic"),
    highlight:
      tag === "mark" ||
      (classes.includes("pmd-highlight") && attr(attrs, "data-highlight").toLowerCase() !== "none") ||
      /background(-color)?\s*:\s*(yellow|#?ffff00|lime|#?00ff00|cyan|#?00ffff)/.test(style),
    underline:
      tag === "u" || classes.includes("pmd-underline") || classes.includes("pmd-emphasis") || /text-decoration[^;]*underline/.test(style),
    bold: tag === "strong" || tag === "b",
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
}

/** Splits a speech doc (HTML or markdown) into paragraphs of formatted runs. */
export function parseSpeechDoc(content: string | null | undefined): DocParagraph[] {
  if (!content || !content.trim()) return []
  const html = looksLikeHtml(content) ? content : speechMarkdownToHtml(content)
  const paragraphs: DocParagraph[] = []
  const stack: Frame[] = []
  let current: DocParagraph | null = null
  let pendingBreak = true
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|([^<]+)/g
  let match: RegExpExecArray | null
  while ((match = token.exec(html)) !== null) {
    const [, closing, rawTag, attrs, rawText] = match
    if (rawText !== undefined) {
      const text = decodeEntities(rawText).replace(/\s+/g, " ")
      if (!text.trim() && (pendingBreak || !current)) continue
      if (pendingBreak || !current) {
        let level: number | null = null
        for (const frame of stack) if (frame.level != null) level = frame.level
        current = { level, analytic: stack.some((f) => f.analytic), runs: [], text: "" }
        paragraphs.push(current)
        pendingBreak = false
      }
      current.runs.push({
        text,
        highlight: stack.some((f) => f.highlight),
        underline: stack.some((f) => f.underline),
        bold: stack.some((f) => f.bold),
      })
      current.text += text
      continue
    }
    if (!rawTag) continue
    const tag = rawTag.toLowerCase()
    if (BLOCK_TAGS.has(tag)) pendingBreak = true
    if (closing) {
      const at = stack.map((f) => f.tag).lastIndexOf(tag)
      if (at !== -1) stack.length = at
      continue
    }
    if (VOID_TAGS.has(tag) || attrs.trim().endsWith("/")) continue
    stack.push({ tag, ...classify(tag, attrs) })
  }
  for (const p of paragraphs) {
    p.text = p.text.trim()
    if (p.runs.length) {
      p.runs[0].text = p.runs[0].text.replace(/^\s+/, "")
      const last = p.runs[p.runs.length - 1]
      last.text = last.text.replace(/\s+$/, "")
    }
  }
  return paragraphs.filter((p) => p.text)
}

// ---------------------------------------------------------------------------
// Words

const STOPWORDS = new Set(
  (
    "the a an and or but of to in on at by for with from as is are was were be been being it its this that these those " +
    "they them their we our you your he she his her i me my not no so if then than there here which who whom what when " +
    "where why how all any can could would should will shall may might must do does did has have had also just only more " +
    "most such into over under about between because while very much many some each other one two three"
  ).split(" "),
)

/** Lowercased, punctuation-free, plural-stripped form of a word; "" for a stopword or a short word. */
export function normalizeWord(word: string): string {
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
  if (w.length < 3 || STOPWORDS.has(w)) return ""
  return w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w
}

function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
}

/** The words of a paragraph a speaker reads aloud: all of a heading/tag/analytic, else the highlighted or bold ones. */
function readWords(paragraph: DocParagraph, sectionMarked: boolean): string[] {
  if (paragraph.level != null || paragraph.analytic || !sectionMarked) return words(paragraph.text)
  return paragraph.runs.filter((r) => r.highlight || r.bold).flatMap((r) => words(r.text))
}

/**
 * Groups paragraphs into sections: a new one at every heading or card tag.
 * Text before the first heading is a section of its own.
 */
export function groupDocSections(paragraphs: readonly DocParagraph[]): DocSection[] {
  const groups: DocParagraph[][] = []
  for (const p of paragraphs) {
    if (p.level != null || groups.length === 0) groups.push([p])
    else groups[groups.length - 1].push(p)
  }
  return groups.map((group, index) => {
    const head = group[0]
    const body = group.filter((p) => p.level == null && !p.analytic)
    const marked = body.some((p) => p.runs.some((r) => (r.highlight || r.bold) && /[\p{L}\p{N}]/u.test(r.text)))
    const read = group.flatMap((p) => readWords(p, marked))
    return {
      index,
      level: head.level,
      title: head.text,
      paragraphs: group,
      tokens: read.map(normalizeWord).filter(Boolean),
      readWordCount: read.length,
    }
  })
}

/** Paragraphs grouped into cards and headings, straight from the doc's content. */
export function speechDocSections(content: string | null | undefined): DocSection[] {
  return groupDocSections(parseSpeechDoc(content))
}

// ---------------------------------------------------------------------------
// Estimating when each section was read

/** Content words per transcript chunk. */
const CHUNK_TOKENS = 3
/** Score lost for moving on to a later section; keeps one stray word from switching cards. */
const JUMP_PENALTY = 0.6
/** Below this share of chunks matching their section, the transcript isn't trusted. */
const MIN_MATCHED_SHARE = 0.2

/** Each card's slice of the speech in proportion to how much it has to read. */
export function paceSectionTimings(sections: readonly DocSection[], durationSeconds: number): SectionTiming[] {
  if (sections.length === 0) return []
  const weights = sections.map((s) => Math.max(1, s.readWordCount))
  const total = weights.reduce((a, b) => a + b, 0)
  const span = Math.max(0, durationSeconds)
  let at = 0
  return sections.map((section, i) => {
    const timing = { section: section.index, start: (span * at) / total }
    at += weights[i]
    return timing
  })
}

/**
 * When each section started being read, from the timed transcript; null when
 * the transcript matches too little of the doc to be trusted.
 */
export function transcriptSectionTimings(
  sections: readonly DocSection[],
  captionWords: readonly CaptionWord[],
): SectionTiming[] | null {
  if (sections.length === 0) return null
  const timed = captionWords
    .map((w) => ({ token: normalizeWord(w.word), start: w.start }))
    .filter((w) => w.token)
  if (timed.length < CHUNK_TOKENS) return null

  const chunks: Array<{ tokens: Set<string>; start: number }> = []
  for (let i = 0; i < timed.length; i += CHUNK_TOKENS) {
    const slice = timed.slice(i, i + CHUNK_TOKENS)
    chunks.push({ tokens: new Set(slice.map((w) => w.token)), start: slice[0].start })
  }

  // Rarer words say more about which card is being read.
  const sets = sections.map((s) => new Set(s.tokens))
  const df = new Map<string, number>()
  for (const set of sets) for (const t of set) df.set(t, (df.get(t) ?? 0) + 1)
  const idf = (t: string) => Math.log(1 + sections.length / (df.get(t) ?? sections.length))
  const score = (s: number, c: number) => {
    let total = 0
    for (const t of chunks[c].tokens) if (sets[s].has(t)) total += idf(t)
    return total
  }

  const S = sections.length
  const C = chunks.length
  // best[c][s]: best score of chunks 0..c with chunk c on section s; from[c][s]: section of chunk c-1.
  const best: Float64Array[] = []
  const from: Int32Array[] = []
  for (let c = 0; c < C; c++) {
    const row = new Float64Array(S)
    const back = new Int32Array(S)
    let prefixBest = -Infinity
    let prefixArg = 0
    for (let s = 0; s < S; s++) {
      const here = score(s, c)
      if (c === 0) {
        row[s] = here
        back[s] = -1
        continue
      }
      const prev = best[c - 1]
      // Moving on from an earlier section (best of prev[0..s-1]).
      if (s > 0 && prev[s - 1] > prefixBest) {
        prefixBest = prev[s - 1]
        prefixArg = s - 1
      }
      const stay = prev[s]
      const jump = prefixBest - JUMP_PENALTY
      if (stay >= jump) {
        row[s] = stay + here
        back[s] = s
      } else {
        row[s] = jump + here
        back[s] = prefixArg
      }
    }
    best.push(row)
    from.push(back)
  }

  let end = 0
  for (let s = 1; s < S; s++) if (best[C - 1][s] > best[C - 1][end]) end = s
  const path = new Array<number>(C)
  for (let c = C - 1, s = end; c >= 0; c--) {
    path[c] = s
    s = from[c][s]
  }

  const matched = path.filter((s, c) => score(s, c) > 0).length
  if (matched / C < MIN_MATCHED_SHARE) return null

  const timings: SectionTiming[] = []
  path.forEach((s, c) => {
    if (timings.length === 0 || timings[timings.length - 1].section !== s) {
      timings.push({ section: s, start: c === 0 ? 0 : chunks[c].start })
    }
  })
  return timings
}

/** Best estimate of when each section was read: from the transcript when it matches, else from reading pace. */
export function syncSpeechDoc(
  sections: readonly DocSection[],
  captionWords: readonly CaptionWord[],
  durationSeconds: number,
): SpeechDocSync {
  const fromTranscript = transcriptSectionTimings(sections, captionWords)
  if (fromTranscript) return { timings: fromTranscript, method: "transcript" }
  return { timings: paceSectionTimings(sections, durationSeconds), method: "pace" }
}

/** The section being read at `time`: the last one started at or before it, else the first. */
export function sectionAtTime(timings: readonly SectionTiming[], time: number): number | null {
  if (timings.length === 0) return null
  let found = timings[0].section
  for (const timing of timings) {
    if (timing.start <= time) found = timing.section
    else break
  }
  return found
}

/** Moves every timing by `offset` seconds (a speech's start in the joined recording). */
export function shiftTimings(timings: readonly SectionTiming[], offset: number): SectionTiming[] {
  return timings.map((t) => ({ ...t, start: t.start + offset }))
}

// ---------------------------------------------------------------------------
// Captions

function parseVttTime(text: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(text.trim())
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number((m[4] ?? "0").padEnd(3, "0")) / 1000
}

/** Reads the cues of a WebVTT file (as written by `toWebVtt`). */
export function parseWebVtt(vtt: string | null | undefined): CaptionCue[] {
  if (!vtt) return []
  const cues: CaptionCue[] = []
  for (const block of vtt.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n")
    const at = lines.findIndex((l) => l.includes("-->"))
    if (at === -1) continue
    const [a, b] = lines[at].split("-->")
    const start = parseVttTime(a)
    const end = parseVttTime((b ?? "").trim().split(/\s+/)[0] ?? "")
    const text = lines.slice(at + 1).join(" ").trim()
    if (start == null || end == null || !text) continue
    cues.push({ start, end, text })
  }
  return cues.sort((x, y) => x.start - y.start)
}

/** The caption line around `time`: its words and which one is being said (-1 before the first). */
export function captionLineAt(
  lines: ReadonlyArray<{ wordIndex: number }>,
  captionWords: readonly CaptionWord[],
  activeWord: number,
): { line: number; words: CaptionWord[]; active: number } | null {
  if (lines.length === 0 || activeWord < 0) return null
  let line = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].wordIndex <= activeWord) line = i
    else break
  }
  const first = lines[line].wordIndex
  const last = line + 1 < lines.length ? lines[line + 1].wordIndex : captionWords.length
  return { line, words: captionWords.slice(first, last), active: activeWord - first }
}

// ---------------------------------------------------------------------------
// Outline

/** Longest outline phrase, in words; card tags are often whole sentences. */
const OUTLINE_WORDS = 12

/** A heading or tag cut down to a flowable phrase. */
export function outlinePhrase(text: string, maxWords = OUTLINE_WORDS): string {
  const all = text.trim().split(/\s+/).filter(Boolean)
  if (all.length <= maxWords) return all.join(" ")
  return `${all.slice(0, maxWords).join(" ").replace(/[,;:.-]+$/, "")}…`
}

/**
 * The flowable outline from the doc: the heading levels the doc uses become
 * H1 and H2 (the deepest ones merge into H2 when there are three), and card
 * tags are H3 under them. Only sections that have a timing are listed, in
 * the order they were read.
 */
export function docOutline(sections: readonly DocSection[], timings: readonly SectionTiming[]): OutlineItem[] {
  const headingLevels = [...new Set(sections.map((s) => s.level).filter((l): l is number => l != null && l < 4))].sort()
  const rank = (level: number | null): 1 | 2 | 3 | null => {
    if (level == null) return null
    if (level >= 4) return headingLevels.length === 0 ? 1 : headingLevels.length === 1 ? 2 : 3
    return Math.min(headingLevels.indexOf(level) + 1, 2) as 1 | 2
  }
  const items: OutlineItem[] = []
  for (const timing of timings) {
    const section = sections[timing.section]
    const level = section ? rank(section.level) : null
    if (!section || level == null) continue
    items.push({ level, text: outlinePhrase(section.title), start: timing.start })
  }
  return items
}

const SIGNPOST_H1 =
  /^(?:(?:and|now|so|okay|ok)\s+)?(?:(?:the\s+)?(?:first|second|third|fourth|fifth|next|last|final)\s+)?(?:off(?:\s*case)?|contention|advantage|disadvantage|counterplan|kritik|critique|topicality|theory|framework|the plan|plan text|value|criterion|overview|underview|voters?|on the case|case)\b/i
const SIGNPOST_H2 =
  /^(?:(?:and|now|so)\s+)?(?:first|second|third|fourth|fifth|next|also|subpoint|observation|uniqueness|link|impact|internal link|solvency|inherency|harms|turn|extend|cross apply|group)\b/i

/**
 * An outline guessed from the transcript alone, for a speech with no doc:
 * lines that open with a signpost ("contention one…", "next, the impact…")
 * become H1/H2 bullets, and every other line is an H3 under them.
 */
export function signpostOutline(lines: ReadonlyArray<{ start: number; text: string }>): OutlineItem[] {
  return lines.map((line) => {
    const text = line.text.trim()
    const level: 1 | 2 | 3 = SIGNPOST_H1.test(text) ? 1 : SIGNPOST_H2.test(text) ? 2 : 3
    return { level, text: outlinePhrase(text, level === 3 ? 10 : 8), start: line.start }
  })
}

/** Index of the outline item being said at `time`, or -1 before the first. */
export function activeOutlineIndex(items: readonly OutlineItem[], time: number): number {
  let found = -1
  items.forEach((item, i) => {
    if (item.start <= time) found = i
  })
  return found
}

// ---------------------------------------------------------------------------
// AI outline from the transcript

export const SPEECH_OUTLINE_SYSTEM_PROMPT = [
  "You turn transcripts of competitive debate speeches (policy, LD, public forum) into an outline a judge can flow.",
  "You get the transcript as numbered lines. Reply with only a JSON array, no prose:",
  '[{"level": 1, "text": "Short phrase", "line": 0}, ...]',
  "level 1 = a position or major argument (an off-case, a contention, an advantage, the framework).",
  "level 2 = a sub-point inside it (uniqueness, link, impact, a numbered response).",
  "level 3 = the claim of one piece of evidence or one analytic, as a flowable phrase.",
  "`line` is the number of the line where it is said. Keep items in order, each text at most 10 words, in the speaker's own terms.",
].join("\n")

/** The user prompt: the speech name, then each line as `[n] text`. */
export function buildSpeechOutlinePrompt(speechName: string, lines: ReadonlyArray<{ text: string }>): string {
  return `Speech: ${speechName}\n\nTranscript:\n${lines.map((line, i) => `[${i}] ${line.text}`).join("\n")}`
}

/** Parses the model's outline, mapping line numbers to times; null when nothing usable is left. */
export function parseSpeechOutline(text: string, lines: ReadonlyArray<{ start: number }>): OutlineItem[] | null {
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
  const items: Array<OutlineItem & { line: number }> = []
  for (const entry of raw) {
    const body = typeof entry?.text === "string" ? entry.text.trim() : ""
    const line = Number(entry?.line)
    const level = Number(entry?.level)
    if (!body || !Number.isInteger(line) || line < 0 || line >= lines.length) continue
    if (level !== 1 && level !== 2 && level !== 3) continue
    items.push({ level, text: outlinePhrase(body), start: lines[line].start, line })
  }
  if (items.length === 0) return null
  return items.sort((a, b) => a.line - b.line).map(({ level, text: t, start }) => ({ level, text: t, start }))
}

/**
 * Asks `/api/reason-ai` (or `endpoint`) for the outline. Throws an `Error`
 * with the proxy's message when the request fails or the reply can't be read.
 */
export async function requestSpeechOutline(
  speechName: string,
  lines: ReadonlyArray<{ start: number; text: string }>,
  endpoint = "/api/reason-ai",
): Promise<OutlineItem[]> {
  if (lines.length === 0) throw new Error("There's no transcript to outline yet.")
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: SPEECH_OUTLINE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildSpeechOutlinePrompt(speechName, lines) }],
      maxTokens: 2048,
    }),
  })
  if (!res.ok) {
    let detail = ""
    try {
      detail = ((await res.json()) as { error?: string })?.error ?? ""
    } catch {
      // Body wasn't JSON.
    }
    throw new Error(detail || `AI outline request failed (${res.status}).`)
  }
  const json = (await res.json()) as { text?: string }
  const items = parseSpeechOutline(json.text ?? "", lines)
  if (!items) throw new Error("The AI reply couldn't be read as an outline. Try again.")
  return items
}

export function speechOutlineKey(roundId: string, speechKey: string): string {
  return `debate-speech-outline-${roundId}-${speechKey}`
}

/** A cached AI outline, or null when absent or made for a different transcript. */
export function loadSpeechOutline(roundId: string, speechKey: string, version: string): OutlineItem[] | null {
  try {
    const raw = localStorage.getItem(speechOutlineKey(roundId, speechKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: string; items?: OutlineItem[] }
    return parsed.version === version && Array.isArray(parsed.items) ? parsed.items : null
  } catch {
    return null
  }
}

export function saveSpeechOutline(roundId: string, speechKey: string, version: string, items: OutlineItem[]): void {
  try {
    localStorage.setItem(speechOutlineKey(roundId, speechKey), JSON.stringify({ version, items }))
  } catch {
    // Storage full or blocked — the outline just won't persist.
  }
}
