/**
 * @fileoverview The revealed decision panel: overall decision, each judge's
 * vote underneath, and "?" when the round's result is unknown.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { WatchDecision } from "../src/components/videos/watch/WatchDecision";
import { UNKNOWN_DECISION, type RoundDecision } from "../src/lib/round-decision";

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(WatchDecision, { affTeam: "Harker LL", negTeam: "Gunn AB", decision: UNKNOWN_DECISION, loading: false, ...props } as never),
  );

const known: RoundDecision = {
  status: "known",
  source: "college-debate-results",
  affWin: true,
  decision: "2-1",
  judges: [
    { name: "Ann Lee", side: "aff", squirreled: false },
    { name: "Bo Kim", side: "aff", squirreled: false },
    { name: "Cy Diaz", side: "neg", squirreled: true },
  ],
  url: "https://collegedebateresults.vercel.app/tournament/1",
};

describe("WatchDecision", () => {
  it("shows the winner and ballots, then each judge with the side they voted for", () => {
    const html = render({ decision: known });
    expect(html).toContain("Harker LL (Aff)  2-1");
    expect(html).toContain('data-side="aff"');
    expect(html).toContain("Cy Diaz");
    expect(html).toContain("Gunn AB (Neg)*");
    expect(html).toContain("Results on College Debate Results");
  });

  it("shows ? for a round with no findable result", () => {
    const html = render({});
    expect(html).toContain('data-testid="decision-unknown"');
    expect(html).toContain("?");
    expect(html).not.toContain("decision-summary");
    expect(html).not.toContain("Error");
  });

  it("shows a progress line while looking up, but not for a stored decision", () => {
    expect(render({ loading: true })).toContain("Looking up the decision");
    const stored = render({ loading: true, storedAffWin: false, storedDecision: "3-0 Neg" });
    expect(stored).toContain("Gunn AB (Neg)  3-0");
    expect(stored).not.toContain("Looking up");
  });

  it("leaves a judge's side as ? when the ballots don't say", () => {
    const html = render({ decision: { ...known, judges: [{ name: "Ann Lee", side: null, squirreled: false }] } });
    expect(html).toContain('data-side="unknown"');
  });
});
