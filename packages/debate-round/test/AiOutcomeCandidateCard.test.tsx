/**
 * Fallacy hints on the AI Outcome Responses candidate cards. Vitest runs in
 * `node`, so this asserts on `react-dom/server` markup.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SpeechOutcomeCandidate } from "@debate-ai/speech-writer";

import { CandidateCard } from "../src/dialogs/AiOutcomeResponsesDialog";

function candidate(outline: string[]): SpeechOutcomeCandidate {
  return {
    title: "Collapse to the DA",
    strategy: "Go for the disad.",
    outline,
    cardSearches: [],
    opponentAnswers: [],
    judgeDecision: { winner: "aff", rationale: "Clear link." },
    issues: [],
    successRate: 60,
  };
}

describe("CandidateCard fallacy hints", () => {
  it("flags fallacy phrasing in the outline", () => {
    const html = renderToStaticMarkup(
      <CandidateCard
        candidate={candidate(["Either we ban it or the economy collapses", "Extend the link"])}
        index={0}
        recommended={false}
        side="aff"
      />,
    );
    expect(html).toContain('data-testid="fallacy-hints"');
    expect(html).toContain("False dichotomy");
  });

  it("adds no hints block for a clean outline", () => {
    const html = renderToStaticMarkup(
      <CandidateCard candidate={candidate(["Extend the link", "Impact the turn"])} index={0} recommended={false} side="aff" />,
    );
    expect(html).not.toContain("fallacy-hints");
  });
});
