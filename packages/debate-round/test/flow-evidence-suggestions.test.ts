import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVIDENCE_SUGGESTION_LIMIT,
  appendEvidenceToContent,
  suggestEvidenceForBoxContent,
} from "../src/flow/flow-evidence-suggestions";
import type { EvidenceLibraryEntry } from "debate-card-search/src/lib/shared-evidence-library";

function entry(overrides: Partial<EvidenceLibraryEntry> = {}): EvidenceLibraryEntry {
  return {
    id: "warming-1",
    argBlock: "Warming DA",
    wordCount: 250,
    topic: "Energy",
    caseArea: "DA",
    tags: ["climate"],
    kind: "card",
    text: "Rising global temperatures accelerate extreme weather and sea level rise.",
    cite: "Smith 24",
    ...overrides,
  };
}

describe("suggestEvidenceForBoxContent", () => {
  it("ranks the shared corpus by keyword overlap against the box's in-progress content", () => {
    const entries = [
      entry({ id: "warming-1", text: "Rising temperatures accelerate extreme weather events." }),
      entry({ id: "states-1", argBlock: "States CP", text: "States can tailor energy policy locally.", cite: "" }),
    ];

    const results = suggestEvidenceForBoxContent(entries, "extreme weather temperatures");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.entry.id).toBe("warming-1");
  });

  it("returns no suggestions for blank or whitespace-only content", () => {
    const entries = [entry()];

    expect(suggestEvidenceForBoxContent(entries, "")).toEqual([]);
    expect(suggestEvidenceForBoxContent(entries, "   ")).toEqual([]);
  });

  it("returns no suggestions against an empty corpus", () => {
    expect(suggestEvidenceForBoxContent([], "rising temperatures")).toEqual([]);
  });

  it("caps results at the given limit, defaulting to DEFAULT_EVIDENCE_SUGGESTION_LIMIT", () => {
    const entries = Array.from({ length: DEFAULT_EVIDENCE_SUGGESTION_LIMIT + 5 }, (_, i) =>
      entry({ id: `warming-${i}`, text: `Rising temperatures cause extreme weather event ${i}.` }),
    );

    expect(suggestEvidenceForBoxContent(entries, "rising temperatures extreme weather").length).toBe(
      DEFAULT_EVIDENCE_SUGGESTION_LIMIT,
    );
    expect(suggestEvidenceForBoxContent(entries, "rising temperatures extreme weather", 2).length).toBe(2);
  });

  it("excludes entries with zero keyword overlap, matching searchEvidenceLibrary", () => {
    const entries = [entry({ text: "Unrelated content about federalism.", argBlock: "States CP", cite: "" })];

    expect(suggestEvidenceForBoxContent(entries, "warming emissions extinction")).toEqual([]);
  });
});

describe("appendEvidenceToContent", () => {
  it("appends the entry's text and citation on a new paragraph when content already has text", () => {
    const result = appendEvidenceToContent("The plan solves warming.", entry());
    expect(result).toBe(
      "The plan solves warming.\n\nRising global temperatures accelerate extreme weather and sea level rise. (Smith 24)",
    );
  });

  it("returns just the snippet plus citation when starting content is blank", () => {
    const result = appendEvidenceToContent("   ", entry());
    expect(result).toBe("Rising global temperatures accelerate extreme weather and sea level rise. (Smith 24)");
  });

  it("omits the parenthetical citation for an entry with a blank cite (e.g. a reusable block)", () => {
    const result = appendEvidenceToContent("", entry({ cite: "", text: "States are better positioned locally." }));
    expect(result).toBe("States are better positioned locally.");
  });

  it("falls back to the argument-block label when a block entry has no cut text", () => {
    const result = appendEvidenceToContent("", entry({ text: "", cite: "", argBlock: "States CP" }));
    expect(result).toBe("States CP");
  });
});
