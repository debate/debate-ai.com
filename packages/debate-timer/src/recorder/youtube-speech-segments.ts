/**
 * @fileoverview Placing a format's speeches on a recorded round's YouTube
 * video — the pure half of the speech menu's "Select YouTube Start".
 *
 * A recorded round is talking broken up by quiet stretches: prep time, the
 * judge shuffling flows, the next debater walking up. The video's caption
 * timestamps show where words are and where they aren't, so the captions are
 * merged into spoken blocks split at silences, and a dynamic program assigns
 * every speech in the format (cross-examinations included) a contiguous run of
 * blocks whose length is close to that speech's rule time. Speeches may run
 * short; they rarely run long, so going over costs more than coming in under.
 * Talk between speeches (a prep-time question, the judge asking for a doc) can
 * be skipped at a small cost, which is how prep time is allowed for.
 *
 * Works the same on a YouTube video's captions and on captions of an audio
 * file such as the round's joined MP3. Also parses YouTube links and
 * `h:mm:ss` timestamps, and keeps each speech's chosen clip (from either
 * source) in localStorage beside its recording.
 */

import type { TimerSpeech } from "../types";

/** One timed caption line, as `/api/transcript` returns it. */
export interface CaptionSnippet {
    text: string
    /** Offset from the start of the video, in seconds. */
    start: number
    /** How long the line stays on screen, in seconds. */
    duration: number
}

/** A stretch of continuous talking, merged from consecutive captions. */
export interface SpokenBlock {
    start: number
    end: number
    /** The block's caption text, joined. */
    text: string
}

/** One speech of the format placed on the video. */
export interface SpeechSegment {
    /** Key the clip is saved under: the speech name, or e.g. `"CX after 1AC"`. */
    key: string
    /** The format's speech name, e.g. `"1AC"` or `"CX"`. */
    name: string
    start: number
    end: number
    /** The rule length of the speech, in seconds. */
    expectedSeconds: number
}

/**
 * What a speech clip plays from: a YouTube video, or an audio file by URL —
 * e.g. the round's joined MP3 of every recorded speech.
 */
export type SpeechMediaSource =
    | { kind: "youtube"; videoId: string }
    | { kind: "audio"; url: string }

/** A speech's chosen stretch of a video or audio file. */
export interface SpeechMediaClip {
    source: SpeechMediaSource
    /** The video's title or the file's name, for display. */
    title?: string
    start: number
    end: number
    savedAt: string
}

/** Whether two sources are the same video or file. */
export function sameMediaSource(a: SpeechMediaSource | null | undefined, b: SpeechMediaSource | null | undefined): boolean {
    if (!a || !b || a.kind !== b.kind) return false
    return a.kind === "youtube" ? a.videoId === (b as typeof a).videoId : a.url === (b as typeof a).url
}

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Parse `"1:02:03"`, `"62:03"`, `"75"` or `"1h2m3s"` into seconds; `null` when unreadable. */
export function parseTimestamp(input: string): number | null {
    const value = input.trim().toLowerCase()
    if (!value) return null
    const units = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(value)
    if (units && (units[1] || units[2] || units[3])) {
        return Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0)
    }
    const parts = value.split(":")
    if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
    return parts.reduce((total, part) => total * 60 + Number(part), 0)
}

/** Format seconds as `m:ss`, or `h:mm:ss` past an hour. */
export function formatTimestamp(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = (s % 60).toString().padStart(2, "0")
    return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`
}

/**
 * The video id and optional `t=` start of a YouTube link, or of a bare
 * 11-character id. Handles `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/` and
 * `/live/` links. `null` when the input names no video.
 */
export function parseYouTubeInput(input: string): { videoId: string; start: number | null } | null {
    const value = input.trim()
    if (VIDEO_ID_RE.test(value)) return { videoId: value, start: null }
    let url: URL
    try {
        url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    } catch {
        return null
    }
    const host = url.hostname.replace(/^(www|m|music)\./, "")
    let id: string | null = null
    if (host === "youtu.be") {
        id = url.pathname.split("/")[1] ?? null
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        id = url.searchParams.get("v")
        if (!id) {
            const match = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)
            id = match?.[1] ?? null
        }
    }
    if (!id || !VIDEO_ID_RE.test(id)) return null
    const t = url.searchParams.get("t") ?? url.searchParams.get("start")
    return { videoId: id, start: t ? parseTimestamp(t) : null }
}

/**
 * Merge captions into spoken blocks, splitting wherever the quiet between two
 * captions is at least `minGapSeconds`.
 */
export function buildSpokenBlocks(snippets: CaptionSnippet[], minGapSeconds = 3): SpokenBlock[] {
    const sorted = snippets
        .filter((s) => Number.isFinite(s.start) && s.text.trim())
        .slice()
        .sort((a, b) => a.start - b.start)
    const blocks: SpokenBlock[] = []
    for (const snippet of sorted) {
        const end = snippet.start + Math.max(0, snippet.duration)
        const last = blocks[blocks.length - 1]
        if (last && snippet.start - last.end < minGapSeconds) {
            last.end = Math.max(last.end, end)
            last.text += ` ${snippet.text.trim()}`
        } else {
            blocks.push({ start: snippet.start, end, text: snippet.text.trim() })
        }
    }
    return blocks
}

/** The most blocks the dynamic program works over; the gap grows until it fits. */
const MAX_BLOCKS = 300

/** Blocks for segmentation: the smallest silence threshold that leaves at most {@link MAX_BLOCKS}. */
function blocksForSegmentation(snippets: CaptionSnippet[]): SpokenBlock[] {
    let gap = 3
    let blocks = buildSpokenBlocks(snippets, gap)
    while (blocks.length > MAX_BLOCKS && gap < 120) {
        gap *= 1.5
        blocks = buildSpokenBlocks(snippets, gap)
    }
    return blocks
}

/** Grace a speaker gets past the clock before it counts as running over. */
const OVERTIME_GRACE_SECONDS = 20

/** How far a run of blocks is from a speech's rule length. */
function lengthCost(duration: number, expected: number): number {
    if (expected <= 0) return 0
    const over = Math.max(0, duration - expected - OVERTIME_GRACE_SECONDS) / expected
    const under = Math.max(0, expected - duration) / expected
    return 6 * over * over + 1.5 * under * under
}

/** Cost of starting a speech after this much quiet — a real speech change usually follows a pause. */
function boundaryCost(silenceBefore: number): number {
    return silenceBefore >= 10 ? 0 : 0.15 * (1 - silenceBefore / 10)
}

/** Cost per minute of talking left out between two speeches (prep-time chatter). */
const SKIP_COST_PER_MINUTE = 0.25
/** Cost per minute of talking left out before the first speech or after the last. */
const EDGE_SKIP_COST_PER_MINUTE = 0.02

/** Key a speech's clip is saved under — cross-examinations are named after the speech they follow. */
export function speechSegmentKeys(speeches: Pick<TimerSpeech, "name">[]): string[] {
    const keys: string[] = []
    let previous = ""
    const counts = new Map<string, number>()
    for (const speech of speeches) {
        let key = speech.name
        if (/^g?cx$/i.test(speech.name) && previous) key = `${speech.name} after ${previous}`
        const seen = counts.get(key) ?? 0
        counts.set(key, seen + 1)
        if (seen > 0) key = `${key} (${seen + 1})`
        keys.push(key)
        if (!/^g?cx$/i.test(speech.name)) previous = speech.name
    }
    return keys
}

/**
 * Lay the speeches end to end from `start`, separated by an even share of
 * both teams' prep time — the fallback when a video has no captions.
 */
export function scheduleSpeechSegments(
    speeches: Pick<TimerSpeech, "name" | "time">[],
    start: number,
    prepMinutes = 0,
): SpeechSegment[] {
    const keys = speechSegmentKeys(speeches)
    const gaps = Math.max(1, speeches.length - 1)
    const gapSeconds = Math.min(90, (prepMinutes * 2 * 60) / gaps)
    let cursor = start
    return speeches.map((speech, i) => {
        const expectedSeconds = speech.time * 60
        const segment = { key: keys[i], name: speech.name, start: cursor, end: cursor + expectedSeconds, expectedSeconds }
        cursor = segment.end + gapSeconds
        return segment
    })
}

/**
 * Place every speech on the video from its captions. Each speech gets a
 * contiguous run of spoken blocks, in order, so that run lengths sit close to
 * the rule times, speeches tend to begin after a pause, and as little talk as
 * possible is left between them. `null` when there are fewer spoken blocks
 * than speeches.
 *
 * `speeches[i].time` is in minutes, as in `debateStyles`.
 */
export function suggestSpeechSegments(
    snippets: CaptionSnippet[],
    speeches: Pick<TimerSpeech, "name" | "time">[],
): SpeechSegment[] | null {
    const blocks = blocksForSegmentation(snippets)
    const n = speeches.length
    const m = blocks.length
    if (n === 0 || m < n) return null

    // prefixTalk[k] = seconds of talking in blocks[0..k-1]
    const prefixTalk = [0]
    for (const block of blocks) prefixTalk.push(prefixTalk[prefixTalk.length - 1] + (block.end - block.start))
    const talkBetween = (from: number, to: number) => prefixTalk[to] - prefixTalk[from]
    const silenceBefore = (k: number) => (k === 0 ? Infinity : blocks[k].start - blocks[k - 1].end)

    // best[i][k]: cheapest placement of the first i speeches with the last one ending at block k-1.
    const INF = Number.POSITIVE_INFINITY
    const best: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(INF))
    const from: Array<Array<[number, number]>> = Array.from({ length: n + 1 }, () => new Array(m + 1))
    for (let k = 0; k <= m; k++) best[0][k] = (talkBetween(0, k) / 60) * EDGE_SKIP_COST_PER_MINUTE

    for (let i = 1; i <= n; i++) {
        const expected = speeches[i - 1].time * 60
        for (let end = i; end <= m; end++) {
            // Speech i covers blocks [a, end-1]; the previous speech ended at block p-1 (p <= a).
            for (let a = end - 1; a >= i - 1; a--) {
                const duration = blocks[end - 1].end - blocks[a].start
                // A run more than twice the rule length can only get worse as it grows.
                if (expected > 0 && duration > expected * 2 + 120) break
                const own = lengthCost(duration, expected) + (i > 1 ? boundaryCost(silenceBefore(a)) : 0)
                // The first speech's lead-in is already priced into best[0], so it starts right at `a`.
                const lowest = i === 1 ? a : i - 1
                for (let p = a; p >= lowest; p--) {
                    const prev = best[i - 1][p]
                    if (prev === INF) continue
                    const skipped = (talkBetween(p, a) / 60) * SKIP_COST_PER_MINUTE
                    const total = prev + skipped + own
                    if (total < best[i][end]) {
                        best[i][end] = total
                        from[i][end] = [a, p]
                    }
                    // Leaving out more than ~8 minutes of talk is never a better answer.
                    if (skipped > 2) break
                }
            }
        }
    }

    let bestEnd = -1
    let bestCost = INF
    for (let end = n; end <= m; end++) {
        const total = best[n][end] + (talkBetween(end, m) / 60) * EDGE_SKIP_COST_PER_MINUTE
        if (total < bestCost) {
            bestCost = total
            bestEnd = end
        }
    }
    if (bestEnd < 0) return null

    const keys = speechSegmentKeys(speeches)
    const segments: SpeechSegment[] = []
    let end = bestEnd
    for (let i = n; i >= 1; i--) {
        const [a, p] = from[i][end]
        segments.unshift({
            key: keys[i - 1],
            name: speeches[i - 1].name,
            start: blocks[a].start,
            end: blocks[end - 1].end,
            expectedSeconds: speeches[i - 1].time * 60,
        })
        end = p
    }
    return segments
}

const CLIP_STORAGE_PREFIX = "debate-youtube-speech-"

function isSource(value: unknown): value is SpeechMediaSource {
    if (!value || typeof value !== "object") return false
    const source = value as Partial<{ kind: string; videoId: string; url: string }>
    if (source.kind === "youtube") return typeof source.videoId === "string" && VIDEO_ID_RE.test(source.videoId)
    return source.kind === "audio" && typeof source.url === "string" && source.url.length > 0
}

/** The clip saved for a speech, or `null`. */
export function loadSpeechMediaClip(speechKey: string): SpeechMediaClip | null {
    try {
        const raw = localStorage.getItem(CLIP_STORAGE_PREFIX + speechKey)
        if (!raw) return null
        const clip = JSON.parse(raw) as SpeechMediaClip
        return isSource(clip.source) && Number.isFinite(clip.start) && Number.isFinite(clip.end) ? clip : null
    } catch {
        return null
    }
}

/** Save (or with `null`, clear) a speech's clip; announces `debate-speech-clip-saved`. */
export function saveSpeechMediaClip(speechKey: string, clip: Omit<SpeechMediaClip, "savedAt"> | null): void {
    try {
        if (!clip) localStorage.removeItem(CLIP_STORAGE_PREFIX + speechKey)
        else localStorage.setItem(CLIP_STORAGE_PREFIX + speechKey, JSON.stringify({ ...clip, savedAt: new Date().toISOString() }))
        window.dispatchEvent(new CustomEvent("debate-speech-clip-saved", { detail: { speechKey } }))
    } catch {
        // Storage full or blocked — the clip simply isn't remembered.
    }
}
