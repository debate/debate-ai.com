import { beforeEach, describe, expect, it } from "vitest";
import { buildJudgeDecisionAiInputFromStores } from "../src/round/judge-decision-from-stores";
import { saveFlowSummary } from "../src/state/flowSummaries";
import type { FlowRowSummary } from "../src/flow/flow-transcript-summary";
import { saveJudgeParadigmSelection } from "debate-speech-writer/src/state/judgeParadigmSelections";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";

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

const ROWS: FlowRowSummary[] = [
  {
    rowIndex: 0,
    isHeading: false,
    argument: "Warming is real.",
    originSpeech: "1AC",
    entries: [{ speech: "1AC", content: "Warming is real." }],
    lastSpeech: "1AC",
    isUnanswered: true,
  },
  {
    rowIndex: 1,
    isHeading: true,
    argument: "Contention 1",
    originSpeech: "1AC",
    entries: [{ speech: "1AC", content: "Contention 1" }],
    lastSpeech: "1AC",
    isUnanswered: false,
  },
];

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildJudgeDecisionAiInputFromStores", () => {
  it("returns null when neither store has a saved record for the round", () => {
    expect(buildJudgeDecisionAiInputFromStores("round-1", ["Aff", "Neg"])).toBeNull();
  });

  it("returns null when only the flow summary is saved", () => {
    saveFlowSummary({ roundId: "round-1", summaries: ROWS });
    expect(buildJudgeDecisionAiInputFromStores("round-1", ["Aff", "Neg"])).toBeNull();
  });

  it("returns null when only the judge paradigm is saved", () => {
    saveJudgeParadigmSelection({ roundId: "round-1", paradigm: judgeParadigms.flow });
    expect(buildJudgeDecisionAiInputFromStores("round-1", ["Aff", "Neg"])).toBeNull();
  });

  it("composes both stores into a request when both are saved", () => {
    saveFlowSummary({ roundId: "round-1", summaries: ROWS });
    saveJudgeParadigmSelection({ roundId: "round-1", paradigm: judgeParadigms.flow });

    const input = buildJudgeDecisionAiInputFromStores("round-1", ["Aff", "Neg"]);

    expect(input).not.toBeNull();
    expect(input?.paradigm).toEqual(judgeParadigms.flow);
    expect(input?.sideLabels).toEqual(["Aff", "Neg"]);
    expect(input?.flowSummaryText).toContain("Warming is real.");
  });

  it("excludes heading rows from the composed flow summary text", () => {
    saveFlowSummary({ roundId: "round-1", summaries: ROWS });
    saveJudgeParadigmSelection({ roundId: "round-1", paradigm: judgeParadigms.flow });

    const input = buildJudgeDecisionAiInputFromStores("round-1", ["Aff", "Neg"]);

    expect(input?.flowSummaryText).not.toContain("Contention 1");
  });
});
