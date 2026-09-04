import { describe, expect, it } from "vitest";
import {
  approveCoachMaterial,
  buildCoachConversationMessages,
  buildCoachMaterialLibrary,
  buildCoachMaterialLibrarySummaryText,
  buildGroundedCoachPrompt,
  COACH_MATERIAL_KIND_LABELS,
  COACH_MATERIAL_KIND_ORDER,
  COACH_MATERIAL_STATUS_LABELS,
  COACH_MATERIAL_STATUSES,
  excerptMaterialText,
  filterApprovedCoachMaterials,
  filterCoachMaterials,
  filterPendingCoachMaterials,
  findRelevantMaterials,
  isCoachMaterialApproved,
  listCoachMaterialTags,
  rejectCoachMaterial,
  reviewCoachMaterial,
  scoreMaterialRelevance,
  type CoachConversationTurn,
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

function turn(question: string, answer: string): CoachConversationTurn {
  return { id: `${question}-turn`, question, answer, askedAt: 0 };
}

describe("buildCoachConversationMessages", () => {
  it("returns a single user turn (the grounded prompt) when there is no history", () => {
    const messages = buildCoachConversationMessages("What is topicality?", [{ material: lecture, relevance: 1 }]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      role: "user",
      content: buildGroundedCoachPrompt("What is topicality?", [{ material: lecture, relevance: 1 }]),
    });
  });

  it("prepends history as alternating user/assistant turns before the grounded prompt", () => {
    const history = [turn("What is topicality?", "It's a voting issue about the resolution.")];
    const messages = buildCoachConversationMessages(
      "What about a counter-interpretation?",
      [{ material: lecture, relevance: 1 }],
      history,
    );

    expect(messages).toEqual([
      { role: "user", content: "What is topicality?" },
      { role: "assistant", content: "It's a voting issue about the resolution." },
      {
        role: "user",
        content: buildGroundedCoachPrompt("What about a counter-interpretation?", [
          { material: lecture, relevance: 1 },
        ]),
      },
    ]);
  });

  it("caps history at maxHistoryTurns, keeping the most recent turns", () => {
    const history = [turn("Q1", "A1"), turn("Q2", "A2"), turn("Q3", "A3")];
    const messages = buildCoachConversationMessages("Q4", [], history, { maxHistoryTurns: 1 });

    expect(messages).toEqual([
      { role: "user", content: "Q3" },
      { role: "assistant", content: "A3" },
      { role: "user", content: expect.stringContaining("Question: Q4") },
    ]);
  });

  it("omits history entirely when maxHistoryTurns is 0", () => {
    const history = [turn("Q1", "A1")];
    const messages = buildCoachConversationMessages("Q2", [], history, { maxHistoryTurns: 0 });
    expect(messages).toHaveLength(1);
  });

  it("passes excerptLength through to the final grounded-prompt turn", () => {
    const longMaterial: CoachMaterial = { ...lecture, text: "word ".repeat(200) };
    const messages = buildCoachConversationMessages("topicality", [{ material: longMaterial, relevance: 1 }], [], {
      excerptLength: 20,
    });
    expect(messages[0]?.content).toContain("…");
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

describe("listCoachMaterialTags", () => {
  it("returns an empty list for no materials", () => {
    expect(listCoachMaterialTags([])).toEqual([]);
  });

  it("collects every distinct tag across materials, alphabetically sorted", () => {
    expect(listCoachMaterialTags([lecture, camp, instructional, recording])).toEqual([
      "cx",
      "disad",
      "links",
      "scrimmage",
      "theory",
    ]);
  });

  it("de-duplicates a tag shared by multiple materials", () => {
    const secondLecture: CoachMaterial = { ...lecture, id: "m5", tags: ["theory", "t"] };
    expect(listCoachMaterialTags([lecture, secondLecture])).toEqual(["t", "theory"]);
  });
});

describe("filterCoachMaterials", () => {
  const materials = [lecture, camp, instructional, recording];

  it("returns every material unchanged when no filter is given", () => {
    expect(filterCoachMaterials(materials)).toEqual(materials);
  });

  it("matches a keyword against the title", () => {
    expect(filterCoachMaterials(materials, { query: "Etiquette" })).toEqual([instructional]);
  });

  it("matches a keyword against the topic", () => {
    expect(filterCoachMaterials(materials, { query: "DA" }).map((m) => m.id)).toEqual(["m2"]);
  });

  it("matches a keyword against a tag", () => {
    expect(filterCoachMaterials(materials, { query: "scrimmage" }).map((m) => m.id)).toEqual(["m4"]);
  });

  it("matches a keyword against the body text", () => {
    expect(filterCoachMaterials(materials, { query: "cross-examination" }).map((m) => m.id)).toEqual(["m3"]);
  });

  it("is case-insensitive", () => {
    expect(filterCoachMaterials(materials, { query: "TOPICALITY BASICS" }).map((m) => m.id)).toEqual(["m1"]);
  });

  it("trims whitespace and treats a blank query as no filter", () => {
    expect(filterCoachMaterials(materials, { query: "   " })).toEqual(materials);
  });

  it("restricts to an exact tag match", () => {
    expect(filterCoachMaterials(materials, { tag: "disad" }).map((m) => m.id)).toEqual(["m2"]);
  });

  it("combines a tag filter and a keyword search", () => {
    expect(filterCoachMaterials(materials, { tag: "theory", query: "voting" }).map((m) => m.id)).toEqual(["m1"]);
    expect(filterCoachMaterials(materials, { tag: "theory", query: "disad" })).toEqual([]);
  });

  it("returns no materials for a tag nothing carries", () => {
    expect(filterCoachMaterials(materials, { tag: "nonexistent" })).toEqual([]);
  });
});

describe("COACH_MATERIAL_KIND_LABELS", () => {
  it("has a label for every kind in COACH_MATERIAL_KIND_ORDER", () => {
    for (const kind of COACH_MATERIAL_KIND_ORDER) {
      expect(COACH_MATERIAL_KIND_LABELS[kind]).toBeTruthy();
    }
  });
});

describe("COACH_MATERIAL_STATUS_LABELS", () => {
  it("has a label for every status in COACH_MATERIAL_STATUSES", () => {
    for (const status of COACH_MATERIAL_STATUSES) {
      expect(COACH_MATERIAL_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("isCoachMaterialApproved", () => {
  it("treats a material with no status field as approved (pre-review-workflow default)", () => {
    expect(isCoachMaterialApproved(lecture)).toBe(true);
  });

  it("treats an explicitly approved material as approved", () => {
    expect(isCoachMaterialApproved({ ...lecture, status: "approved" })).toBe(true);
  });

  it("treats a pending material as not approved", () => {
    expect(isCoachMaterialApproved({ ...lecture, status: "pending" })).toBe(false);
  });

  it("treats a rejected material as not approved", () => {
    expect(isCoachMaterialApproved({ ...lecture, status: "rejected" })).toBe(false);
  });
});

describe("filterApprovedCoachMaterials", () => {
  it("keeps materials with no status or an approved status, drops pending and rejected", () => {
    const pool: CoachMaterial[] = [
      lecture,
      { ...camp, status: "approved" },
      { ...instructional, status: "pending" },
      { ...recording, status: "rejected" },
    ];
    expect(filterApprovedCoachMaterials(pool).map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});

describe("filterPendingCoachMaterials", () => {
  it("keeps only materials with a pending status", () => {
    const pool: CoachMaterial[] = [
      lecture,
      { ...camp, status: "approved" },
      { ...instructional, status: "pending" },
      { ...recording, status: "rejected" },
    ];
    expect(filterPendingCoachMaterials(pool).map((m) => m.id)).toEqual(["m3"]);
  });

  it("returns an empty list when nothing is pending", () => {
    expect(filterPendingCoachMaterials([lecture, { ...camp, status: "approved" }])).toEqual([]);
  });
});

describe("reviewCoachMaterial/approveCoachMaterial/rejectCoachMaterial", () => {
  it("approveCoachMaterial stamps status, reviewer, and a timestamp", () => {
    const before = Date.now();
    const reviewed = approveCoachMaterial({ ...lecture, status: "pending" }, "Coach K");
    expect(reviewed.status).toBe("approved");
    expect(reviewed.reviewedBy).toBe("Coach K");
    expect(reviewed.reviewedAt).toBeGreaterThanOrEqual(before);
  });

  it("rejectCoachMaterial stamps status, reviewer, and an optional note", () => {
    const reviewed = rejectCoachMaterial({ ...lecture, status: "pending" }, "Coach K", "Needs a source citation");
    expect(reviewed.status).toBe("rejected");
    expect(reviewed.reviewedBy).toBe("Coach K");
    expect(reviewed.reviewNote).toBe("Needs a source citation");
  });

  it("rejectCoachMaterial without a note leaves reviewNote undefined", () => {
    const reviewed = rejectCoachMaterial({ ...lecture, status: "pending" }, "Coach K");
    expect(reviewed.reviewNote).toBeUndefined();
  });

  it("is pure — it returns a new object rather than mutating the input", () => {
    const original: CoachMaterial = { ...lecture, status: "pending" };
    const reviewed = reviewCoachMaterial(original, "approved", "Coach K");
    expect(original.status).toBe("pending");
    expect(reviewed).not.toBe(original);
  });

  it("approveCoachMaterial and rejectCoachMaterial delegate to reviewCoachMaterial", () => {
    const base: CoachMaterial = { ...lecture, status: "pending" };
    const viaApprove = approveCoachMaterial(base, "Coach K");
    const viaReview = reviewCoachMaterial(base, "approved", "Coach K");
    expect(viaApprove.status).toBe(viaReview.status);
    expect(viaApprove.reviewedBy).toBe(viaReview.reviewedBy);

    const viaReject = rejectCoachMaterial(base, "Coach K", "note");
    const viaReviewReject = reviewCoachMaterial(base, "rejected", "Coach K", "note");
    expect(viaReject.status).toBe(viaReviewReject.status);
    expect(viaReject.reviewNote).toBe(viaReviewReject.reviewNote);
  });
});
