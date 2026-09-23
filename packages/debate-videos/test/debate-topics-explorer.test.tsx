/**
 * @fileoverview Guards the `/videos/statistics` topics grid: it must sort
 * newest-year-first, show every style's resolution as its own badged line,
 * skip a style with no resolution for that year, and tell a genuinely empty
 * catalog apart from a search with no matches. `entryMatches` (the filter
 * predicate) gets its own unit test since a search box's live filtering
 * can't be driven through `renderToStaticMarkup`.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DebateTopicsExplorer, entryMatches, matchesStyleFilter } from "../src/components/topic-explorer/DebateTopicsExplorer";
import type { DebateTopicYear } from "../src/lib/debate-topics";

const TOPICS: DebateTopicYear[] = [
  {
    year: 2023,
    policy_topic_name: "Water",
    policy_topic: "The United States federal government should substantially increase its investment in water infrastructure.",
    ndt_topic_name: "Water",
    ndt_topic: "Resolved: water infrastructure.",
    ld_topics: [{ start_month: "Sep/Oct", topic_name: "Civil Disobedience", emoji: "✊", topic: "Resolved: civil disobedience is justified." }],
    pf_topics: [{ start_month: "Sep", topic: "Climate change policy." }],
  },
  {
    year: 2024,
    policy_topic_name: "Healthcare",
    policy_topic: "The United States federal government should substantially expand its provision of healthcare.",
    // No LD/PF/NDT resolution recorded for this year.
  },
];

function render(props: Partial<Parameters<typeof DebateTopicsExplorer>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(DebateTopicsExplorer, { topics: TOPICS, ...props }),
  );
}

describe("DebateTopicsExplorer", () => {
  it("lists every year, newest first", () => {
    const html = render();
    expect(html.indexOf("2024")).toBeLessThan(html.indexOf("2023"));
  });

  it("shows a badged line per style that has a resolution, and skips the rest", () => {
    const html = render();
    expect(html).toContain("Policy");
    expect(html).toContain("water infrastructure");
    expect(html).toContain("LD");
    expect(html).toContain("civil disobedience");
    expect(html).toContain("PF");
    expect(html).toContain("Climate change policy");
    // 2024 has no LD/PF/College resolution — its card carries Policy only.
    // (Both years share the "Policy" badge text, so this only pins the
    // count, not which year it belongs to.) One more ">Policy<" comes from
    // the style filter row's own "Policy" button, hence 3 rather than 2.
    expect(html.match(/>Policy</g)?.length).toBe(3);
  });

  it("shows each topic's icon and short title before its resolution", () => {
    const html = render();
    expect(html).toContain("✊");
    expect(html).toContain("Civil Disobedience");
    expect(html.indexOf("Civil Disobedience")).toBeLessThan(html.indexOf("civil disobedience is justified"));
  });

  it("reports a genuinely empty catalog", () => {
    const html = render({ topics: [] });
    expect(html).toContain("No debate topics are available yet.");
  });

  it("reports still-loading separately from empty", () => {
    const html = render({ topics: undefined });
    expect(html).toContain("Loading topics…");
    expect(html).not.toContain("No debate topics are available yet.");
  });

  it("renders an All/Policy/College (NDT)/LD/PF style filter row with All active by default", () => {
    const html = render();
    expect(html).toContain(">All<");
    expect(html).toContain(">College<");
    // "All" is the only pressed toggle on first render.
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
  });
});

describe("entryMatches", () => {
  const entry = TOPICS[0]!;

  it("matches on the year", () => {
    expect(entryMatches(entry, "2023")).toBe(true);
    expect(entryMatches(entry, "1999")).toBe(false);
  });

  it("matches on any style's resolution text against a lowercased term", () => {
    // The caller (`DebateTopicsExplorer`) lowercases the typed search term
    // before calling this — `entryMatches` only lowercases the entry's own
    // text, so a mixed-case source resolution still matches a lowercase term.
    expect(entryMatches(entry, "water infrastructure")).toBe(true);
    expect(entryMatches(entry, "civil disobedience")).toBe(true);
    expect(entryMatches(entry, "climate change")).toBe(true);
  });

  it("matches on a topic's short title", () => {
    expect(entryMatches({ year: 2020, ld_topics: [{ topic_name: "Predictive Policing", topic: "It is unjust." }] }, "predictive")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(entryMatches(entry, "kritik")).toBe(false);
  });

  it("scopes matching to the given styles when a style list is passed", () => {
    // Policy-only (style 1): the LD/PF text on the same entry no longer matches.
    expect(entryMatches(entry, "civil disobedience", [1])).toBe(false);
    expect(entryMatches(entry, "water infrastructure", [1])).toBe(true);
    // The year itself still matches regardless of which styles are scoped in.
    expect(entryMatches(entry, "2023", [1])).toBe(true);
  });
});

describe("matchesStyleFilter", () => {
  const [entryWithEverything, policyOnlyEntry] = TOPICS as [DebateTopicYear, DebateTopicYear];

  it("always matches when the filter is \"all\"", () => {
    expect(matchesStyleFilter(entryWithEverything, "all")).toBe(true);
    expect(matchesStyleFilter(policyOnlyEntry, "all")).toBe(true);
  });

  it("matches a real style only when the entry has a resolution for it", () => {
    expect(matchesStyleFilter(entryWithEverything, 1)).toBe(true); // Policy
    expect(matchesStyleFilter(entryWithEverything, 3)).toBe(true); // LD
    // 2024 (`policyOnlyEntry`) has no LD/PF/College resolution recorded.
    expect(matchesStyleFilter(policyOnlyEntry, 1)).toBe(true); // Policy
    expect(matchesStyleFilter(policyOnlyEntry, 3)).toBe(false); // LD
    expect(matchesStyleFilter(policyOnlyEntry, 2)).toBe(false); // PF
    expect(matchesStyleFilter(policyOnlyEntry, 4)).toBe(false); // College
  });
});
