import { describe, expect, it } from "vitest";
import { buildTopicCoverageReport, type TrackedArgument } from "debate-research-evidence/src/lib/topic-coverage";
import {
  buildBrainstormBoard,
  buildBrainstormBoardsForCoverageGaps,
  buildBrainstormIdeaRankBadge,
  buildBrainstormPrompt,
  buildBrainstormPromptsForCoverageGaps,
  buildBrainstormSummaryText,
  buildEvidenceEntryFromBrainstormIdea,
  groupIdeasByBoard,
  mergeBrainstormIdeas,
  rankBrainstormIdeas,
  type BrainstormIdea,
} from "../src/lib/team-brainstorm-assist";

describe("buildBrainstormPrompt", () => {
  it("builds a distinct, argBlock-specific prompt per category", () => {
    const categories = ["argument", "impact_framing", "frontline", "response"] as const;
    const prompts = categories.map((category) => buildBrainstormPrompt("Warming DA", category));

    for (const prompt of prompts) {
      expect(prompt.argBlock).toBe("Warming DA");
      expect(prompt.prompt).toContain("Warming DA");
    }
    expect(new Set(prompts.map((p) => p.prompt)).size).toBe(4);
  });
});

describe("buildBrainstormPromptsForCoverageGaps", () => {
  const trackedArguments: TrackedArgument[] = [
    { argBlock: "Warming DA" },
    { argBlock: "States CP" },
    { argBlock: "Case NEG" },
  ];

  it("seeds one prompt per under-covered argument per default category, worst-covered first", () => {
    const report = buildTopicCoverageReport(trackedArguments, [
      { id: "w1", argBlock: "Warming DA", wordCount: 250 },
      { id: "w2", argBlock: "Warming DA", wordCount: 250 },
      { id: "w3", argBlock: "Warming DA", wordCount: 250 },
      { id: "s1", argBlock: "States CP", wordCount: 50 },
    ]);

    const prompts = buildBrainstormPromptsForCoverageGaps(report);

    expect(prompts.map((p) => `${p.argBlock}:${p.category}`)).toEqual([
      "Case NEG:argument",
      "Case NEG:impact_framing",
      "States CP:argument",
      "States CP:impact_framing",
    ]);
  });

  it("honors a custom category list", () => {
    const report = buildTopicCoverageReport(trackedArguments, []);
    const prompts = buildBrainstormPromptsForCoverageGaps(report, ["frontline"]);
    expect(prompts.every((p) => p.category === "frontline")).toBe(true);
    expect(prompts).toHaveLength(3);
  });

  it("returns an empty list once every tracked argument is covered", () => {
    const report = buildTopicCoverageReport(
      [{ argBlock: "Warming DA" }],
      [
        { id: "w1", argBlock: "Warming DA", wordCount: 250 },
        { id: "w2", argBlock: "Warming DA", wordCount: 250 },
        { id: "w3", argBlock: "Warming DA", wordCount: 250 },
      ],
    );
    expect(buildBrainstormPromptsForCoverageGaps(report)).toEqual([]);
  });
});

const ideas: BrainstormIdea[] = [
  {
    id: "idea-1",
    argBlock: "Warming DA",
    category: "argument",
    contributorId: "alex",
    text: "The plan triggers a manufacturing boom that spikes emissions faster than renewables can offset.",
    upvotes: 8,
  },
  {
    id: "idea-2",
    argBlock: "Warming DA",
    category: "argument",
    contributorId: "sam",
    text: "The plan triggers a manufacturing boom that spikes emissions faster than clean energy can offset it.",
    upvotes: 1,
  },
  {
    id: "idea-3",
    argBlock: "Warming DA",
    category: "argument",
    contributorId: "jo",
    text: "Federal preemption of state climate law guts existing mitigation programs.",
    upvotes: 3,
  },
  {
    id: "idea-4",
    argBlock: "Warming DA",
    category: "impact_framing",
    contributorId: "alex",
    text: "Frame warming as the only existential, irreversible impact in the round.",
    upvotes: 2,
  },
];

describe("groupIdeasByBoard", () => {
  it("groups ideas by argBlock and category, preserving submission order", () => {
    const grouped = groupIdeasByBoard(ideas);
    expect(Array.from(grouped.keys())).toEqual(["Warming DA::argument", "Warming DA::impact_framing"]);
    expect(grouped.get("Warming DA::argument")?.map((idea) => idea.id)).toEqual(["idea-1", "idea-2", "idea-3"]);
  });

  it("returns an empty map for an empty idea list", () => {
    expect(groupIdeasByBoard([]).size).toBe(0);
  });
});

describe("rankBrainstormIdeas", () => {
  const boardIdeas = ideas.filter((idea) => idea.argBlock === "Warming DA" && idea.category === "argument");
  const ranked = rankBrainstormIdeas(boardIdeas);

  it("ranks by popularity score descending", () => {
    expect(ranked[0].id).toBe("idea-1");
    expect(ranked[0].popularityScore).toBeGreaterThan(ranked[2].popularityScore);
  });

  it("flags near-duplicate text as a likely duplicate", () => {
    const idea1 = ranked.find((idea) => idea.id === "idea-1");
    const idea2 = ranked.find((idea) => idea.id === "idea-2");
    expect(idea1?.isLikelyDuplicate).toBe(true);
    expect(idea2?.isLikelyDuplicate).toBe(true);
  });

  it("does not flag a substantively different idea as a duplicate", () => {
    const idea3 = ranked.find((idea) => idea.id === "idea-3");
    expect(idea3?.isLikelyDuplicate).toBe(false);
  });

  it("breaks a popularity tie by id", () => {
    const tied: BrainstormIdea[] = [
      { id: "b", argBlock: "X", category: "argument", contributorId: "a", text: "one idea", upvotes: 5 },
      { id: "a", argBlock: "X", category: "argument", contributorId: "b", text: "totally different idea", upvotes: 5 },
    ];
    const result = rankBrainstormIdeas(tied);
    expect(result.map((idea) => idea.id)).toEqual(["a", "b"]);
  });

  it("returns an empty list for an empty board", () => {
    expect(rankBrainstormIdeas([])).toEqual([]);
  });
});

describe("buildBrainstormBoard", () => {
  it("filters ideas down to the requested board and ranks them by popularity", () => {
    const board = buildBrainstormBoard("Warming DA", "argument", ideas);
    expect(board.ideas.map((idea) => idea.id)).toEqual(["idea-1", "idea-3", "idea-2"]);
    expect(board.prompt).toContain("Warming DA");
  });

  it("excludes ideas from a different argBlock or category", () => {
    const board = buildBrainstormBoard("Warming DA", "frontline", ideas);
    expect(board.ideas).toEqual([]);
  });
});

describe("mergeBrainstormIdeas", () => {
  it("combines the two ideas' upvote counts onto a copy of the target", () => {
    const target: BrainstormIdea = { ...ideas[0] };
    const duplicate: BrainstormIdea = { ...ideas[1] };
    const merged = mergeBrainstormIdeas(target, duplicate);

    expect(merged.upvotes).toBe(target.upvotes + duplicate.upvotes);
    expect(merged.id).toBe(target.id);
    expect(merged.text).toBe(target.text);
  });

  it("does not mutate either input idea", () => {
    const target: BrainstormIdea = { ...ideas[0] };
    const duplicate: BrainstormIdea = { ...ideas[1] };
    mergeBrainstormIdeas(target, duplicate);

    expect(target.upvotes).toBe(ideas[0].upvotes);
    expect(duplicate.upvotes).toBe(ideas[1].upvotes);
  });

  it("throws when merging an idea into itself", () => {
    const idea: BrainstormIdea = { ...ideas[0] };
    expect(() => mergeBrainstormIdeas(idea, idea)).toThrow(/itself/);
  });

  it("throws when the two ideas aren't on the same board", () => {
    const target = ideas.find((idea) => idea.category === "argument")!;
    const duplicate = ideas.find((idea) => idea.category === "impact_framing")!;
    expect(() => mergeBrainstormIdeas(target, duplicate)).toThrow(/different boards/);
  });
});

describe("buildBrainstormBoardsForCoverageGaps", () => {
  it("builds one populated board per coverage-gap/category pair", () => {
    const report = buildTopicCoverageReport([{ argBlock: "Warming DA" }, { argBlock: "States CP" }], [
      { id: "s1", argBlock: "States CP", wordCount: 50 },
    ]);
    const boards = buildBrainstormBoardsForCoverageGaps(report, ideas);

    const warmingArgumentBoard = boards.find((b) => b.argBlock === "Warming DA" && b.category === "argument");
    expect(warmingArgumentBoard?.ideas).toHaveLength(3);

    const statesBoard = boards.find((b) => b.argBlock === "States CP" && b.category === "argument");
    expect(statesBoard?.ideas).toEqual([]);
  });
});

describe("buildBrainstormSummaryText", () => {
  it("reports the top idea and duplicate count when ideas exist", () => {
    const board = buildBrainstormBoard("Warming DA", "argument", ideas);
    const text = buildBrainstormSummaryText(board);
    expect(text).toContain("New Arguments");
    expect(text).toContain("Warming DA");
    expect(text).toContain("3 ideas");
    expect(text).toContain("2 possible duplicates");
    expect(text).toContain("alex");
  });

  it("falls back to the seeding prompt when no ideas have been submitted", () => {
    const board = buildBrainstormBoard("Case NEG", "frontline", []);
    const text = buildBrainstormSummaryText(board);
    expect(text).toContain("no ideas submitted yet");
    expect(text).toContain(board.prompt);
  });

  it("uses singular wording for exactly one idea and zero duplicates", () => {
    const singleIdea: BrainstormIdea[] = [
      { id: "solo", argBlock: "Case NEG", category: "response", contributorId: "kim", text: "unique idea", upvotes: 0 },
    ];
    const board = buildBrainstormBoard("Case NEG", "response", singleIdea);
    const text = buildBrainstormSummaryText(board);
    expect(text).toContain("1 idea,");
    expect(text).not.toContain("duplicate");
  });
});

describe("buildEvidenceEntryFromBrainstormIdea", () => {
  const idea: BrainstormIdea = {
    id: "idea-9",
    argBlock: "Warming DA",
    category: "impact_framing",
    contributorId: "alex",
    text: "Weigh probability over magnitude on warming impacts",
    upvotes: 5,
  };

  it("converts the idea into a block-kind evidence entry filed under the given topic/case area", () => {
    const entry = buildEvidenceEntryFromBrainstormIdea(idea, "Energy Policy", "Aff");

    expect(entry.kind).toBe("block");
    expect(entry.topic).toBe("Energy Policy");
    expect(entry.caseArea).toBe("Aff");
    expect(entry.argBlock).toBe("Warming DA");
    expect(entry.text).toBe(idea.text);
    expect(entry.cite).toBe("");
    expect(entry.wordCount).toBeGreaterThan(0);
  });

  it("derives a deterministic id from the idea's own id, so sending twice targets the same entry", () => {
    const first = buildEvidenceEntryFromBrainstormIdea(idea, "Energy Policy", "Aff");
    const second = buildEvidenceEntryFromBrainstormIdea(idea, "Energy Policy", "Neg");
    expect(first.id).toBe(second.id);
  });

  it("tags the entry with the idea's category label", () => {
    const entry = buildEvidenceEntryFromBrainstormIdea(idea, "Energy Policy", "Aff");
    expect(entry.tags).toEqual(["Impact Framing"]);
  });

  it("does not stamp a createdAt — that's left to the caller", () => {
    const entry = buildEvidenceEntryFromBrainstormIdea(idea, "Energy Policy", "Aff");
    expect(entry.createdAt).toBeUndefined();
  });
});

describe("buildBrainstormIdeaRankBadge", () => {
  it("labels rank 1 with a trophy", () => {
    expect(buildBrainstormIdeaRankBadge(1)).toBe("🏆 #1");
  });

  it("labels rank 2 with a silver medal", () => {
    expect(buildBrainstormIdeaRankBadge(2)).toBe("🥈 #2");
  });

  it("labels rank 3 with a bronze medal", () => {
    expect(buildBrainstormIdeaRankBadge(3)).toBe("🥉 #3");
  });

  it("labels every rank past 3 as a plain #N badge", () => {
    expect(buildBrainstormIdeaRankBadge(4)).toBe("#4");
    expect(buildBrainstormIdeaRankBadge(10)).toBe("#10");
  });

  it("throws on a zero or negative rank", () => {
    expect(() => buildBrainstormIdeaRankBadge(0)).toThrow();
    expect(() => buildBrainstormIdeaRankBadge(-1)).toThrow();
  });

  it("throws on a non-integer rank", () => {
    expect(() => buildBrainstormIdeaRankBadge(1.5)).toThrow();
  });
});
