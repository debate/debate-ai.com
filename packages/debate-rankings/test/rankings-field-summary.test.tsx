import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { RankingDataset } from "../src/types";

vi.mock("../data/championship-side-bias.json", () => ({
  default: {
    generatedAt: "2026-05-01T00:00:00.000Z",
    records: [
      { format: "pf", year: 2025, tabroomId: 34644, rounds: 100, affWins: 55, elimRounds: 20, elimAffWins: 8 },
      { format: "college", year: 2024, tabroomId: 30785, rounds: 40, affWins: 20, elimRounds: 10, elimAffWins: 5 },
    ],
  },
}));

const { RankingsFieldSummary } = await import("../src/leaderboard/RankingsFieldSummary");

const dataset = (id: RankingDataset["id"], seasonYear?: number): RankingDataset =>
  ({ id, label: id, tournaments: [], majors: [], entries: [], field: null, seasonYear }) as RankingDataset;

const render = (ds: RankingDataset, seasonYear?: number) =>
  renderToStaticMarkup(createElement(RankingsFieldSummary, { dataset: ds, seasonYear }));

describe("RankingsFieldSummary championship side bias", () => {
  it("shows the season's championship bias, PF as pro/con, when data exists", () => {
    const html = render(dataset("hspf", 2025), 2025);
    expect(html).toContain("championship-side-bias");
    expect(html).toContain("TOC 2025 side bias");
    expect(html).toContain("Pro Bias +5");
    expect(html).toContain("Con Elims Bias +10");
  });

  it("labels the college card with the NDT and uses aff/neg", () => {
    const html = render(dataset("cpd", 2024), 2024);
    expect(html).toContain("NDT 2024 side bias");
    expect(html).toContain("No Bias");
    expect(html).toContain("No Elims Bias");
  });

  it("shows nothing for a season or format without data", () => {
    expect(render(dataset("hspf", 2023), 2023)).not.toContain("championship-side-bias");
    expect(render(dataset("hsld", 2025), 2025)).not.toContain("championship-side-bias");
    expect(render(dataset("hsld_sepoct", 2025), 2025)).not.toContain("championship-side-bias");
  });
});
