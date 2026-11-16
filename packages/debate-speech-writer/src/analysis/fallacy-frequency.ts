/**
 * @fileoverview Fallacy frequency across many speeches — the "fallacy
 * frequency" stat named in IDEAS.md (Analytics Dashboard for Debaters).
 *
 * Derived on read from speech text the user already saved (for example
 * word-count rounds, which sync to the account), so nothing new is
 * persisted: the numbers always match the current heuristic in
 * `detectFallacies`, and deleting a round removes it from the stat.
 *
 * Like the per-speech hints, these are counts of phrasing worth a second
 * look, not a verdict on the debater.
 *
 * @module debate-speech-writer/analysis/fallacy-frequency
 */

import { countFallaciesByKind, detectFallacies, type FallacyFinding, type FallacyKind } from "./detect-fallacies";

/** One speech to scan. `label` names it in `speechesWithHints` (e.g. "Round 3 · AC"). */
export interface FallacyFrequencySpeech {
  label: string;
  text: string;
}

export interface FallacyFrequency {
  /** Speeches with any non-blank text. */
  speechesScanned: number;
  /** Words across the scanned speeches (whitespace-separated). */
  wordsScanned: number;
  /** Total findings across every scanned speech. */
  totalHints: number;
  /** Findings per kind; every kind is present, with 0 when absent. */
  byKind: Record<FallacyKind, number>;
  /** Findings per 1,000 words, rounded to one decimal; 0 when no words. */
  per1000Words: number;
  /** The kind with the most findings (ties broken by `byKind` order); null when there are none. */
  mostCommon: FallacyKind | null;
  /** Speeches with at least one finding, most findings first (ties keep input order). */
  speechesWithHints: Array<{ label: string; hints: number }>;
}

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
};

/**
 * Aggregates `detectFallacies` over `speeches`. Blank or non-string text is
 * skipped (not counted as scanned), so an empty input gives all zeros.
 */
export function buildFallacyFrequency(speeches: readonly FallacyFrequencySpeech[]): FallacyFrequency {
  const findings: FallacyFinding[] = [];
  const withHints: Array<{ label: string; hints: number; order: number }> = [];
  let speechesScanned = 0;
  let wordsScanned = 0;

  speeches.forEach((speech, order) => {
    if (typeof speech?.text !== "string" || speech.text.trim() === "") return;
    speechesScanned += 1;
    wordsScanned += countWords(speech.text);
    const found = detectFallacies(speech.text);
    findings.push(...found);
    if (found.length > 0) withHints.push({ label: speech.label, hints: found.length, order });
  });

  const byKind = countFallaciesByKind(findings);
  const totalHints = findings.length;
  let mostCommon: FallacyKind | null = null;
  for (const kind of Object.keys(byKind) as FallacyKind[]) {
    if (byKind[kind] > 0 && (mostCommon === null || byKind[kind] > byKind[mostCommon])) mostCommon = kind;
  }

  return {
    speechesScanned,
    wordsScanned,
    totalHints,
    byKind,
    per1000Words: wordsScanned === 0 ? 0 : Math.round((totalHints / wordsScanned) * 10_000) / 10,
    mostCommon,
    speechesWithHints: withHints
      .sort((a, b) => b.hints - a.hints || a.order - b.order)
      .map(({ label, hints }) => ({ label, hints })),
  };
}
