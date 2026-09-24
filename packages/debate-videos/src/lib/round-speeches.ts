/**
 * @fileoverview A round, speech by speech, assembled from its documents.
 *
 * A round's documents each tell the same story in the same order: the typed-up
 * transcript has a `## 1AC` section, the AI summary has a `## 1AC` section, the
 * written analysis has one too. Read one document at a time, the reader has to
 * find the 1NC three times over. This module lines the documents up instead —
 * one {@link RoundSpeech} per speech, holding that speech's summary, analysis
 * and transcript side by side — which is what lets the watch page give every
 * speech its own tab and a segment on the timeline under the player.
 *
 * Sections are matched on the speech they name, not on their exact wording:
 * `## 1AC — Michigan (0:00)` in the transcript and `## 1AC` in the summary are
 * the same speech. Cross-examinations all read "CX", so repeats are matched by
 * the order they come in — the second CX of the transcript is the second CX of
 * the summary. A heading that names no speech (`## Decision`) is matched on its
 * own text and still gets a tab.
 * @module lib/round-speeches
 */

import {
  orderDocuments,
  parseDocumentSections,
  type VideoDocument,
  type VideoDocumentKind,
} from "./video-documents";

/** Which side gave a speech — drives its colour on the tabs and timeline. */
export type SpeechSide = "aff" | "neg" | "cx" | "neutral";

/** One speech of a round, with every document's take on it. */
export interface RoundSpeech {
  /** Stable across the documents: the speech's code plus its occurrence, e.g. `CX#2`. */
  key: string;
  /** Short tab label — `1AC`, `CX · 1NC`, `Pro Summary`, `Decision`. */
  label: string;
  /** The first document's heading for it, timecode removed. */
  heading: string;
  side: SpeechSide;
  /** Whether the heading named a speech, rather than e.g. an overview. */
  isSpeech: boolean;
  /** Second the speech starts at, from the first document that gave one. */
  startSeconds: number | null;
  /** This speech's markdown in each document that covers it. */
  parts: Partial<Record<VideoDocumentKind, string>>;
}

/** What a heading says about the speech it opens. */
interface SpeechIdentity {
  /** Matching key before the occurrence count is added. */
  base: string;
  label: string;
  side: SpeechSide;
  isSpeech: boolean;
  /** For a cross-ex, the speech it questions, when the heading says. */
  target?: string;
}

const LD_POLICY_CODE = /^([12]?[AN][CR])\b/i;
const SPELLED_OUT = /^(first|second)\s+(affirmative|negative)\s+(constructive|rebuttal)\b/i;
const PF_SPEECH = /^(pro|con)\s+(constructive|rebuttal|summary|final\s+focus)\b/i;
const CROSS_EX = /^(?:cx|cross[\s-]?ex(?:amination)?)\b/i;
const GRAND_CROSSFIRE = /^grand\s+cross(?:fire)?\b/i;
const CROSSFIRE = /^cross(?:fire)?\b/i;

function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** The side an LD/Policy speech code belongs to. */
function sideOfCode(code: string): SpeechSide {
  return /A[CR]$/.test(code) ? "aff" : "neg";
}

/**
 * Reads the speech a section heading names.
 *
 * @param heading - Heading text with the timecode already removed.
 */
export function identifySpeech(heading: string): SpeechIdentity {
  const text = heading.trim();

  const spelled = text.match(SPELLED_OUT);
  if (spelled) {
    const code = `${spelled[1].toLowerCase() === "first" ? 1 : 2}${spelled[2][0]}${spelled[3][0]}`.toUpperCase();
    return { base: code, label: code, side: sideOfCode(code), isSpeech: true };
  }

  const code = text.match(LD_POLICY_CODE);
  if (code) {
    const upper = code[1].toUpperCase();
    return { base: upper, label: upper, side: sideOfCode(upper), isSpeech: true };
  }

  const pf = text.match(PF_SPEECH);
  if (pf) {
    const label = titleCase(`${pf[1]} ${pf[2].replace(/\s+/g, " ")}`);
    return { base: label.toUpperCase(), label, side: pf[1].toLowerCase() === "pro" ? "aff" : "neg", isSpeech: true };
  }

  if (GRAND_CROSSFIRE.test(text)) {
    return { base: "GRAND CROSSFIRE", label: "Grand Crossfire", side: "cx", isSpeech: true };
  }

  const crossEx = text.match(CROSS_EX);
  if (crossEx || CROSSFIRE.test(text)) {
    // "CX of the 1AC", "Cross-Examination of the First Affirmative Constructive".
    const rest = crossEx ? text.slice(crossEx[0].length) : "";
    let target = rest.match(/\b([12]?[AN][CR])\b/i)?.[1].toUpperCase();
    if (!target) {
      const spelledTarget = rest.match(/\b(?:first|second)\s+(?:affirmative|negative)\s+(?:constructive|rebuttal)\b/i);
      if (spelledTarget) target = identifySpeech(spelledTarget[0]).label;
    }
    let label = crossEx ? "CX" : "Crossfire";
    if (target) {
      const num = target[0];
      const side = target[1];
      const nextNum = num === "1" ? "2" : "1";
      label = `${nextNum}${side}X`;
    }
    return { base: "CX", label, side: "cx", isSpeech: true, target };
  }

  // Not a speech — an overview, the decision, the judge's RFD. Split on the
  // same separators a speech heading uses so `Decision — 2-1 Aff` and
  // `Decision` still line up.
  const lead = text.split(/\s+[—–-]\s+|:\s/)[0].trim() || text;
  return { base: lead.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), label: lead, side: "neutral", isSpeech: false };
}

/**
 * Lines a video's documents up speech by speech.
 *
 * Only a video whose summary or analysis covers at least two speeches gets
 * the per-speech view. A bare transcript is already served by the speeches
 * tab, and a summary written as one block of prose is left to its own tab —
 * a timed transcript beside it is not enough, since the point of the view is
 * the summary of each speech.
 *
 * Speeches keep document order. The transcript is read first, since it is
 * the most complete; a speech another document adds is slotted in just
 * before the next already-placed speech that document goes on to mention —
 * or at the end when it mentions none, so a summary's `## 2NR` lands after
 * a transcript's 1AR rather than before it.
 *
 * @param documents - The video's documents, in any order.
 * @returns The speeches, or an empty list when there is nothing to split.
 */
export function buildRoundSpeeches(documents: VideoDocument[]): RoundSpeech[] {
  const ordered = orderDocuments(documents);
  if (!ordered.some((document) => document.kind === "summary" || document.kind === "analysis")) {
    return [];
  }

  const speeches: RoundSpeech[] = [];
  const targets = new Map<string, string>();

  for (const document of ordered) {
    const occurrences = new Map<string, number>();
    const sections = parseDocumentSections(document.body, { depth: 2 }).map((section) => {
      const identity: SpeechIdentity = section.heading
        ? identifySpeech(section.heading)
        : { base: "overview", label: "Overview", side: "neutral", isSpeech: false };
      const occurrence = (occurrences.get(identity.base) ?? 0) + 1;
      occurrences.set(identity.base, occurrence);
      return { section, identity, key: `${identity.base}#${occurrence}` };
    });

    sections.forEach(({ section, identity, key }, position) => {
      let index = speeches.findIndex((speech) => speech.key === key);
      if (index === -1) {
        const later = new Set(sections.slice(position + 1).map((entry) => entry.key));
        const before = speeches.findIndex((speech) => later.has(speech.key));
        index = before === -1 ? speeches.length : before;
        speeches.splice(index, 0, {
          key,
          label: identity.label,
          heading: section.heading || identity.label,
          side: identity.side,
          isSpeech: identity.isSpeech,
          startSeconds: null,
          parts: {},
        });
      }

      const speech = speeches[index];
      if (section.body) speech.parts[document.kind] = section.body;
      if (speech.startSeconds === null) speech.startSeconds = section.startSeconds;
      if (identity.target && !targets.has(key)) targets.set(key, identity.target);
    });
  }

  const summarized = speeches.filter(
    (speech) => speech.isSpeech && (speech.parts.summary || speech.parts.analysis),
  );
  if (summarized.length < 2) return [];

  // Repeated labels need telling apart: a cross-ex names the speech it
  // questions when any document said, and is numbered otherwise.
  const labelCounts = new Map<string, number>();
  for (const speech of speeches) labelCounts.set(speech.label, (labelCounts.get(speech.label) ?? 0) + 1);
  for (const speech of speeches) {
    const target = targets.get(speech.key);
    if (target && speech.side !== "cx") speech.label = `${speech.label} · ${target}`;
    else if ((labelCounts.get(speech.label) ?? 0) > 1) speech.label = `${speech.label} ${speech.key.split("#")[1]}`;
  }

  return speeches;
}

/**
 * The speech playing at a moment: the one with the latest start at or before
 * it. Speeches without a start are skipped rather than ending the search, so
 * one untimed speech does not blank the marker for the rest of the round.
 *
 * @returns An index into `speeches`, or -1 before the first timed speech.
 */
export function playingSpeechIndex(speeches: RoundSpeech[], seconds: number): number {
  let found = -1;
  let foundStart = -1;
  speeches.forEach((speech, index) => {
    const start = speech.startSeconds;
    if (start !== null && start <= seconds && start >= foundStart) {
      found = index;
      foundStart = start;
    }
  });
  return found;
}
