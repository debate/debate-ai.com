import { beforeEach, describe, expect, it } from "vitest";
import { saveAiVersusRound, type AiVersusRoundRecord } from "../src/state/aiVersusRounds";
import {
  buildAndSavePracticeRoundFeedback,
  buildPracticeRoundAttemptsComparison,
  buildPracticeRoundAttemptsComparisonText,
  buildPracticeRoundsPanelView,
  deletePracticeRound,
  getPracticeRound,
  getPracticeRoundSubmittedSpeeches,
  listPracticeRounds,
  practiceRoundAttemptsComparisonFilename,
  savePracticeRound,
  type PracticeRoundRecord,
} from "../src/state/practiceRounds";
import { buildPracticeRoundSetup } from "../src/round/practice-round-simulator";
import type { Box } from "../src/types/flow";

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
    expect(listPracticeRounds()).toMatchObject([ROUND_A, ROUND_B]);
  });
});

describe("getPracticeRound", () => {
  it("finds a saved practice round by roundId", () => {
    savePracticeRound(ROUND_A);
    expect(getPracticeRound("round-1")).toMatchObject(ROUND_A);
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

    expect(listPracticeRounds()).toMatchObject([updated]);
    expect(getPracticeRound("round-1")).toMatchObject(updated);
  });

  it("stamps createdAt with the current time on a round's first save", () => {
    const before = Date.now();
    savePracticeRound(ROUND_A);
    const after = Date.now();

    const createdAt = getPracticeRound("round-1")?.createdAt;
    expect(createdAt).toEqual(expect.any(Number));
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
  });

  it("preserves the original createdAt across a later update to the same roundId", () => {
    savePracticeRound(ROUND_A);
    const firstCreatedAt = getPracticeRound("round-1")?.createdAt;

    savePracticeRound({ ...ROUND_A, judgeDecision: { winner: "primary", keyVotingIssues: ["x"], rationale: "y" } });

    expect(getPracticeRound("round-1")?.createdAt).toBe(firstCreatedAt);
  });
});

describe("deletePracticeRound", () => {
  it("removes a stored practice round by roundId", () => {
    savePracticeRound(ROUND_A);
    savePracticeRound(ROUND_B);
    deletePracticeRound("round-1");

    expect(listPracticeRounds()).toMatchObject([ROUND_B]);
    expect(getPracticeRound("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    savePracticeRound(ROUND_B);
    deletePracticeRound("missing");
    expect(listPracticeRounds()).toMatchObject([ROUND_B]);
  });
});

describe("buildPracticeRoundsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildPracticeRoundsPanelView()).toEqual([]);
  });

  it("sorts every persisted practice round by roundId", () => {
    savePracticeRound(ROUND_B);
    savePracticeRound(ROUND_A);
    expect(buildPracticeRoundsPanelView()).toMatchObject([ROUND_A, ROUND_B]);
  });

  it("does not mutate the underlying stored order", () => {
    savePracticeRound(ROUND_B);
    savePracticeRound(ROUND_A);
    buildPracticeRoundsPanelView();
    expect(listPracticeRounds()).toMatchObject([ROUND_B, ROUND_A]);
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

  it("adds a persona-specific prep-tips section when the round's setup carried an AI opponent persona", () => {
    savePracticeRound(ROUND_B);

    const updated = buildAndSavePracticeRoundFeedback(MIXED_FLOW, "round-2", "AFF");

    const sections = updated!.feedback!.sections;
    expect(sections.at(-1)!.title).toBe("Facing the Kritik persona again");
  });

  it("omits the persona-tips section when the round's setup had no AI opponent persona", () => {
    savePracticeRound(ROUND_A);

    const updated = buildAndSavePracticeRoundFeedback(MIXED_FLOW, "round-1", "AFF");

    expect(updated!.feedback!.sections.some((section) => section.title.startsWith("Facing the"))).toBe(
      false,
    );
  });
});

const SETUP_SECONDARY = buildPracticeRoundSetup({
  styleKey: "lincolnDouglas",
  userSide: "secondary",
  judgeParadigm: "lay",
});

const JUDGE_DECISION_PRIMARY_WINS = {
  winner: "primary" as const,
  keyVotingIssues: ["Turn on case"],
  rationale: "Aff wins on the turn.",
};
const JUDGE_DECISION_SECONDARY_WINS = {
  winner: "secondary" as const,
  keyVotingIssues: ["Link outweighs"],
  rationale: "Neg wins on the link.",
};

describe("buildPracticeRoundAttemptsComparison", () => {
  it("returns an empty comparison when nothing is stored", () => {
    expect(buildPracticeRoundAttemptsComparison()).toEqual({
      attempts: [],
      wins: 0,
      losses: 0,
      pending: 0,
      winRate: null,
    });
  });

  it("excludes a round with no createdAt (persisted before the field existed)", () => {
    localStorage.setItem("practiceRounds", JSON.stringify([{ roundId: "round-1", setup: SETUP_A }]));
    expect(buildPracticeRoundAttemptsComparison().attempts).toEqual([]);
  });

  it("marks a round pending when no judge decision has been requested yet", () => {
    savePracticeRound({ ...ROUND_A, createdAt: 100 });
    const [attempt] = buildPracticeRoundAttemptsComparison().attempts;
    expect(attempt).toMatchObject({ roundId: "round-1", outcome: "pending" });
    expect(attempt.feedbackIssueCount).toBeUndefined();
  });

  it("marks a round won when the judge decision favors the side the user argued", () => {
    savePracticeRound({ ...ROUND_A, createdAt: 100, judgeDecision: JUDGE_DECISION_PRIMARY_WINS });
    const [attempt] = buildPracticeRoundAttemptsComparison().attempts;
    expect(attempt.outcome).toBe("won");
  });

  it("marks a round lost when the judge decision favors the opposing side", () => {
    savePracticeRound({ ...ROUND_A, createdAt: 100, judgeDecision: JUDGE_DECISION_SECONDARY_WINS });
    const [attempt] = buildPracticeRoundAttemptsComparison().attempts;
    expect(attempt.outcome).toBe("lost");
  });

  it("accounts for a round where the user argued the secondary side", () => {
    savePracticeRound({
      roundId: "round-3",
      setup: SETUP_SECONDARY,
      createdAt: 100,
      judgeDecision: JUDGE_DECISION_SECONDARY_WINS,
    });
    const [attempt] = buildPracticeRoundAttemptsComparison().attempts;
    expect(attempt.outcome).toBe("won");
  });

  it("sorts attempts chronologically by createdAt", () => {
    savePracticeRound({ ...ROUND_A, createdAt: 200 });
    savePracticeRound({ ...ROUND_B, createdAt: 100 });
    const attempts = buildPracticeRoundAttemptsComparison().attempts;
    expect(attempts.map((attempt) => attempt.roundId)).toEqual(["round-2", "round-1"]);
  });

  it("tallies wins, losses, pending, and win rate among decided attempts", () => {
    savePracticeRound({ ...ROUND_A, createdAt: 100, judgeDecision: JUDGE_DECISION_PRIMARY_WINS });
    savePracticeRound({ ...ROUND_B, createdAt: 200, judgeDecision: JUDGE_DECISION_SECONDARY_WINS });
    savePracticeRound({ roundId: "round-3", setup: SETUP_A, createdAt: 300 });

    const comparison = buildPracticeRoundAttemptsComparison();
    expect(comparison.wins).toBe(1);
    expect(comparison.losses).toBe(1);
    expect(comparison.pending).toBe(1);
    expect(comparison.winRate).toBe(0.5);
  });

  it("carries the feedback issue count once feedback has been generated", () => {
    savePracticeRound({
      ...ROUND_A,
      createdAt: 100,
      feedback: {
        judgeParadigm: SETUP_A.judgeParadigm,
        coachingPrompts: [
          { kind: "extension", rowIndex: 0, prompt: "Extend the turn." },
          { kind: "refutation", rowIndex: 1, prompt: "Answer the disad." },
        ],
        sections: [],
      },
    });
    const [attempt] = buildPracticeRoundAttemptsComparison().attempts;
    expect(attempt.feedbackIssueCount).toBe(2);
  });

  it("labels the opponent persona, falling back to 'No AI opponent' when none was set", () => {
    savePracticeRound({ ...ROUND_A, createdAt: 100 });
    savePracticeRound({ ...ROUND_B, createdAt: 200 });
    const [attemptA, attemptB] = buildPracticeRoundAttemptsComparison().attempts;
    expect(attemptA.opponentPersonaName).toBe("No AI opponent");
    expect(attemptB.opponentPersonaName).toBe(SETUP_B.opponentPersona!.name);
  });
});

describe("buildPracticeRoundAttemptsComparisonText", () => {
  it("renders a placeholder when no attempts are logged", () => {
    const text = buildPracticeRoundAttemptsComparisonText(buildPracticeRoundAttemptsComparison());
    expect(text).toContain("No practice round attempts logged yet.");
  });

  it("renders a summary line and one line per attempt", () => {
    savePracticeRound({ ...ROUND_A, createdAt: 100, judgeDecision: JUDGE_DECISION_PRIMARY_WINS });
    savePracticeRound({ ...ROUND_B, createdAt: 200 });

    const text = buildPracticeRoundAttemptsComparisonText(buildPracticeRoundAttemptsComparison());

    expect(text).toContain("2 attempts logged — 1 won, 0 lost, 1 pending (win rate: 100%).");
    expect(text).toContain("Round round-1");
    expect(text).toContain("Won");
    expect(text).toContain("Round round-2");
    expect(text).toContain("Pending");
  });
});

describe("practiceRoundAttemptsComparisonFilename", () => {
  it("returns a static filename", () => {
    expect(practiceRoundAttemptsComparisonFilename()).toBe("practice-round-attempts-comparison.txt");
  });
});
