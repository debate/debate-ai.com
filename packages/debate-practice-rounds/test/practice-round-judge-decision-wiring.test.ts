import { beforeEach, describe, expect, it } from "vitest";
import { buildPracticeRoundJudgeDecisionInput } from "../src/round/practice-round-judge-decision-wiring";
import { saveFlowSummary } from "../src/state/flowSummaries";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";
import type { FlowRowSummary } from "debate-round/src/flow/flow-transcript-summary";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const ROW: FlowRowSummary = {
  rowIndex: 0,
  isHeading: false,
  argument: "Solvency deficit.",
  originSpeech: "1AC",
  entries: [{ speech: "1AC", content: "Solvency deficit." }],
  lastSpeech: "1AC",
  isUnanswered: true,
};

const SIDE_NAMES = { primary: "Primary", secondary: "Secondary" };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildPracticeRoundJudgeDecisionInput", () => {
  it("reports the flow summary missing when none is saved", () => {
    const result = buildPracticeRoundJudgeDecisionInput("round-1", judgeParadigms.flow, SIDE_NAMES);
    expect(result).toEqual({ ok: false, missing: "flowSummary" });
  });

  it("treats an empty saved summary list as missing", () => {
    saveFlowSummary({ roundId: "round-1", summaries: [] });
    const result = buildPracticeRoundJudgeDecisionInput("round-1", judgeParadigms.flow, SIDE_NAMES);
    expect(result).toEqual({ ok: false, missing: "flowSummary" });
  });

  it("composes a JudgeDecisionAiInput from the round's own paradigm and the saved flow summary", () => {
    saveFlowSummary({ roundId: "round-1", summaries: [ROW] });

    const result = buildPracticeRoundJudgeDecisionInput("round-1", judgeParadigms.policymaker, SIDE_NAMES);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.input.paradigm).toEqual(judgeParadigms.policymaker);
    expect(result.input.sideNames).toEqual(SIDE_NAMES);
    expect(result.input.flowSummaryText).toContain("Solvency deficit.");
  });

  it("scopes the flow-summary lookup to the given roundId", () => {
    saveFlowSummary({ roundId: "round-2", summaries: [ROW] });
    const result = buildPracticeRoundJudgeDecisionInput("round-1", judgeParadigms.flow, SIDE_NAMES);
    expect(result).toEqual({ ok: false, missing: "flowSummary" });
  });

  it("uses a custom (non-built-in) paradigm as-is", () => {
    saveFlowSummary({ roundId: "round-1", summaries: [ROW] });
    const customParadigm = {
      id: "custom" as const,
      name: "Judge Smith",
      description: "Votes on framework first, dislikes speed.",
      votingPriorities: [],
      speedTolerance: "medium" as const,
      jargonTolerance: "medium" as const,
      instructions: "Votes on framework first, dislikes speed.",
    };

    const result = buildPracticeRoundJudgeDecisionInput("round-1", customParadigm, SIDE_NAMES);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.input.paradigm).toEqual(customParadigm);
  });
});
