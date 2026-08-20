import { beforeEach, describe, expect, it } from "vitest";
import { saveAiVersusRound, type AiVersusRoundRecord } from "../src/state/aiVersusRounds";
import {
  buildAndSavePracticeRoundFeedback,
  buildPracticeRoundsPanelView,
  deletePracticeRound,
  getPracticeRound,
  getPracticeRoundSubmittedSpeeches,
  listPracticeRounds,
  savePracticeRound,
  type PracticeRoundRecord,
} from "../src/state/practiceRounds";
import { buildPracticeRoundSetup } from "../src/round/practice-round-simulator";
import type { Box } from "debate-core/src/types/flow";

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

const COLUMNS = ["1AC", "1NC"];

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    const current: Box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
    box = current;
  }
  return { ...box!, ...overrides };
}

const MIXED_FLOW = {
  columns: COLUMNS,
  children: [rowFromContents(["Case advantage", "Turn"]), rowFromContents(["", "Disad link"])],
};

const SETUP_A = buildPracticeRoundSetup({ styleKey: "lincolnDouglas", judgeParadigm: "lay" });
const SETUP_B = buildPracticeRoundSetup({ styleKey: "policy", opponentPersona: "kritik" });

const ROUND_A: PracticeRoundRecord = { roundId: "round-1", setup: SETUP_A };
const ROUND_B: PracticeRoundRecord = { roundId: "round-2", setup: SETUP_B };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listPracticeRounds", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPracticeRounds()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("practiceRounds", "{not json");
    expect(listPracticeRounds()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("practiceRounds", JSON.stringify({ not: "an array" }));
    expect(listPracticeRounds()).toEqual([]);
  });

  it("lists every saved practice round", () => {
    savePracticeRound(ROUND_A);
    savePracticeRound(ROUND_B);
    expect(listPracticeRounds()).toEqual([ROUND_A, ROUND_B]);
  });
});

describe("getPracticeRound", () => {
  it("finds a saved practice round by roundId", () => {
    savePracticeRound(ROUND_A);
    expect(getPracticeRound("round-1")).toEqual(ROUND_A);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getPracticeRound("missing")).toBeUndefined();
  });
});

describe("savePracticeRound", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    savePracticeRound(ROUND_A);
    const feedback = {
      judgeParadigm: SETUP_A.judgeParadigm,
      coachingPrompts: [],
      sections: [{ title: "Judged under: Lay / Community Judge", body: "..." }],
    };
    const updated: PracticeRoundRecord = { ...ROUND_A, feedback };
    savePracticeRound(updated);

    expect(listPracticeRounds()).toEqual([updated]);
    expect(getPracticeRound("round-1")).toEqual(updated);
  });
});

describe("deletePracticeRound", () => {
  it("removes a stored practice round by roundId", () => {
    savePracticeRound(ROUND_A);
    savePracticeRound(ROUND_B);
    deletePracticeRound("round-1");

    expect(listPracticeRounds()).toEqual([ROUND_B]);
    expect(getPracticeRound("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    savePracticeRound(ROUND_B);
    deletePracticeRound("missing");
    expect(listPracticeRounds()).toEqual([ROUND_B]);
  });
});

describe("buildPracticeRoundsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildPracticeRoundsPanelView()).toEqual([]);
  });

  it("sorts every persisted practice round by roundId", () => {
    savePracticeRound(ROUND_B);
    savePracticeRound(ROUND_A);
    expect(buildPracticeRoundsPanelView()).toEqual([ROUND_A, ROUND_B]);
  });

  it("does not mutate the underlying stored order", () => {
    savePracticeRound(ROUND_B);
    savePracticeRound(ROUND_A);
    buildPracticeRoundsPanelView();
    expect(listPracticeRounds()).toEqual([ROUND_B, ROUND_A]);
  });
});

describe("getPracticeRoundSubmittedSpeeches", () => {
  it("returns an empty list when the round has no persisted AI-versus state", () => {
    expect(getPracticeRoundSubmittedSpeeches("round-1")).toEqual([]);
  });

  it("looks up submitted speeches through the existing aiVersusRounds store", () => {
    const aiVersusRecord: AiVersusRoundRecord = {
      roundId: "round-1",
      styleKey: "lincolnDouglas",
      userSide: "primary",
      submittedSpeeches: [{ name: "1AC", speaker: "user", text: "Contention one is..." }],
    };
    saveAiVersusRound(aiVersusRecord);

    expect(getPracticeRoundSubmittedSpeeches("round-1")).toEqual(aiVersusRecord.submittedSpeeches);
  });
});

describe("buildAndSavePracticeRoundFeedback", () => {
  it("returns undefined and saves nothing when no round is stored for roundId", () => {
    expect(buildAndSavePracticeRoundFeedback(MIXED_FLOW, "missing", "AFF")).toBeUndefined();
    expect(getPracticeRound("missing")).toBeUndefined();
  });

  it("derives feedback under the round's own saved judge paradigm and saves it onto the record", () => {
    savePracticeRound(ROUND_A);

    const updated = buildAndSavePracticeRoundFeedback(MIXED_FLOW, "round-1", "AFF");

    expect(updated).toBeDefined();
    expect(updated!.feedback).toBeDefined();
    expect(updated!.feedback!.judgeParadigm).toEqual(SETUP_A.judgeParadigm);
    expect(updated!.feedback!.sections.length).toBeGreaterThan(0);
    expect(getPracticeRound("round-1")).toEqual(updated);
  });

  it("preserves the round's other fields (setup, judgeDecision) when saving feedback", () => {
    const judgeDecision = {
      winner: "primary" as const,
      keyVotingIssues: ["Turn on case"],
      rationale: "Aff wins on the turn.",
    };
    savePracticeRound({ ...ROUND_A, judgeDecision });

    const updated = buildAndSavePracticeRoundFeedback(MIXED_FLOW, "round-1", "AFF");

    expect(updated!.setup).toEqual(ROUND_A.setup);
    expect(updated!.judgeDecision).toEqual(judgeDecision);
  });

  it("overwrites any previously generated feedback for the round", () => {
    savePracticeRound(ROUND_A);
    buildAndSavePracticeRoundFeedback(MIXED_FLOW, "round-1", "AFF");
    const secondPass = buildAndSavePracticeRoundFeedback(MIXED_FLOW, "round-1", "NEG");

    expect(getPracticeRound("round-1")!.feedback).toEqual(secondPass!.feedback);
  });
});
