/**
 * @fileoverview The five-category speech rubric used to grade a debater's
 * speech from the round sidebar (`dialogs/SpeechGradeDialog.tsx`). Each
 * category asks a different question — organized? researched? explained?
 * answered the opponent? delivered clearly? — and is scored 1–5 on its own,
 * for 25 points per speech. Pure data and helpers, no React.
 *
 * Grades persist on the round as `Round.speechGrades`, keyed by speech name.
 *
 * @module round/speech-rubric
 */

/** The five rubric dimensions, in display order. */
export const RUBRIC_CATEGORY_IDS = ["organization", "evidence", "analysis", "clash", "presentation"] as const

export type RubricCategoryId = (typeof RUBRIC_CATEGORY_IDS)[number]

/** One score per category, each an integer 1–5. */
export type RubricScores = Record<RubricCategoryId, number>

/** A saved grade for one speech. */
export interface SpeechGrade {
  scores: RubricScores
  notes?: string
  /** Epoch ms of the last edit. */
  updatedAt: number
}

export interface RubricCategory {
  id: RubricCategoryId
  title: string
  /** Short radar spoke label. */
  short: string
  question: string
  grades: string
  excludes: string
  tip: string
  five: string
  three: string
  example5: string
  example3: string
}

export const SCORE_MIN = 1
export const SCORE_MAX = 5
export const DEFAULT_SCORE = 3
export const MAX_TOTAL = RUBRIC_CATEGORY_IDS.length * SCORE_MAX

export const SCORE_LABELS: Record<number, string> = {
  1: "Deficient",
  2: "Weak",
  3: "Competent",
  4: "Strong",
  5: "Exceptional",
}

export const RUBRIC_CATEGORIES: readonly RubricCategory[] = [
  {
    id: "organization",
    title: "Organization",
    short: "Organization",
    question: "Could the judge easily follow and flow the speech?",
    grades: "Roadmap, signposting, argument order, transitions, time allocation, and conclusion.",
    excludes: "Whether the arguments are correct or well-supported.",
    tip: "Grades arrangement and navigability—not the truth or quality of the arguments.",
    five: "Every argument has a clear label; responses appear where expected; transitions show how sections connect; the conclusion identifies the decisive issues.",
    three: "The speech has recognizable sections but occasionally jumps between arguments, combines unrelated responses, or ends without clearly crystallizing the round.",
    example5: "“I’ll begin with framework, answer their two contentions, and then extend our privacy contention. On framework, there are two responses…” The speaker follows that roadmap, numbers each response, and ends with two voting issues.",
    example3: "“First, let’s discuss privacy. Actually, before that, I need to answer their economic argument…” The material is understandable, but the order is inconsistent and difficult to flow.",
  },
  {
    id: "evidence",
    title: "Evidence Quality",
    short: "Evidence",
    question: "How strong and responsibly used was the research?",
    grades: "Source credibility, relevance, recency, specificity, citation completeness, and accurate representation.",
    excludes: "How thoroughly the speaker explains the evidence’s reasoning.",
    tip: "Grades the research itself and its responsible use—not the warrant the speaker builds from it.",
    five: "Uses credible and directly relevant sources, gives sufficient attribution, accurately represents findings, and compares evidence quality when sources conflict.",
    three: "Uses relevant evidence, but citations may lack dates or qualifications; some evidence is generic, dated, or only loosely connected to the claim.",
    example5: "“The 2025 Department of Energy grid assessment finds that regional storage capacity reduces peak-hour shortages. Their source discusses generation generally, while ours specifically measures shortage frequency.”",
    example3: "“A university study says renewable energy makes the electrical grid more reliable.” The source may be legitimate, but the speaker gives little context or specific application.",
  },
  {
    id: "analysis",
    title: "Argument Analysis",
    short: "Analysis",
    question: "Did the speaker explain why the argument is true and important?",
    grades: "Claims, warrants, causal reasoning, internal links, impact analysis, and framework application.",
    excludes: "The source’s credibility and direct responses to the opponent.",
    tip: "Grades the logical chain from claim to warrant to impact—not the citation quality or clash.",
    five: "Builds a complete claim–warrant–impact chain, explains each causal step, addresses important qualifications, and connects the impact to the ballot.",
    three: "Presents a plausible claim with some explanation, but assumes one or more links or gives only generic impact analysis.",
    example5: "“Encryption backdoors create a reusable vulnerability. Because the same access mechanism exists across millions of devices, one stolen credential can scale beyond its intended investigation. That makes the risk systemic rather than isolated.”",
    example3: "“Encryption backdoors are dangerous because hackers could exploit them, threatening privacy.” The mechanism, probability, and scale remain underdeveloped.",
  },
  {
    id: "clash",
    title: "Clash & Strategy",
    short: "Clash",
    question: "Did the speaker engage the actual debate and identify what decides it?",
    grades: "Refutation, responsiveness, concessions, evidence comparison, weighing, strategic collapse, and voting issues.",
    excludes: "General organization and vocal presentation.",
    tip: "Grades interaction and decision-making: what the speaker answers, compares, prioritizes, and collapses to.",
    five: "Answers the opponent’s strongest material, explains how responses interact, compares competing impacts, and narrows the round to the most decisive path.",
    three: "Responds to several arguments but misses important warrants, treats arguments independently, or extends too much material without prioritization.",
    example5: "“Even if their policy produces some short-term growth, prefer our recession impact: their evidence describes a possible 1% gain over ten years, while ours identifies an immediate contraction. We outweigh on probability and timeframe.”",
    example3: "“Their economic argument is wrong. Extend our recession evidence and our privacy contention.” The speaker responds and extends offense but does not compare or prioritize it.",
  },
  {
    id: "presentation",
    title: "Presentation Clarity",
    short: "Presentation",
    question: "How clearly and effectively did the speaker communicate the material?",
    grades: "Comprehensibility, pace, volume, articulation, fluency, emphasis, confidence, audience adaptation, and professionalism.",
    excludes: "Argument content, source quality, and strategic choices.",
    tip: "Grades whether the judge can receive the speech clearly—not whether its substantive claims are persuasive.",
    five: "Consistently understandable; uses pace and emphasis to distinguish claims, evidence, and voting issues; sounds confident without sacrificing clarity.",
    three: "Generally understandable but sometimes rushed, monotone, hesitant, overly dependent on notes, or unclear during dense sections.",
    example5: "The speaker slows down for tags and voting issues, clearly distinguishes quotations from analysis, varies emphasis, and remains understandable throughout.",
    example3: "The speaker is audible and mostly clear but reads in a uniform tone, rushes through evidence, and provides few verbal cues showing which arguments matter most.",
  },
]

/** Every category at the neutral "Competent" score. */
export function defaultScores(): RubricScores {
  return Object.fromEntries(RUBRIC_CATEGORY_IDS.map((id) => [id, DEFAULT_SCORE])) as RubricScores
}

/** Clamp to an integer 1–5; anything non-numeric becomes the default. */
export function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SCORE
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(n)))
}

/**
 * Repairs scores read from storage or a synced round: missing or invalid
 * categories fall back to the default so the dialog never renders `NaN`.
 */
export function normalizeScores(raw: Partial<Record<string, unknown>> | null | undefined): RubricScores {
  const scores = defaultScores()
  if (!raw) return scores
  for (const id of RUBRIC_CATEGORY_IDS) {
    if (id in raw) scores[id] = clampScore(raw[id])
  }
  return scores
}

/** Sum of the five scores, 5–25. */
export function totalScore(scores: RubricScores): number {
  return RUBRIC_CATEGORY_IDS.reduce((sum, id) => sum + scores[id], 0)
}

/** Label for a total out of 25. */
export function totalLabel(total: number): string {
  if (total >= 23) return "Exceptional"
  if (total >= 19) return "Strong"
  if (total >= 14) return "Competent"
  if (total >= 9) return "Weak"
  return "Deficient"
}

/** One radar spoke per category; `score` is 1–5. */
export interface RadarPoint {
  id: RubricCategoryId
  label: string
  score: number
}

export function radarPoints(scores: RubricScores): RadarPoint[] {
  return RUBRIC_CATEGORIES.map((c) => ({ id: c.id, label: c.short, score: scores[c.id] }))
}

/** Plain-text scorecard for the clipboard. */
export function scorecardText(speechName: string, scores: RubricScores, notes?: string): string {
  const total = totalScore(scores)
  const lines = [
    `Debate Speech Rubric — ${speechName}`,
    `Total: ${total}/${MAX_TOTAL} — ${totalLabel(total)}`,
    "",
    ...RUBRIC_CATEGORIES.map((c) => `${c.title}: ${scores[c.id]}/5 — ${SCORE_LABELS[scores[c.id]]}`),
  ]
  const trimmed = notes?.trim()
  if (trimmed) lines.push("", `Judge notes: ${trimmed}`)
  return lines.join("\n")
}
