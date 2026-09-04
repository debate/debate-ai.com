import { beforeEach, describe, expect, it } from "vitest";
import { buildJudgeDecisionInputFromStores } from "../src/round/judge-decision-store-wiring";
import { saveFlowSummary } from "../src/state/flowSummaries";
import { saveJudgeParadigmSelection } from "../src/state/judgeParadigmSelections";
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

const SIDE_NAMES = { primary: "Affirmative", secondary: "Negative" };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildJudgeDecisionInputFromStores", () => {
  it("reports both sources missing when neither is saved", () => {
    const result = buildJudgeDecisionInputFromStores("round-1", SIDE_NAMES);
    expect(result).toEqual({ ok: false, missing: ["flowSummary", "judgeParadigm"] });
  });

  it("reports only the flow summary missing", () => {
    saveJudgeParadigmSelection({ roundId: "round-1", paradigm: judgeParadigms.flow });
    const result = buildJudgeDecisionInputFromStores("round-1", SIDE_NAMES);
    expect(result).toEqual({ ok: false, missing: ["flowSummary"] });
  });

  it("reports only the judge paradigm missing", () => {
    saveFlowSummary({ roundId: "round-1", summaries: [ROW] });
    const result = buildJudgeDecisionInputFromStores("round-1", SIDE_NAMES);
    expect(result).toEqual({ ok: false, missing: ["judgeParadigm"] });
  });

  it("treats an empty saved summary list as missing", () => {
    saveFlowSummary({ roundId: "round-1", summaries: [] });
    saveJudgeParadigmSelection({ roundId: "round-1", paradigm: judgeParadigms.flow });
    const result = buildJudgeDecisionInputFromStores("round-1", SIDE_NAMES);
    expect(result).toEqual({ ok: false, missing: ["flowSummary"] });
  });

  it("composes a JudgeDecisionAiInput when both sources are saved", () => {
    saveFlowSummary({ roundId: "round-1", summaries: [ROW] });
    saveJudgeParadigmSelection({ roundId: "round-1", paradigm: judgeParadigms.policymaker });

    const result = buildJudgeDecisionInputFromStores("round-1", SIDE_NAMES);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.input.paradigm).toEqual(judgeParadigms.policymaker);
    expect(result.input.sideNames).toEqual(SIDE_NAMES);
    expect(result.input.flowSummaryText).toContain("Solvency deficit.");
  });

  it("scopes lookups to the given roundId", () => {
    saveFlowSummary({ roundId: "round-1", summaries: [ROW] });
    saveJudgeParadigmSelection({ roundId: "round-2", paradigm: judgeParadigms.flow });

    const result = buildJudgeDecisionInputFromStores("round-1", SIDE_NAMES);
    expect(result).toEqual({ ok: false, missing: ["judgeParadigm"] });
  });
});
