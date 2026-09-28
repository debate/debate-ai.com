// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { JUDGE_AWARD_KINDS, JUDGE_AWARDS, validateJudgeAward, type JudgeAward } from "../src/lib/judge-awards";
import {
  deleteJudgeAward,
  giveJudgeAward,
  JudgeAwardError,
  JUDGE_AWARDS_STORAGE_KEY,
  listAllJudgeAwards,
  listJudgeAwardsForDebater,
} from "../src/state/judgeAwards";

function award(overrides: Partial<JudgeAward> = {}): JudgeAward {
  return {
    id: "a1",
    kind: "best_speaker",
    debaterId: "alice",
    judgeName: "Jane Doe",
    tournament: "Glenbrooks",
    awardedAt: 1,
    ...overrides,
  };
}

describe("JUDGE_AWARDS", () => {
  it("defines five awards, each with a badge and copy", () => {
    expect(JUDGE_AWARD_KINDS).toEqual([
      "most_improved",
      "best_speaker",
      "best_critique_debater",
      "best_impact_calculus",
      "best_research",
    ]);
    for (const definition of JUDGE_AWARDS) {
      expect(definition.badgeUrl).toMatch(/^https:\/\/i\.imgur\.com\/\w+\.png$/);
      expect(definition.title).not.toBe("");
      expect(definition.description).not.toBe("");
    }
  });
});

describe("validateJudgeAward", () => {
  const input = { kind: "best_speaker" as const, debaterId: "bob", judgeName: "Jane Doe", tournament: "Glenbrooks" };

  it("allows a judge's first award of a kind at a tournament", () => {
    expect(validateJudgeAward([], input)).toBeNull();
  });

  it("refuses the same award from the same judge at the same tournament, ignoring case and spacing", () => {
    expect(validateJudgeAward([award()], { ...input, judgeName: " jane  DOE ", tournament: "glenbrooks" })).toBe(
      "already-given",
    );
  });

  it("allows a different award, a different tournament, or a different judge", () => {
    expect(validateJudgeAward([award()], { ...input, kind: "most_improved" })).toBeNull();
    expect(validateJudgeAward([award()], { ...input, tournament: "TOC" })).toBeNull();
    expect(validateJudgeAward([award()], { ...input, judgeName: "Sam Lee" })).toBeNull();
  });

  it("refuses blank fields, unknown kinds, and a judge awarding themself", () => {
    expect(validateJudgeAward([], { ...input, judgeName: "  " })).toBe("missing-field");
    expect(validateJudgeAward([], { ...input, tournament: "" })).toBe("missing-field");
    expect(validateJudgeAward([], { ...input, kind: "best_vibes" as never })).toBe("unknown-kind");
    expect(validateJudgeAward([], { ...input, debaterId: "jane doe" })).toBe("self-award");
  });
});

describe("judge award store", () => {
  beforeEach(() => localStorage.clear());

  it("gives an award, trimming names, and lists it on the debater's page", () => {
    const given = giveJudgeAward(
      { kind: "best_research", debaterId: " alice ", judgeName: " Jane   Doe ", tournament: "Glenbrooks " },
      100,
    );
    expect(given).toMatchObject({ debaterId: "alice", judgeName: "Jane Doe", tournament: "Glenbrooks", awardedAt: 100 });
    expect(listJudgeAwardsForDebater("alice")).toEqual([given]);
    expect(listJudgeAwardsForDebater("bob")).toEqual([]);
  });

  it("enforces once per judge per tournament across debaters", () => {
    giveJudgeAward({ kind: "best_speaker", debaterId: "alice", judgeName: "Jane Doe", tournament: "Glenbrooks" });
    expect(() =>
      giveJudgeAward({ kind: "best_speaker", debaterId: "bob", judgeName: "Jane Doe", tournament: "Glenbrooks" }),
    ).toThrow(JudgeAwardError);
    expect(listAllJudgeAwards()).toHaveLength(1);
  });

  it("frees the slot again once the award is removed", () => {
    const given = giveJudgeAward({ kind: "best_speaker", debaterId: "alice", judgeName: "Jane", tournament: "TOC" });
    deleteJudgeAward(given.id);
    expect(() => giveJudgeAward({ kind: "best_speaker", debaterId: "bob", judgeName: "Jane", tournament: "TOC" })).not.toThrow();
  });

  it("drops malformed stored records", () => {
    localStorage.setItem(JUDGE_AWARDS_STORAGE_KEY, JSON.stringify([award(), { id: "bad", kind: "nope" }, null]));
    expect(listAllJudgeAwards()).toEqual([award()]);
  });
});
