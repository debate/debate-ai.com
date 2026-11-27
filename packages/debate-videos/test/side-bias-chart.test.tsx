import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SideBiasChart } from "../src/components/topic-explorer/SideBiasChart";
import { sideBiasSeries } from "@debate-ai/rankings/src/side-bias";

const series = sideBiasSeries(2026, {
  generatedAt: "2026-05-01T00:00:00.000Z",
  records: [
    { format: "pf", year: 2025, tabroomId: 34644, rounds: 100, affWins: 48, elimRounds: 20, elimAffWins: 12 },
    { format: "pf", year: 2026, tabroomId: 36156, rounds: 100, affWins: 52, elimRounds: 20, elimAffWins: 8 },
    { format: "college", year: 2026, tabroomId: 39306, rounds: 50, affWins: 30, elimRounds: 10, elimAffWins: 6 },
  ],
});

describe("SideBiasChart", () => {
  it("lists every format with its average and the seasons covered", () => {
    const html = renderToStaticMarkup(createElement(SideBiasChart, { series }));
    for (const label of ["Public Forum", "Lincoln-Douglas", "HS Policy", "College Policy"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("2025–2026 (2)");
    expect(html).toContain("50.0%");
    expect(html).toContain("60.0%");
    expect(html).toContain("Side bias avg");
    expect(html).toContain("Elim side bias avg");
    expect(html).not.toContain("nothing to chart");
  });

  it("says nothing was synced when no format has a season", () => {
    const html = renderToStaticMarkup(
      createElement(SideBiasChart, { series: sideBiasSeries(2026, { generatedAt: null, records: [] }) }),
    );
    expect(html).toContain("nothing to chart");
    expect(html).toContain("Public Forum");
  });
});
