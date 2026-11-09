/**
 * @fileoverview The short decision a round shows once it is revealed.
 *
 * A round has a decision when either its winner (`affWin`) or the judges'
 * decision text is recorded — a win/loss alone is enough for the
 * "Reveal decision" button. Once revealed, the decision reads as just who
 * won and the ballot count, e.g. "Aff won 2-1", rather than the stored
 * text, which often repeats the side ("3-0 Aff").
 *
 * @module lib/decision-summary
 */

/** Whether a round has any result worth a "Reveal decision" button. */
export function hasDecision(affWin: unknown, judgeDecision: unknown): boolean {
  return typeof affWin === "boolean" || (typeof judgeDecision === "string" && judgeDecision.trim() !== "");
}

/** The ballot count in a decision text ("3-0 Aff" -> "3-0"), else null. */
export function ballotCount(judgeDecision: string | null | undefined): string | null {
  const match = judgeDecision?.match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
  return match ? `${match[1]}-${match[2]}` : null;
}

/**
 * The revealed decision: "<winner> won <ballots>", where the winner is
 * `winnerLabel` (defaults to "Aff" / "Neg"). With no recorded winner it falls
 * back to the stored decision text; with neither, null.
 */
export function decisionSummary(
  affWin: unknown,
  judgeDecision: string | null | undefined,
  winnerLabel?: { aff?: string; neg?: string },
): string | null {
  const text = typeof judgeDecision === "string" ? judgeDecision.trim() : "";
  if (typeof affWin !== "boolean") return text || null;
  const winner = affWin ? (winnerLabel?.aff ?? "Aff") : (winnerLabel?.neg ?? "Neg");
  const ballots = ballotCount(text);
  return ballots ? `${winner} won ${ballots}` : `${winner} won`;
}
