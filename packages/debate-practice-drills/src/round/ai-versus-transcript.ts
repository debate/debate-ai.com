/**
 * @fileoverview Builds a plain-text transcript of an "Online Debate Versus
 * AI" round — the "a transcript export/download action for a completed
 * round" follow-up named under idea #3 ("Online Debate Versus AI") in
 * TODO.md's Product Feature Ideas list. Pure string-building only, so it's
 * directly Vitest-testable; `AiVersusRoundPanel.tsx` wraps the result in a
 * `Blob` and triggers the actual browser download (the same anchor+Blob
 * pattern `dialogs/FileExportDialog.tsx` already uses), mirroring this
 * repo's existing pure-builder/thin-caller split (e.g.
 * `ai-versus-speech-ai.ts` vs `ai-versus-speech-client.ts`).
 *
 * `buildAiVersusTranscriptComparison`/`buildAiVersusTranscriptComparisonText`
 * below close idea #3's other named next-step: "a side-by-side transcript
 * diff between two rounds". Speeches are zipped positionally by delivery
 * index (round `a`'s Nth submitted speech against round `b`'s Nth), the same
 * convention `practice-round-simulator.ts#buildPracticeRoundReplaySteps`
 * already relies on for a single round's own speech order, and each aligned
 * pair is word-diffed via the existing, already-Vitest-covered
 * `flow-edit-diff.ts#diffFlowEditContent` (generic over any two strings, not
 * `FlowEdit`-specific) rather than a second diff implementation.
 *
 * @module round/ai-versus-transcript
 */

import {
  debateStyleMap,
  debateStyleNames,
  debateStyles,
  type DebateStyleKey,
} from "debate-timer/src/formats/debate-format-times";
import type { AiVersusRoundRecord } from "debate-round/src/state/aiVersusRounds";
import type {
  AiVersusSide,
  PriorSpeechRecord,
} from "debate-round/src/round/ai-versus-speech-order";
import { diffFlowEditContent, type DiffSegment } from "debate-round/src/flow/flow-edit-diff";

function styleDisplayName(styleKey: DebateStyleKey): string {
  const index = debateStyleMap.indexOf(styleKey);
  return index === -1 ? styleKey : debateStyleNames[index]!;
}

function sideDisplayName(styleKey: DebateStyleKey, side: AiVersusSide): string {
  const style = debateStyles[styleKey];
  return side === "primary" ? style.primary.name : (style.secondary?.name ?? side);
}

/**
 * Renders a round's header (round id, format, the user's side) followed by
 * every delivered speech in delivery order, each labeled "You" or "AI" plus
 * its slot name. Works for a round in any state of completion — an empty or
 * partially-delivered round still renders a valid transcript, with a
 * placeholder line when no speeches have been submitted yet; the panel
 * decides whether to only offer the download once a round is complete.
 */
export function buildAiVersusTranscriptText(record: AiVersusRoundRecord): string {
  const header = [
    `Online Debate Versus AI — Round ${record.roundId}`,
    `Format: ${styleDisplayName(record.styleKey)}`,
    `Your side: ${sideDisplayName(record.styleKey, record.userSide)}`,
  ].join("\n");

  if (record.submittedSpeeches.length === 0) {
    return `${header}\n\nNo speeches have been delivered yet.\n`;
  }

  const body = record.submittedSpeeches
    .map((speech) => `${speech.speaker === "user" ? "You" : "AI"} — ${speech.name}\n${speech.text}`)
    .join("\n\n");

  return `${header}\n\n${body}\n`;
}

/**
 * A filesystem-safe filename for a round's transcript download, e.g.
 * `ai-versus-round-1-transcript.txt`. Non-alphanumeric characters in the
 * round id (spaces, slashes, etc.) collapse to single hyphens so the id can
 * be anything a user typed into the "Round ID" field.
 */
export function aiVersusTranscriptFilename(roundId: string): string {
  const safeId = roundId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `ai-versus-${safeId || "round"}-transcript.txt`;
}

/** One aligned pair of speeches from two compared rounds, by delivery index. */
export type AiVersusTranscriptComparisonRow = {
  index: number;
  a: PriorSpeechRecord | null;
  b: PriorSpeechRecord | null;
  /** Word-level diff of `a`/`b`'s text, or `null` when either side has no speech at this index. */
  diff: { left: DiffSegment[]; right: DiffSegment[] } | null;
};

export type AiVersusTranscriptComparison = {
  a: AiVersusRoundRecord;
  b: AiVersusRoundRecord;
  rows: AiVersusTranscriptComparisonRow[];
};

/**
 * Builds a side-by-side comparison of two persisted AI-versus rounds' delivered
 * speeches, zipped positionally (`a`'s Nth submitted speech against `b`'s Nth) —
 * no assumption that the two rounds share a format or side, so this works for
 * two attempts at the same round id resubmitted under a different one, two
 * different formats, or anything else. A row whose two speeches are both
 * present is word-diffed via `diffFlowEditContent`; a row where only one round
 * has a speech at that index is included undiffed, so a shorter round's
 * missing tail still shows up as its own rows rather than being dropped.
 */
export function buildAiVersusTranscriptComparison(
  a: AiVersusRoundRecord,
  b: AiVersusRoundRecord,
): AiVersusTranscriptComparison {
  const length = Math.max(a.submittedSpeeches.length, b.submittedSpeeches.length);
  const rows: AiVersusTranscriptComparisonRow[] = [];
  for (let index = 0; index < length; index++) {
    const speechA = a.submittedSpeeches[index] ?? null;
    const speechB = b.submittedSpeeches[index] ?? null;
    rows.push({
      index,
      a: speechA,
      b: speechB,
      diff: speechA && speechB ? diffFlowEditContent(speechA.text, speechB.text) : null,
    });
  }
  return { a, b, rows };
}

function renderComparisonSpeech(speech: PriorSpeechRecord | null): string {
  if (!speech) return "  (not delivered in this round)";
  return `  ${speech.speaker === "user" ? "You" : "AI"} — ${speech.name}\n  ${speech.text}`;
}

/**
 * Renders an `AiVersusTranscriptComparison` as a downloadable plain-text
 * document — one section per aligned speech position, each showing both
 * rounds' speeches stacked underneath their own round label. Diff detail
 * (which words each side added/removed relative to the other) is visual-only
 * — carried by `AiVersusTranscriptComparisonRow.diff` for the panel's own
 * highlighted rendering — since a removed/added word marking has no faithful
 * plain-text form here; the full, undiffed text of both speeches is still
 * included so nothing is lost in the download.
 */
export function buildAiVersusTranscriptComparisonText(comparison: AiVersusTranscriptComparison): string {
  const { a, b, rows } = comparison;
  const labelA = `Round ${a.roundId}`;
  const labelB = `Round ${b.roundId}`;
  const sections = rows.map(
    (row) =>
      `### Speech ${row.index + 1}\n${labelA}:\n${renderComparisonSpeech(row.a)}\n\n${labelB}:\n${renderComparisonSpeech(row.b)}`,
  );
  return `AI-Versus Transcript Comparison — ${labelA} vs. ${labelB}\n\n${sections.join("\n\n")}`;
}

/**
 * A filesystem-safe filename for a comparison download, e.g.
 * `ai-versus-comparison-round-1-vs-round-2.txt`, mirroring
 * `aiVersusTranscriptFilename`'s exact sanitization rule.
 */
export function aiVersusTranscriptComparisonFilename(a: AiVersusRoundRecord, b: AiVersusRoundRecord): string {
  const safeId = `${a.roundId}-vs-${b.roundId}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `ai-versus-comparison-${safeId || "rounds"}.txt`;
}
