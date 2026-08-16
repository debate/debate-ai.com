import { describe, expect, it } from "vitest";
import {
  buildCoachMaterialLibrary,
  buildCoachMaterialLibrarySummaryText,
  buildGroundedCoachPrompt,
  excerptMaterialText,
  findRelevantMaterials,
  scoreMaterialRelevance,
  type CoachMaterial,
} from "../src/coach/team-coach-materials";

const lecture: CoachMaterial = {
  id: "m1",
  kind: "lecture_transcript",
  title: "Topicality Basics",
  topic: "T",
  tags: ["theory"],
  text: "Topicality is a voting issue about whether the affirmative's plan is within the resolution.",
};

const camp: CoachMaterial = {
  id: "m2",
  kind: "camp_material",
  title: "Disad Link Chains",
  topic: "DA",
  tags: ["disad", "links"],
  text: "A strong disadvantage needs a clear, specific link chain from the plan to the impact.",
};

const instructional: CoachMaterial = {
  id: "m3",
  kind: "instructional_document",
  title: "Cross-Ex Etiquette",
  tags: ["cx"],
  text: "Stay respectful and stay on time during cross-examination.",
};

const recording: CoachMaterial = {
  id: "m4",
  kind: "practice_recording",
  title: "Scrimmage Round 3",
  topic: "T",
  tags: ["scrimmage"],
  text: "In this round the negative ran a topicality argument against the plan's mechanism.",
};

describe("buildCoachMaterialLibrary", () => {
  it("groups materials by kind in a stable, most-consulted-first order", () => {
    const library = buildCoachMaterialLibrary([recording, instructional, camp, lecture]);
    expect(library.totalMaterials).toBe(4);
    expect(library.groups.map((g) => g.kind)).toEqual([
      "lecture_transcript",
      "camp_material",
      "instructional_document",
      "practice_recording",
    ]);
    expect(library.groups.map((g) => g.materials.length)).toEqual([1, 1, 1, 1]);
  });

  it("omits kinds with no materials", () => {
    const library = buildCoachMaterialLibrary([camp]);
    expect(library.groups).toEqual([{ kind: "camp_material", materials: [camp] }]);
  });

  it("keeps multiple materials of the same kind together, in input order", () => {
    const secondLecture: CoachMaterial = { ...lecture, id: "m5", title: "Kritik Basics" };
    const library = buildCoachMaterialLibrary([lecture, secondLecture]);
    expect(library.groups).toEqual([
      { kind: "lecture_transcript", materials: [lecture, secondLecture] },
    ]);
  });

  it("returns an empty library for no materials", () => {
    expect(buildCoachMaterialLibrary([])).toEqual({ groups: [], totalMaterials: 0 });
  });
});

describe("scoreMaterialRelevance", () => {
  it("returns 0 for an empty query", () => {
    expect(scoreMaterialRelevance(lecture, "")).toBe(0);
    expect(scoreMaterialRelevance(lecture, "   ")).toBe(0);
  });

  it("returns 0 when no query tokens appear in the material", () => {
    expect(scoreMaterialRelevance(lecture, "photosynthesis biology")).toBe(0);
  });

  it("returns 1 when every query token appears in the material text", () => {
    expect(scoreMaterialRelevance(lecture, "topicality voting")).toBe(1);
  });

  it("matches tokens found in tags and title, not just body text", () => {
    expect(scoreMaterialRelevance(camp, "links")).toBe(1);
    expect(scoreMaterialRelevance(camp, "chains")).toBe(1);
  });

  it("returns a fractional score for partial overlap", () => {
    expect(scoreMaterialRelevance(lecture, "topicality xylophone")).toBeCloseTo(0.5);
  });
});

describe("findRelevantMaterials", () => {
  const materials = [lecture, camp, instructional, recording];

  it("ranks matches by relevance, most relevant first", () => {
    const matches = findRelevantMaterials(materials, "topicality plan resolution");
    expect(matches[0].material.id).toBe("m1");
    expect(matches.every((m) => m.relevance > 0)).toBe(true);
  });

  it("excludes materials with no overlap by default", () => {
    const matches = findRelevantMaterials(materials, "topicality");
    expect(matches.map((m) => m.material.id)).not.toContain("m2");
    expect(matches.map((m) => m.material.id)).not.toContain("m3");
  });

  it("breaks relevance ties alphabetically by title", () => {
    const a: CoachMaterial = { ...lecture, id: "a", title: "Zebra Topicality", tags: [] };
    const b: CoachMaterial = { ...lecture, id: "b", title: "Alpha Topicality", tags: [] };
    const matches = findRelevantMaterials([a, b], "topicality");
    expect(matches.map((m) => m.material.id)).toEqual(["b", "a"]);
  });

  it("scopes results to a topic when provided", () => {
    const matches = findRelevantMaterials(materials, "topicality plan", { topic: "T" });
    expect(matches.map((m) => m.material.id).sort()).toEqual(["m1", "m4"]);
  });

  it("caps results at the given limit", () => {
    const matches = findRelevantMaterials(materials, "topicality plan resolution voting", { limit: 1 });
    expect(matches).toHaveLength(1);
  });

  it("honors a higher minRelevance threshold", () => {
    const matches = findRelevantMaterials(materials, "topicality voting", { minRelevance: 0.9 });
    expect(matches.map((m) => m.material.id)).toEqual(["m1"]);
  });
});

describe("excerptMaterialText", () => {
  it("returns trimmed text unchanged when within the max length", () => {
    expect(excerptMaterialText("  short text  ", 320)).toBe("short text");
  });

  it("does not truncate text exactly at the max length", () => {
    const text = "a".repeat(10);
    expect(excerptMaterialText(text, 10)).toBe(text);
  });

  it("truncates and appends an ellipsis past the max length", () => {
    const text = "a".repeat(11);
    const result = excerptMaterialText(text, 10);
    expect(result).toBe(`${"a".repeat(10)}…`);
  });

  it("uses the default max length when none is given", () => {
    const text = "a".repeat(500);
    expect(excerptMaterialText(text).length).toBe(321);
  });
});

describe("buildGroundedCoachPrompt", () => {
  it("states there were no matches when none are given", () => {
    const prompt = buildGroundedCoachPrompt("What is topicality?", []);
    expect(prompt).toContain("Question: What is topicality?");
    expect(prompt).toContain("Grounding materials: none matched this question.");
  });

  it("lists matches most-relevant-first with kind, title, and topic", () => {
    const prompt = buildGroundedCoachPrompt("What is topicality?", [
      { material: lecture, relevance: 1 },
      { material: recording, relevance: 0.5 },
    ]);
    const lectureIndex = prompt.indexOf("Lecture Transcript");
    const recordingIndex = prompt.indexOf("Practice-Round Recording");
    expect(lectureIndex).toBeGreaterThan(-1);
    expect(recordingIndex).toBeGreaterThan(lectureIndex);
    expect(prompt).toContain("(topic: T)");
    expect(prompt).toContain(lecture.text);
  });

  it("omits the topic suffix for materials with no topic", () => {
    const prompt = buildGroundedCoachPrompt("Cross-ex tips?", [{ material: instructional, relevance: 1 }]);
    expect(prompt).toContain("Cross-Ex Etiquette");
    expect(prompt).not.toContain("(topic:");
  });

  it("truncates a long excerpt using the given excerptLength", () => {
    const longMaterial: CoachMaterial = { ...lecture, text: "word ".repeat(200) };
    const prompt = buildGroundedCoachPrompt("topicality", [{ material: longMaterial, relevance: 1 }], {
      excerptLength: 20,
    });
    expect(prompt).toContain("…");
  });
});

describe("buildCoachMaterialLibrarySummaryText", () => {
  it("reports an empty library", () => {
    expect(buildCoachMaterialLibrarySummaryText({ groups: [], totalMaterials: 0 })).toBe(
      "No coach materials uploaded yet.",
    );
  });

  it("summarizes counts per kind, pluralizing correctly", () => {
    const library = buildCoachMaterialLibrary([lecture, camp, recording]);
    const summary = buildCoachMaterialLibrarySummaryText(library);
    expect(summary).toContain("Team coach library: 3 materials.");
    expect(summary).toContain("- Lecture Transcript: 1");
    expect(summary).toContain("- Camp Material: 1");
    expect(summary).toContain("- Practice-Round Recording: 1");
  });

  it("uses singular material wording for exactly one material", () => {
    const library = buildCoachMaterialLibrary([lecture]);
    expect(buildCoachMaterialLibrarySummaryText(library)).toContain("Team coach library: 1 material.");
  });
});
