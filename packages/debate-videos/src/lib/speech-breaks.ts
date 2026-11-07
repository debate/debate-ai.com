/**
 * @fileoverview The quiet breaks between a round's speeches, and when to skip one.
 *
 * A recorded round spends a lot of its length on nothing: prep time, the next
 * speaker walking up, the timekeeper setting a phone. The watch page's
 * "Skip breaks" checkbox jumps over those stretches so playback goes speech
 * to speech.
 *
 * A break is the stretch between one timed speech ending and the next one
 * starting. Where the speech detection gave the speech an end
 * (`endSeconds`), that is the end. Otherwise the captions say it: the
 * speech ends with its last caption before the next speech starts, and
 * the silence after that is the break. A gap shorter than
 * {@link MIN_BREAK_SECONDS} is someone breathing, not a break, and the
 * stretch before the first speech and after the last (an intro, the
 * decision) is never skipped.
 * @module lib/speech-breaks
 */

import type { RoundSpeech } from "./round-speeches";

/** A quiet stretch between two speeches, in seconds into the video. */
export interface SpeechBreak {
  start: number;
  end: number;
}

/** A caption cue, as `/api/transcript` returns them. */
interface TimedCue {
  start: number;
  duration: number;
}

/** Gaps shorter than this between speeches are left alone. */
export const MIN_BREAK_SECONDS = 10;

/** Land this long before the next speech, so its first words aren't cut off. */
export const BREAK_LEAD_IN_SECONDS = 1;

/**
 * The breaks between a round's timed speeches.
 *
 * @param speeches - The round's speeches; untimed ones and non-speech
 *   sections (the decision) are ignored.
 * @param cues - The video's caption cues, used where a speech has no end.
 */
export function speechBreaks(
  speeches: RoundSpeech[],
  cues: TimedCue[] | null | undefined,
  minSeconds: number = MIN_BREAK_SECONDS,
): SpeechBreak[] {
  const timed = speeches
    .filter((speech) => speech.isSpeech && speech.startSeconds !== null)
    .sort((a, b) => (a.startSeconds as number) - (b.startSeconds as number));
  const captions = (cues ?? []).slice().sort((a, b) => a.start - b.start);

  const breaks: SpeechBreak[] = [];
  for (let index = 0; index + 1 < timed.length; index++) {
    const start = timed[index].startSeconds as number;
    const next = timed[index + 1].startSeconds as number;
    if (next <= start) continue;

    let end: number | null = null;
    const own = timed[index].endSeconds;
    if (own != null && own > start && own < next) {
      end = own;
    } else {
      // The speech ends with the last caption spoken before the next one starts.
      let lastSpoken: number | null = null;
      for (const cue of captions) {
        if (cue.start < start) continue;
        if (cue.start >= next) break;
        lastSpoken = Math.max(lastSpoken ?? 0, Math.min(cue.start + Math.max(cue.duration, 0), next));
      }
      end = lastSpoken;
    }

    if (end !== null && next - end >= minSeconds) breaks.push({ start: end, end: next });
  }
  return breaks;
}

/**
 * Where to jump when playback has just run into a break, or `null` to keep playing.
 *
 * Only playback running forward into the start of a break skips it: a reader
 * who seeks into the middle of one (the previous position was nowhere near)
 * meant to be there and is left alone.
 *
 * @param previous - The position reported before this one.
 * @param current - The position just reported.
 */
export function breakSkipTarget(breaks: SpeechBreak[], previous: number, current: number): number | null {
  const step = current - previous;
  // Normal playback reports every fraction of a second; even at 2x a step stays small.
  if (step < 0 || step > 5) return null;
  for (const gap of breaks) {
    const target = Math.max(gap.start, gap.end - BREAK_LEAD_IN_SECONDS);
    if (current >= gap.start && current < target && previous < gap.start + 1.5) return target;
  }
  return null;
}
