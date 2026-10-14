/**
 * @fileoverview "Select YouTube Start" in the speech timer menu: asks the AI
 * where each speech of a recorded round (cross-examinations included) starts
 * and stops on the video, from the video's caption timestamps.
 *
 * The caller has already merged the captions into spoken blocks split at
 * silences and placed the speeches by length alone (`debate-timer`'s
 * `suggestSpeechSegments`). The model gets those blocks with a few words from
 * each, the format's speech order and rule lengths, and the length-only
 * guess, and corrects the guess using what is said: "I'll start the 1NC",
 * "cross-ex", "taking prep", the judge's "time".
 *
 * Pure prompt-building and parsing only; the network call lives with the
 * caller (`debate-round`'s `round/youtube-speech-client.ts`).
 *
 * @module prompts/youtube-speech-timestamps
 */

/** One stretch of talking on the video. */
export type TimestampSpokenBlock = {
  /** Seconds from the start of the video. */
  start: number;
  end: number;
  text: string;
};

/** One speech in the format's order. */
export type TimestampSpeech = {
  /** Unique key, e.g. `"1AC"` or `"CX after 1AC"`. */
  key: string;
  /** Rule length in seconds. */
  expectedSeconds: number;
};

/** A speech placed on the video. */
export type TimestampSegment = {
  key: string;
  start: number;
  end: number;
};

export type YouTubeSpeechTimestampsInput = {
  /** Format name, e.g. `"Policy"`. */
  formatName: string;
  /** Each team's prep time in minutes. */
  prepMinutes: number;
  speeches: TimestampSpeech[];
  blocks: TimestampSpokenBlock[];
  /** The length-only placement to improve on, one per speech. */
  baseline?: TimestampSegment[];
  /** Where the user marked the first speech as starting, if they did. */
  firstStart?: number | null;
};

export type YouTubeSpeechTimestampsResult = {
  segments: TimestampSegment[];
  /** One or two sentences on what the placement was based on. */
  notes: string;
};

/** Most blocks sent; long videos are merged down to this many first. */
export const MAX_TIMESTAMP_BLOCKS = 160;
/** Words kept from each end of a block's text. */
const BLOCK_HEAD_WORDS = 14;
const BLOCK_TAIL_WORDS = 8;

export const YOUTUBE_SPEECH_TIMESTAMPS_SYSTEM_PROMPT = `You place the speeches of a recorded competitive debate round on its video timeline.

You are given the format's speeches in order with their rule lengths, the stretches of talking on the video (from caption timestamps; gaps between them are silence), and a first guess placed by length alone.

How rounds sound:
- Speeches and cross-examinations come in the listed order. Each runs close to its rule length, rarely more than 20 seconds over, sometimes shorter.
- Prep time is mostly quiet or murmured, and falls between speeches. Each team has the stated prep time for the whole round.
- A speech often opens with a roadmap or an announcement ("I'll be reading...", "two off", "time starts on my first word"). Cross-examination is question and answer. Judges or timekeepers may say "time" or "you have 30 seconds".
- Talk before the first speech (introductions, coin flip) and after the last (the decision) belongs to no speech.

Return JSON only, with no prose around it:
{"segments":[{"key":"<speech key>","start":<seconds>,"end":<seconds>}, ...],"notes":"<one or two sentences on what you relied on and how sure you are>"}

Give exactly one segment per listed speech, in the listed order, with start < end and each start at or after the previous end. Use whole seconds. When the captions give no clear cue, keep the first guess.`;

function clip(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= BLOCK_HEAD_WORDS + BLOCK_TAIL_WORDS) return words.join(" ");
  return `${words.slice(0, BLOCK_HEAD_WORDS).join(" ")} … ${words.slice(-BLOCK_TAIL_WORDS).join(" ")}`;
}

/** Merge the closest neighbours until at most `max` blocks remain. */
export function condenseBlocks(blocks: TimestampSpokenBlock[], max = MAX_TIMESTAMP_BLOCKS): TimestampSpokenBlock[] {
  const out = blocks.map((b) => ({ ...b }));
  while (out.length > max) {
    let best = 1;
    let bestGap = Infinity;
    for (let i = 1; i < out.length; i++) {
      const gap = out[i].start - out[i - 1].end;
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    const [next] = out.splice(best, 1);
    const prev = out[best - 1];
    prev.end = Math.max(prev.end, next.end);
    prev.text = `${prev.text} ${next.text}`;
  }
  return out;
}

const secs = (n: number) => Math.round(n);

export function buildYouTubeSpeechTimestampsUserPrompt(input: YouTubeSpeechTimestampsInput): string {
  const speeches = input.speeches
    .map((s, i) => `${i + 1}. ${s.key} — ${Math.round(s.expectedSeconds / 6) / 10} min`)
    .join("\n");
  const blocks = condenseBlocks(input.blocks)
    .map((b) => `[${secs(b.start)}–${secs(b.end)}] ${clip(b.text)}`)
    .join("\n");
  const baseline = (input.baseline ?? []).map((s) => `${s.key}: ${secs(s.start)}–${secs(s.end)}`).join("\n");
  return [
    `Format: ${input.formatName}. Prep time: ${input.prepMinutes} min per team.`,
    input.firstStart != null ? `The user marked the first speech as starting at ${secs(input.firstStart)}s.` : "",
    `Speeches in order:\n${speeches}`,
    `Talking on the video (seconds, start–end, words):\n${blocks}`,
    baseline ? `First guess by length alone:\n${baseline}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function validate(value: unknown, keys: string[]): YouTubeSpeechTimestampsResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { segments?: unknown }).segments;
  if (!Array.isArray(raw)) return null;
  const byKey = new Map<string, TimestampSegment>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { key, start, end } = item as Record<string, unknown>;
    if (typeof key !== "string" || typeof start !== "number" || typeof end !== "number") continue;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) continue;
    if (!byKey.has(key)) byKey.set(key, { key, start, end });
  }
  // Every speech must be placed, in order, without overlaps.
  const segments: TimestampSegment[] = [];
  for (const key of keys) {
    const segment = byKey.get(key);
    if (!segment) return null;
    const previous = segments[segments.length - 1];
    if (previous && segment.start < previous.end - 1) return null;
    segments.push(segment);
  }
  const notes = (value as { notes?: unknown }).notes;
  return { segments, notes: typeof notes === "string" ? notes.trim() : "" };
}

/**
 * Tolerantly parses the model reply (plain JSON, else the first `{...}`
 * block). `null` unless every key in `keys` is placed, in order.
 */
export function parseYouTubeSpeechTimestampsResponse(raw: string, keys: string[]): YouTubeSpeechTimestampsResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return validate(JSON.parse(trimmed), keys);
  } catch {
    // Fall through to extraction.
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return validate(JSON.parse(match[0]), keys);
  } catch {
    return null;
  }
}
