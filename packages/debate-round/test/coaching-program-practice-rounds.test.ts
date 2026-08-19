import { describe, expect, it } from "vitest";
import { buildPracticeRoundSetup } from "../src/round/practice-round-simulator";
import { buildCoachingProgramMemberPracticeRounds } from "../src/round/coaching-program-practice-rounds";
import type { CoachingProgramConfig } from "../src/round/coaching-program";
import type { PracticeRoundRecord } from "../src/state/practiceRounds";

const program: CoachingProgramConfig = {
  id: "varsity",
  name: "Varsity Squad",
  memberIds: ["alex", "sam"],
};

const setupA = buildPracticeRoundSetup({ styleKey: "lincolnDouglas", judgeParadigm: "lay" });
const setupB = buildPracticeRoundSetup({ styleKey: "policy", opponentPersona: "kritik" });

const roundA: PracticeRoundRecord = { roundId: "round-1", setup: setupA };
const roundBWithFeedback: PracticeRoundRecord = {
  roundId: "round-2",
  setup: setupB,
  feedback: {
    judgeParadigm: setupB.judgeParadigm,
    coachingPrompts: [],
    sections: [{ title: "Judged under: Flow Judge", body: "Voting priorities: ..." }],
  },
};

describe("buildCoachingProgramMemberPracticeRounds", () => {
  it("renders a resolvable member assignment's setup text, with no feedback yet", () => {
    const views = buildCoachingProgramMemberPracticeRounds(
      program,
      { alex: "round-1" },
      [roundA],
    );

    expect(views).toHaveLength(1);
    expect(views[0].contributorId).toBe("alex");
    expect(views[0].roundId).toBe("round-1");
    expect(views[0].setupText).toContain("Speech order");
    expect(views[0].feedbackText).toBeNull();
  });

  it("renders feedback text once the assigned round has generated it", () => {
    const views = buildCoachingProgramMemberPracticeRounds(
      program,
      { sam: "round-2" },
      [roundBWithFeedback],
    );

    expect(views).toHaveLength(1);
    expect(views[0].feedbackText).toContain("Judged under: Flow Judge");
  });

  it("resolves multiple roster members, each against their own assigned round", () => {
    const views = buildCoachingProgramMemberPracticeRounds(
      program,
      { alex: "round-1", sam: "round-2" },
      [roundA, roundBWithFeedback],
    );

    expect(views.map((v) => v.contributorId)).toEqual(["alex", "sam"]);
  });

  it("skips a member with no round assignment", () => {
    const views = buildCoachingProgramMemberPracticeRounds(program, {}, [roundA, roundBWithFeedback]);
    expect(views).toEqual([]);
  });

  it("skips an assignment whose roundId has no matching persisted practice round", () => {
    const views = buildCoachingProgramMemberPracticeRounds(
      program,
      { alex: "missing-round" },
      [roundA],
    );
    expect(views).toEqual([]);
  });

  it("ignores an assignment for a contributor outside the program roster", () => {
    const views = buildCoachingProgramMemberPracticeRounds(
      program,
      { jordan: "round-1" },
      [roundA],
    );
    expect(views).toEqual([]);
  });
});
