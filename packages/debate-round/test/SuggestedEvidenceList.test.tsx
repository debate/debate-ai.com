/**
 * Render test for `SuggestedEvidenceList`, the follow-up (c) affordance
 * added for idea #16 in TODO.md. As in `EditBadge.test.tsx`, the Vitest
 * environment is `node`, so this renders through `react-dom/server` and
 * asserts on the markup — the component is pure/props-driven.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SuggestedEvidenceList } from "../src/flow/SuggestedEvidenceList";
import type { EvidenceLibraryEntry, EvidenceSearchResult } from "debate-card-search/src/lib/shared-evidence-library";

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

function result(overrides: Partial<EvidenceSearchResult> = {}): EvidenceSearchResult {
  return { entry: entry(), relevanceScore: 42, ...overrides };
}

describe("SuggestedEvidenceList", () => {
  it("renders nothing when there are no results", () => {
    const markup = renderToStaticMarkup(<SuggestedEvidenceList results={[]} onInsert={() => {}} />);
    expect(markup).toBe("");
  });

  it("renders each result's argument block, citation, and an Insert action", () => {
    const markup = renderToStaticMarkup(
      <SuggestedEvidenceList
        results={[result({ entry: entry({ argBlock: "Warming DA", cite: "Smith 24" }) })]}
        onInsert={() => {}}
      />,
    );

    expect(markup).toContain("Suggested evidence");
    expect(markup).toContain("Warming DA");
    expect(markup).toContain("(Smith 24)");
    expect(markup).toContain("Insert");
  });

  it("omits the parenthetical citation for an entry with a blank cite", () => {
    const markup = renderToStaticMarkup(
      <SuggestedEvidenceList results={[result({ entry: entry({ cite: "" }) })]} onInsert={() => {}} />,
    );
    expect(markup).not.toContain("()");
  });

  it("renders one list item per result", () => {
    const markup = renderToStaticMarkup(
      <SuggestedEvidenceList
        results={[
          result({ entry: entry({ id: "warming-1", argBlock: "Warming DA" }) }),
          result({ entry: entry({ id: "states-1", argBlock: "States CP", cite: "" }) }),
        ]}
        onInsert={() => {}}
      />,
    );

    expect(markup.match(/<li/g)?.length).toBe(2);
    expect(markup).toContain("States CP");
  });
});
