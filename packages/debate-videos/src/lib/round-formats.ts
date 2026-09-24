/**
 * @fileoverview Every round's speeches, whether or not anyone wrote them up.
 *
 * `buildRoundSpeeches` reads a round's speeches out of its documents, which
 * only a minority of rounds have. The rest are still rounds: an LD round is a
 * 1AC, a CX, a 1NC and so on whether or not a summary says so. This module
 * fills that gap with the standard speech order of the video's format, so
 * every round gets the per-speech tabs, the timeline and the Outcomes
 * simulator — the tabs start empty and untimed, the reader marks where each
 * speech starts (see `state/speechStartMarks.ts`), and the captions under
 * each mark become that speech's transcript.
 *
 * Keys are built exactly as `buildRoundSpeeches` builds them (`1AC#1`,
 * `CX#2`), so marks and saved simulations keep lining up if a summary is
 * written for the round later.
 * @module lib/round-formats
 */

import { buildRoundSpeeches, identifySpeech, type RoundSpeech } from "./round-speeches";
import type { VideoDocument } from "./video-documents";

/** One speech of a format: its code, the heading shown, and an optional tab label. */
interface FormatSlot {
  code: string;
  heading: string;
  label?: string;
}

const POLICY: FormatSlot[] = [
  { code: "1AC", heading: "1AC — First Affirmative Constructive" },
  { code: "CX", heading: "Cross-examination of the 1AC", label: "CX · 1AC" },
  { code: "1NC", heading: "1NC — First Negative Constructive" },
  { code: "CX", heading: "Cross-examination of the 1NC", label: "CX · 1NC" },
  { code: "2AC", heading: "2AC — Second Affirmative Constructive" },
  { code: "CX", heading: "Cross-examination of the 2AC", label: "CX · 2AC" },
  { code: "2NC", heading: "2NC — Second Negative Constructive" },
  { code: "CX", heading: "Cross-examination of the 2NC", label: "CX · 2NC" },
  { code: "1NR", heading: "1NR — First Negative Rebuttal" },
  { code: "1AR", heading: "1AR — First Affirmative Rebuttal" },
  { code: "2NR", heading: "2NR — Second Negative Rebuttal" },
  { code: "2AR", heading: "2AR — Second Affirmative Rebuttal" },
];

const LINCOLN_DOUGLAS: FormatSlot[] = [
  { code: "1AC", heading: "1AC — Affirmative Constructive" },
  { code: "CX", heading: "Cross-examination of the 1AC", label: "CX · 1AC" },
  { code: "1NC", heading: "1NC — Negative Constructive" },
  { code: "CX", heading: "Cross-examination of the 1NC", label: "CX · 1NC" },
  { code: "1AR", heading: "1AR — First Affirmative Rebuttal" },
  { code: "NR", heading: "NR — Negative Rebuttal" },
  { code: "2AR", heading: "2AR — Second Affirmative Rebuttal" },
];

const PUBLIC_FORUM: FormatSlot[] = [
  { code: "Pro Constructive", heading: "Pro Constructive" },
  { code: "Con Constructive", heading: "Con Constructive" },
  { code: "Crossfire", heading: "First Crossfire", label: "Crossfire 1" },
  { code: "Pro Rebuttal", heading: "Pro Rebuttal" },
  { code: "Con Rebuttal", heading: "Con Rebuttal" },
  { code: "Crossfire", heading: "Second Crossfire", label: "Crossfire 2" },
  { code: "Pro Summary", heading: "Pro Summary" },
  { code: "Con Summary", heading: "Con Summary" },
  { code: "Grand Crossfire", heading: "Grand Crossfire" },
  { code: "Pro Final Focus", heading: "Pro Final Focus" },
  { code: "Con Final Focus", heading: "Con Final Focus" },
];

/** Speech order per numeric `DebateStyle`: 1 Policy, 2 PF, 3 LD, 4 College (policy). */
const FORMATS: Record<number, FormatSlot[]> = {
  1: POLICY,
  2: PUBLIC_FORUM,
  3: LINCOLN_DOUGLAS,
  4: POLICY,
};

/**
 * The standard speeches of a format, untimed and unwritten.
 *
 * @param style - The video's numeric debate style.
 * @returns The speeches, or an empty list for a style that is not a round format.
 */
export function standardRoundSpeeches(style: number | undefined): RoundSpeech[] {
  const slots = style === undefined ? undefined : FORMATS[style];
  if (!slots) return [];
  const occurrences = new Map<string, number>();
  return slots.map((slot) => {
    const identity = identifySpeech(slot.code);
    const occurrence = (occurrences.get(identity.base) ?? 0) + 1;
    occurrences.set(identity.base, occurrence);
    return {
      key: `${identity.base}#${occurrence}`,
      label: slot.label ?? identity.label,
      heading: slot.heading,
      side: identity.side,
      isSpeech: true,
      startSeconds: null,
      parts: {},
    };
  });
}

/**
 * The speeches a watch page shows for a video.
 *
 *   1. A summary or analysis that goes speech by speech — the richest view.
 *   2. For a round, a transcript document split by speech, when it names at
 *      least two.
 *   3. For a round, the format's standard speech order.
 *
 * A lecture (a non-numeric style) with no per-speech documents gets none.
 *
 * @param documents - The video's documents.
 * @param style - The video's `DebateStyle`, or a lecture category string.
 */
export function resolveRoundSpeeches(
  documents: VideoDocument[],
  style: number | string | null | undefined,
): RoundSpeech[] {
  const written = buildRoundSpeeches(documents);
  if (written.length > 0) return written;
  if (typeof style !== "number") return [];
  const transcribed = buildRoundSpeeches(documents, { requireSummary: false });
  if (transcribed.length > 0) return transcribed;
  return standardRoundSpeeches(style);
}
