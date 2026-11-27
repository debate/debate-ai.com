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
  it("shows the winner and ballots, then each judge under the team they voted for", () => {
    const html = render({ decision: known });
    expect(html).toContain("Harker LL (Aff)  2-1");
    expect(html).toContain("Results on College Debate Results");
    const aff = html.match(/data-testid="decision-judges-aff"[\s\S]*?<\/ul>/)?.[0] ?? "";
    const neg = html.match(/data-testid="decision-judges-neg"[\s\S]*?<\/ul>/)?.[0] ?? "";
    expect(aff).toContain("blue");
    expect(aff).toContain("Harker LL (Aff)");
    expect(aff).toContain("Ann Lee");
    expect(aff).toContain("Bo Kim");
    expect(aff).not.toContain("Cy Diaz");
    expect(neg).toContain("red");
    expect(neg).toContain("Gunn AB (Neg)");
    expect(neg).toContain("Cy Diaz*");
    expect(neg).not.toContain("Ann Lee");
    expect(html).not.toContain("decision-judges-unknown");
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

  it("lists a judge whose side the ballots don't say apart from the teams, never under one", () => {
    const html = render({
      decision: {
        ...known,
        judges: [
          { name: "Ann Lee", side: null, squirreled: false },
          { name: "Bo Kim", side: "neg", squirreled: false },
        ],
      },
    });
    const section = (side: string) => html.match(new RegExp(`data-testid="decision-judges-${side}"[\\s\\S]*?</ul>`))?.[0] ?? "";
    expect(section("unknown")).toContain("Ann Lee");
    expect(section("unknown")).toContain("side unknown");
    expect(section("aff")).not.toContain("Ann Lee");
    expect(section("neg")).not.toContain("Ann Lee");
    expect(section("neg")).toContain("Bo Kim");
  });

  it("shows no team columns when no judge's side is known", () => {
    const html = render({ decision: { ...known, judges: [{ name: "Ann Lee", side: null, squirreled: false }] } });
    expect(html).not.toContain("decision-judges-aff");
    expect(html).toContain("decision-judges-unknown");
  });
});
