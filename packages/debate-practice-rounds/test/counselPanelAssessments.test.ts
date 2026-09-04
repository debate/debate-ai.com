import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptCounselPanelAssessment,
  appendCounselPanelAssessment,
  buildCounselPanelAssessmentsPanelView,
  deleteCounselPanelAssessment,
  deleteCounselPanelAssessmentsForRound,
  getCounselPanelAssessment,
  getLatestCounselPanelAssessmentForRound,
  listCounselPanelAssessments,
  listCounselPanelAssessmentsForRound,
  MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND,
  type CounselPanelAssessmentRecord,
} from "../src/state/counselPanelAssessments";
import type { CounselPanelAiResult } from "../src/flow/response-outcome-ai";

/** Convenience wrapper — most tests only care about the stamped record. */
function append(input: Omit<CounselPanelAssessmentRecord, "id">): CounselPanelAssessmentRecord {
  return appendCounselPanelAssessment(input).record;
}

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

const RESULT_A: CounselPanelAiResult = {
  argumentAssessments: [
    {
      rowIndex: 0,
      counselRole: "Policy Counsel",
      likelyResponsePath: "Negative reads a solvency deficit.",
      clashEstimate: "Clash on mechanism feasibility.",
    },
  ],
  overallClashSummary: "Clash concentrates on solvency.",
};

const RESULT_B: CounselPanelAiResult = {
  argumentAssessments: [
    {
      rowIndex: 1,
      counselRole: "Weighing Counsel",
      likelyResponsePath: "Affirmative weighs magnitude over probability.",
      clashEstimate: "Clash on impact calculus.",
    },
  ],
  overallClashSummary: "Clash concentrates on weighing.",
};

const INPUT_A: Omit<CounselPanelAssessmentRecord, "id"> = { roundId: "round-1", result: RESULT_A, generatedAt: 1000 };
const INPUT_B: Omit<CounselPanelAssessmentRecord, "id"> = { roundId: "round-2", result: RESULT_B, generatedAt: 2000 };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("appendCounselPanelAssessment", () => {
  it("assigns a fresh id and returns the stamped record", () => {
    const { record } = appendCounselPanelAssessment(INPUT_A);
    expect(record.id).toBeTruthy();
    expect(record).toMatchObject(INPUT_A);
  });

  it("never overwrites an existing entry, even for the same roundId", () => {
    append(INPUT_A);
    append({ ...INPUT_A, generatedAt: 1500 });
    expect(listCounselPanelAssessments()).toHaveLength(2);
  });

  it("assigns distinct ids to two assessments requested back to back", () => {
    const first = append(INPUT_A);
    const second = append({ ...INPUT_A, generatedAt: 1500 });
    expect(first.id).not.toBe(second.id);
  });

  it("returns an empty trimmedIds while a round stays under the cap", () => {
    for (let i = 0; i < MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND; i++) {
      const { trimmedIds } = appendCounselPanelAssessment({ ...INPUT_A, generatedAt: i });
      expect(trimmedIds).toEqual([]);
    }
    expect(listCounselPanelAssessmentsForRound("round-1")).toHaveLength(MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND);
  });

  it("trims the oldest assessment for a round once it exceeds MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND", () => {
    const oldest = append({ ...INPUT_A, generatedAt: 0 });
    for (let i = 1; i < MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND; i++) {
      append({ ...INPUT_A, generatedAt: i });
    }
    const { record: newest, trimmedIds } = appendCounselPanelAssessment({
      ...INPUT_A,
      generatedAt: MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND,
    });

    expect(trimmedIds).toEqual([oldest.id]);
    const forRound1 = listCounselPanelAssessmentsForRound("round-1");
    expect(forRound1).toHaveLength(MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND);
    expect(forRound1.map((r) => r.id)).not.toContain(oldest.id);
    expect(forRound1[0].id).toBe(newest.id);
  });

  it("leaves other rounds untouched when one round's cap is enforced", () => {
    for (let i = 0; i <= MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND; i++) {
      append({ ...INPUT_A, generatedAt: i });
    }
    append(INPUT_B);

    expect(listCounselPanelAssessmentsForRound("round-2")).toHaveLength(1);
  });
});

describe("listCounselPanelAssessments", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCounselPanelAssessments()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("counselPanelAssessments", "{not json");
    expect(listCounselPanelAssessments()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("counselPanelAssessments", JSON.stringify({ not: "an array" }));
    expect(listCounselPanelAssessments()).toEqual([]);
  });

  it("lists every appended assessment", () => {
    append(INPUT_A);
    append(INPUT_B);
    expect(listCounselPanelAssessments()).toHaveLength(2);
  });
});

describe("getCounselPanelAssessment", () => {
  it("returns undefined when no assessment is stored with that id", () => {
    expect(getCounselPanelAssessment("does-not-exist")).toBeUndefined();
  });

  it("returns the stored assessment by its own id", () => {
    const record = append(INPUT_A);
    expect(getCounselPanelAssessment(record.id)).toEqual(record);
  });
});

describe("listCounselPanelAssessmentsForRound", () => {
  it("returns only the given round's assessments, newest-first", () => {
    append(INPUT_A);
    const older = append({ ...INPUT_A, generatedAt: 500 });
    const newer = append({ ...INPUT_A, generatedAt: 5000 });
    append(INPUT_B);

    const forRound1 = listCounselPanelAssessmentsForRound("round-1");
    expect(forRound1).toHaveLength(3);
    expect(forRound1[0].id).toBe(newer.id);
    expect(forRound1.at(-1)!.id).toBe(older.id);
  });

  it("returns an empty list for a round with no history", () => {
    append(INPUT_A);
    expect(listCounselPanelAssessmentsForRound("round-does-not-exist")).toEqual([]);
  });
});

describe("getLatestCounselPanelAssessmentForRound", () => {
  it("returns undefined for a round with no history", () => {
    expect(getLatestCounselPanelAssessmentForRound("round-1")).toBeUndefined();
  });

  it("returns the most recently generated assessment for a round", () => {
    append(INPUT_A);
    const newer = append({ ...INPUT_A, generatedAt: 9000 });

    expect(getLatestCounselPanelAssessmentForRound("round-1")?.id).toBe(newer.id);
  });
});

describe("adoptCounselPanelAssessment", () => {
  it("inserts a record with a new id", () => {
    const remote: CounselPanelAssessmentRecord = { ...INPUT_A, id: "counsel-remote-1" };
    adoptCounselPanelAssessment(remote);
    expect(listCounselPanelAssessments()).toEqual([remote]);
  });

  it("overwrites an existing record with the same id, rather than duplicating", () => {
    const remote: CounselPanelAssessmentRecord = { ...INPUT_A, id: "counsel-remote-1" };
    adoptCounselPanelAssessment(remote);
    const updated: CounselPanelAssessmentRecord = { ...remote, result: RESULT_B };
    adoptCounselPanelAssessment(updated);
    expect(listCounselPanelAssessments()).toEqual([updated]);
  });
});

describe("deleteCounselPanelAssessment", () => {
  it("removes a single assessment by its own id, leaving other assessments for the same round", () => {
    const first = append(INPUT_A);
    const second = append({ ...INPUT_A, generatedAt: 1500 });
    deleteCounselPanelAssessment(first.id);
    expect(listCounselPanelAssessments()).toEqual([second]);
  });

  it("is a no-op when no assessment has that id", () => {
    const record = append(INPUT_A);
    deleteCounselPanelAssessment("does-not-exist");
    expect(listCounselPanelAssessments()).toEqual([record]);
  });
});

describe("deleteCounselPanelAssessmentsForRound", () => {
  it("removes every assessment for the given round, leaving other rounds untouched", () => {
    append(INPUT_A);
    append({ ...INPUT_A, generatedAt: 1500 });
    const other = append(INPUT_B);

    deleteCounselPanelAssessmentsForRound("round-1");

    expect(listCounselPanelAssessments()).toEqual([other]);
    expect(listCounselPanelAssessmentsForRound("round-1")).toEqual([]);
  });

  it("returns the removed ids newest-first", () => {
    const older = append(INPUT_A);
    const newer = append({ ...INPUT_A, generatedAt: 9000 });

    const removedIds = deleteCounselPanelAssessmentsForRound("round-1");

    expect(removedIds).toEqual([newer.id, older.id]);
  });

  it("returns an empty array and is a no-op for a round with no history", () => {
    const record = append(INPUT_A);
    const removedIds = deleteCounselPanelAssessmentsForRound("round-does-not-exist");
    expect(removedIds).toEqual([]);
    expect(listCounselPanelAssessments()).toEqual([record]);
  });
});

describe("buildCounselPanelAssessmentsPanelView", () => {
  it("groups assessments by roundId, sorted by roundId", () => {
    append(INPUT_B);
    append(INPUT_A);
    const groups = buildCounselPanelAssessmentsPanelView();
    expect(groups.map((g) => g.roundId)).toEqual(["round-1", "round-2"]);
  });

  it("sorts each round's assessments newest-first", () => {
    const older = append({ ...INPUT_A, generatedAt: 100 });
    const newer = append({ ...INPUT_A, generatedAt: 9000 });
    const [group] = buildCounselPanelAssessmentsPanelView();
    expect(group.assessments.map((r) => r.id)).toEqual([newer.id, older.id]);
  });
});
