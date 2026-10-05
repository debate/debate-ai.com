import { describe, expect, it } from "vitest";
import {
  buildRoundFlowText,
  extractHighlightedText,
  getOutcomeSpeechSide,
  getPriorSpeechNames,
  getRoundFlows,
  pickLikelyOutcomeJudge,
  speechDocToText,
} from "../src/round/outcome-responses-context";
import type { JudgeProfile } from "@debate/speech-writer/src/judge/judge-profile";
import type { Flow } from "../src/types/flow";

function profile(judgeId: string, roundsJudged: number, mostCommonParadigm: JudgeProfile["mostCommonParadigm"]): JudgeProfile {
  return {
    judgeId,
    roundsJudged,
    tournamentsJudged: 1,
    sideBias: { affWins: 1, negWins: 1, affWinRate: 0.5, negWinRate: 0.5, hasNotableSideBias: false },
    avgSpeakerPoints: { aff: 28, neg: 28, overall: 28 },
    speedTolerance: null,
    avgPaceWpm: null,
    theoryReceptiveness: null,
    theoryWinRate: null,
    roundsWithTheoryRaised: 0,
    mostCommonParadigm,
    mostCommonParadigmConfidence: 1,
  } as JudgeProfile;
}

function flow(partial: Partial<Flow>): Flow {
  return {
    content: "Case",
    level: 0,
    columns: ["1AC", "1NC", "2AC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [],
    children: [],
    id: 1,
    ...partial,
  } as Flow;
}

describe("outcome responses context", () => {
  it("reads the side from the speech name", () => {
    expect(getOutcomeSpeechSide("2AC")).toBe("aff");
    expect(getOutcomeSpeechSide("1NR")).toBe("neg");
    expect(getOutcomeSpeechSide("AC")).toBe("aff");
    expect(getOutcomeSpeechSide("CX")).toBeNull();
  });

  it("lists the speeches before the current one", () => {
    expect(getPriorSpeechNames(["1AC", "1NC", "2AC", "2NC"], "2ac")).toEqual(["1AC", "1NC"]);
    expect(getPriorSpeechNames(["1AC", "1NC"], "2NR")).toEqual(["1AC", "1NC"]);
  });

  it("turns speech doc HTML into text and keeps highlighted words marked", () => {
    expect(speechDocToText("<h4>Tag</h4><p>Smith &amp; Lee 24 <mark>warming kills</mark> rest</p>")).toBe(
      "Tag\nSmith & Lee 24 ==warming kills== rest",
    );
    expect(extractHighlightedText("a <mark>one</mark> b <mark>two</mark>")).toBe("one … two");
  });

  it("renders every flowed row with each speech's entry", () => {
    const text = buildRoundFlowText([
      flow({
        children: [
          {
            content: "Warming advantage",
            children: [{ content: "No impact", children: [], index: 0, level: 2, focus: false, empty: false } as any],
            index: 0,
            level: 1,
            focus: false,
            empty: false,
          } as any,
        ],
      }),
    ]);
    expect(text).toContain("## Case");
    expect(text).toContain("1AC: Warming advantage");
    expect(text).toContain("1NC: No impact");
    expect(buildRoundFlowText([flow({})])).toBe("No arguments have been flowed yet.");
  });

  it("keeps a round's flows together", () => {
    const current = flow({ id: 1, roundId: 7 });
    const other = flow({ id: 2, roundId: 7 });
    const unrelated = flow({ id: 3, roundId: 8 });
    expect(getRoundFlows(current, [current, other, unrelated]).map((f) => f.id)).toEqual([1, 2]);
    expect(getRoundFlows(flow({ id: 4 }), [current]).map((f) => f.id)).toEqual([4]);
  });

  it("predicts the round judge with the most ballots on record", () => {
    const judge = pickLikelyOutcomeJudge(["Lee", " Park "], [profile("lee", 2, "lay"), profile("Park", 9, "critic")]);
    expect(judge.name).toBe("Park");
    expect(judge.paradigm.id).toBe("critic");
    expect(judge.tendencySummary).toContain("Park");
  });

  it("falls back to the paradigm most common across saved profiles", () => {
    const judge = pickLikelyOutcomeJudge(["Unknown"], [profile("a", 1, "lay"), profile("b", 1, "lay"), profile("c", 1, "flow")]);
    expect(judge.name).toBe("Unknown");
    expect(judge.paradigm.id).toBe("lay");
    expect(pickLikelyOutcomeJudge([], []).paradigm.id).toBe("flow");
  });
});
