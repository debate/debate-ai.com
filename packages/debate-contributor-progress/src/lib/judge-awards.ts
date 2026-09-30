/**
 * @fileoverview Pure logic for judge-given awards — the five badges on a
 * debater's page that can't be earned by grinding XP, only handed out by a
 * judge at a tournament: Most Improved, Best Speaker, Best Critique Debater,
 * Best Impact Calculus and Best Research.
 *
 * The rule that makes them mean something: **each judge can give each award
 * once per tournament.** A judge who hands "Best Speaker" to one debater at
 * a tournament can't give it to a second debater there — but can still give
 * "Most Improved" to someone, and can give "Best Speaker" again at the next
 * tournament. Judge and tournament names are compared case- and
 * whitespace-insensitively, so "Jane Doe" at "Glenbrooks" and
 * " jane  doe" at "glenbrooks" hold the same slot.
 *
 * `state/judgeAwards.ts` persists `JudgeAward` records; this module only
 * defines the awards and decides whether a new one is allowed.
 *
 * @module lib/judge-awards
 */

/** One of the five judge-given awards. */
export type JudgeAwardKind =
  | "most_improved"
  | "best_speaker"
  | "best_critique_debater"
  | "best_impact_calculus"
  | "best_research";

/** A judge award's display copy and badge art. */
export interface JudgeAwardDefinition {
  kind: JudgeAwardKind;
  title: string;
  description: string;
  badgeUrl: string;
}

/** Every judge award, in display order. */
export const JUDGE_AWARDS: JudgeAwardDefinition[] = [
  {
    kind: "most_improved",
    title: "Most Improved",
    description: "Came back sharper every round — a judge watched you grow over the course of a tournament.",
    badgeUrl: "https://i.imgur.com/a2IrtIm.png",
  },
  {
    kind: "best_speaker",
    title: "Best Speaker",
    description: "The clearest, most persuasive voice a judge heard all tournament — delivery that made the ballot easy to write.",
    badgeUrl: "https://i.imgur.com/olUMP6H.png",
  },
  {
    kind: "best_critique_debater",
    title: "Best Critique Debater",
    description: "Took apart the other side's assumptions, not just their arguments — critical debate a judge couldn't ignore.",
    badgeUrl: "https://i.imgur.com/eBb4kE7.png",
  },
  {
    kind: "best_impact_calculus",
    title: "Best Impact Calculus",
    description: "Told the judge exactly why your impacts outweigh — magnitude, probability and timeframe, weighed out loud.",
    badgeUrl: "https://i.imgur.com/smbX1th.png",
  },
  {
    kind: "best_research",
    title: "Best Research Award",
    description: "Evidence deeper, fresher and better cut than anything else in the room — prep a judge noticed.",
    badgeUrl: "https://i.imgur.com/NAacNjP.png",
  },
];

/** Every judge award kind, in display order. */
export const JUDGE_AWARD_KINDS: JudgeAwardKind[] = JUDGE_AWARDS.map((award) => award.kind);

/** Each award's definition, by kind. */
export const JUDGE_AWARD_BY_KIND = Object.fromEntries(JUDGE_AWARDS.map((award) => [award.kind, award])) as Record<
  JudgeAwardKind,
  JudgeAwardDefinition
>;

/** Whether a value names a known judge award. */
export function isJudgeAwardKind(value: unknown): value is JudgeAwardKind {
  return typeof value === "string" && (JUDGE_AWARD_KINDS as string[]).includes(value);
}

/** One award a judge gave one debater at one tournament. */
export interface JudgeAward {
  id: string;
  kind: JudgeAwardKind;
  /** The debater's contributor id — the `/coaching/leaderboard/{id}` page it shows on. */
  debaterId: string;
  judgeName: string;
  tournament: string;
  awardedAt: number;
}

/** What a judge fills in to give an award. */
export interface JudgeAwardInput {
  kind: JudgeAwardKind;
  debaterId: string;
  judgeName: string;
  tournament: string;
}

/** Trim, collapse internal whitespace and lowercase — the form names are compared in. */
export function normalizeAwardName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Why `validateJudgeAward` refused an award. */
export type JudgeAwardRejection = "missing-field" | "unknown-kind" | "self-award" | "already-given";

/** User-facing copy for each rejection. */
export const JUDGE_AWARD_REJECTION_MESSAGES: Record<JudgeAwardRejection, string> = {
  "missing-field": "Enter the judge's name, the tournament and the debater.",
  "unknown-kind": "Pick one of the five judge awards.",
  "self-award": "A judge can't give an award to themself.",
  "already-given": "This judge has already given that award at this tournament — each judge gives each award once per tournament.",
};

/**
 * Decide whether `input` may be added alongside `existing`. Returns `null`
 * when it's allowed, or the reason it isn't.
 */
export function validateJudgeAward(existing: readonly JudgeAward[], input: JudgeAwardInput): JudgeAwardRejection | null {
  if (!isJudgeAwardKind(input.kind)) return "unknown-kind";
  const judge = normalizeAwardName(input.judgeName);
  const tournament = normalizeAwardName(input.tournament);
  const debater = normalizeAwardName(input.debaterId);
  if (!judge || !tournament || !debater) return "missing-field";
  if (judge === debater) return "self-award";
  const taken = existing.some(
    (award) =>
      award.kind === input.kind &&
      normalizeAwardName(award.judgeName) === judge &&
      normalizeAwardName(award.tournament) === tournament,
  );
  return taken ? "already-given" : null;
}

/** Whether a value is a well-formed persisted `JudgeAward`. */
export function isJudgeAward(value: unknown): value is JudgeAward {
  if (!value || typeof value !== "object") return false;
  const award = value as Record<string, unknown>;
  return (
    typeof award.id === "string" &&
    isJudgeAwardKind(award.kind) &&
    typeof award.debaterId === "string" &&
    typeof award.judgeName === "string" &&
    typeof award.tournament === "string" &&
    typeof award.awardedAt === "number"
  );
}
