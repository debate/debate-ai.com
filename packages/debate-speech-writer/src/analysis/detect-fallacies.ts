/**
 * @fileoverview Heuristic detector for common informal fallacies (ad hominem,
 * straw man, false dichotomy) in argument text.
 *
 * Pure and offline: it flags *phrasing patterns* so a coach or the AI flaw
 * finder has a starting point. A match is a prompt to look closer, never a
 * verdict, and it critiques the argument, not the debater.
 *
 * @module debate-speech-writer/analysis/detect-fallacies
 */

export type FallacyKind = "ad-hominem" | "straw-man" | "false-dichotomy";

export interface FallacyFinding {
  kind: FallacyKind;
  /** The matched text, trimmed. */
  excerpt: string;
  /** Character offset of the match in the input. */
  index: number;
  /** Plain-language, argument-focused explanation. */
  explanation: string;
}

interface FallacyRule {
  kind: FallacyKind;
  pattern: RegExp;
  explanation: string;
}

const RULES: FallacyRule[] = [
  {
    kind: "ad-hominem",
    pattern:
      /\b(?:you(?:'re| are)|he(?:'s| is)|she(?:'s| is)|they(?:'re| are)|my opponent(?:'s| is)?)\s+(?:just\s+|simply\s+|clearly\s+)?(?:an?\s+)?(?:idiots?|stupid|liars?|ignorant|incompetent|clueless|biased|hypocrites?|fools?)\b/gi,
    explanation:
      "Attacks the person instead of answering the argument. Respond to the claim itself.",
  },
  {
    kind: "ad-hominem",
    pattern: /\bcoming from someone who\b/gi,
    explanation:
      "Dismisses a claim because of who said it. Whether the claim is true does not depend on the speaker.",
  },
  {
    kind: "straw-man",
    pattern:
      /\b(?:so\s+)?(?:you(?:'re| are)|they(?:'re| are)|my opponents?(?:'s| are| is)?)\s+(?:basically\s+|essentially\s+|really\s+)?saying\s+(?:that\s+)?(?:we should|everyone|nobody|no one|all|we must|we need to)\b/gi,
    explanation:
      "Restates the other side's position in an extreme form. Check the restatement against what was actually said.",
  },
  {
    kind: "straw-man",
    pattern: /\bwhat (?:they|my opponents?) (?:really|actually) (?:want|mean)\b/gi,
    explanation:
      "Attributes a position the other side did not state. Quote their words instead.",
  },
  {
    kind: "false-dichotomy",
    pattern: /\beither\b[^.?!]{1,120}?\bor\b[^.?!]{0,120}/gi,
    explanation:
      "Presents two options as the only ones. Check whether a middle or third option exists.",
  },
  {
    kind: "false-dichotomy",
    pattern: /\b(?:the only (?:two )?(?:options?|choices?|alternatives?)|there (?:are|is) (?:only )?(?:two|no other) (?:options?|choices?|ways?|alternatives?))\b/gi,
    explanation:
      "Claims the options are limited without showing why. Look for alternatives.",
  },
];

const ALL_KINDS: readonly FallacyKind[] = ["ad-hominem", "straw-man", "false-dichotomy"];

/**
 * Scans `text` for fallacy-like phrasing. Findings come back in text order;
 * overlapping matches of the same kind are collapsed to the first.
 *
 * @param text Argument text, a speech excerpt or a card.
 * @param kinds Restrict to these kinds; defaults to all.
 */
export function detectFallacies(
  text: string,
  kinds: readonly FallacyKind[] = ALL_KINDS,
): FallacyFinding[] {
  if (typeof text !== "string" || text.trim() === "") return [];
  const wanted = new Set(kinds);
  const found: FallacyFinding[] = [];
  for (const rule of RULES) {
    if (!wanted.has(rule.kind)) continue;
    for (const match of text.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      const end = index + match[0].length;
      const overlaps = found.some(
        (f) => f.kind === rule.kind && index < f.index + f.excerpt.length && end > f.index,
      );
      if (overlaps) continue;
      found.push({
        kind: rule.kind,
        excerpt: match[0].trim(),
        index,
        explanation: rule.explanation,
      });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

/** Counts findings per kind; every kind is present, with 0 when absent. */
export function countFallaciesByKind(
  findings: readonly FallacyFinding[],
): Record<FallacyKind, number> {
  const counts: Record<FallacyKind, number> = {
    "ad-hominem": 0,
    "straw-man": 0,
    "false-dichotomy": 0,
  };
  for (const f of findings) counts[f.kind] += 1;
  return counts;
}
