// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history";
import {
  buildNdtAllSeasons,
  cleanTeamName,
  ndtEraWeight,
  ndtTeamKey,
  rowRanks,
} from "../src/leaderboard/profile/ndtAllSeasons";
import { NdtAllSeasonsButton } from "../src/leaderboard/profile/NdtAllSeasonsDialog";
import history from "../data/ndt-school-history.json";
import { click, mount, type Mounted } from "./helpers/mount";

const school = (name: string, extra: Partial<NdtSchoolHistory> = {}): NdtSchoolHistory => ({
  school: name,
  years: [],
  elims: [],
  championships: [],
  atLargeBids: [],
  copelandWinners: [],
  speakerAwards: [],
  coachingAwards: [],
  ...extra,
});

const sample = [
  school("Georgetown University (DC)", {
    elims: [
      { year: 2012, team: "Andrew Arsht & Andrew Markoff", round: "Semis" },
      { year: 2013, team: "Andrew Arsht & Andrew Markoff", round: "Quarters" },
      { year: 2013, team: "Other One & Other Two", round: "Doubles" },
    ],
    championships: [{ year: 2012, team: "Andrew Arsht & Andrew Markoff" }],
    atLargeBids: [{ year: 2013, team: "Andrew Markoff & Andrew Arsht (Rank: 1 )" }],
    copelandWinners: [{ year: 2013, team: "Andrew Arsht & Andrew Markoff" }],
    speakerAwards: [
      { year: 2013, speaker: "Andrew Markoff", rank: 1 },
      { year: 2013, speaker: "Nobody Listed", rank: 8 },
    ],
  }),
  school("Harvard University (MA)", {
    championships: [{ year: 2016, team: "David Herman & Hemanth Sanjeev" }],
    elims: [{ year: 2017, team: "Ayush Midha & Hemanth Sanjeev", round: "Finals" }],
  }),
  school("Never Broke College", { years: [2000] }),
];

/** The sample's latest NDT is 2017, so 2017 counts 1×. */
const w = (year: number) => ndtEraWeight(year, 2017);
const r1 = (value: number) => Math.round(value * 10) / 10;
const georgetownTotal = r1(30 * w(2012) + (8 + 12 + 4 + 10 + 3 + 3) * w(2013));

describe("ndtEraWeight", () => {
  it("counts the latest NDT in full and each older season 2.5% less, compounding", () => {
    expect(ndtEraWeight(2025, 2025)).toBe(1);
    expect(ndtEraWeight(2024, 2025)).toBeCloseTo(1 / 1.025, 6);
    expect(ndtEraWeight(2015, 2025)).toBeCloseTo(0.781, 3);
    expect(ndtEraWeight(2000, 2025)).toBeCloseTo(0.539, 3);
  });

  it("multiplies results before 2000 by 0.3", () => {
    expect(ndtEraWeight(1999, 2025)).toBeCloseTo(0.3 * Math.pow(1.025, -26), 6);
    expect(ndtEraWeight(1999, 2025) / ndtEraWeight(2000, 2025)).toBeCloseTo(0.3 / 1.025, 6);
  });
});

describe("buildNdtAllSeasons", () => {
  const table = buildNdtAllSeasons(sample, []);

  it("keys a pair the same whichever order the names come in", () => {
    expect(ndtTeamKey("X", "A B & C D")).toBe(ndtTeamKey("X", "C D & A B (Rank: 3 )"));
    expect(cleanTeamName("Kieran Lawless & Zidao Wang (Rank: 11 )")).toBe("Kieran Lawless & Zidao Wang");
  });

  it("scores elims by deepest round, Copeland, bids and team speakers", () => {
    const markoff = table.teams[0];
    expect(markoff.team).toBe("Andrew Arsht & Andrew Markoff");
    // 2012: champion 30 (not semis too); 2013: quarters 8; Copeland 12; bid 4; top speaker 10 — each season weighted.
    expect(markoff.parts).toEqual({
      elims: r1(30 * w(2012) + 8 * w(2013)),
      copeland: r1(12 * w(2013)),
      bids: r1(4 * w(2013)),
      speakers: r1(10 * w(2013)),
      partners: 0,
      highSchool: 0,
    });
    expect(markoff.total).toBe(r1(30 * w(2012) + 34 * w(2013)));
    expect(markoff.counts).toMatchObject({ titles: 1, elims: 2, copeland: 1, bids: 1, speakerAwards: 1 });
    expect([markoff.firstYear, markoff.lastYear]).toEqual([2012, 2013]);
  });

  it("folds a debater's other partnership into their best team in full, listed underneath", () => {
    const harvard = table.teams.filter((row) => row.school.startsWith("Harvard"));
    // Herman & Sanjeev (2016 title) is both debaters' best; Midha & Sanjeev (2017 Finals, 18) is not
    // Sanjeev's best, so it adds its full 18 to Herman & Sanjeev instead of getting its own row.
    expect(harvard.map((row) => [row.team, row.total])).toEqual([
      ["David Herman & Hemanth Sanjeev", r1(r1(30 * w(2016)) + 18)],
    ]);
    expect(harvard[0].parts.partners).toBe(18);
    expect(harvard[0].sidePartnerships).toEqual([
      expect.objectContaining({ team: "Ayush Midha & Hemanth Sanjeev", debater: "Hemanth Sanjeev", total: 18, credit: 18 }),
    ]);
    expect(table.teams.some((row) => row.team.includes("½"))).toBe(false);
  });

  it("gives schools every team's points plus unmatched speaker awards", () => {
    const georgetown = table.schools.find((row) => row.school.startsWith("Georgetown"))!;
    // Markoff + Doubles 3 + unlisted 8th speaker 3 (both 2013).
    expect(georgetown.total).toBe(georgetownTotal);
    expect(table.schools.map((row) => row.school)).not.toContain("Never Broke College");
  });

  it("adds each debater's high school TOC policy results, with any partner, at lower weights", () => {
    const toc = [
      { year: 2016, event: "Policy", place: "Champion", school: "Prep A (CA)", competitors: "Hemanth Sanjeev & Someone Else" },
      { year: 2016, event: "Policy", place: "Top speaker", school: "Prep A (CA)", competitors: "Hemanth Sanjeev" },
      { year: 2015, event: "Policy", place: "Runner-up", school: "Prep B (TX)", competitors: "David Herman & Third Person" },
      { year: 2015, event: "Lincoln-Douglas", place: "Champion", school: "Prep C", competitors: "David Herman" },
    ] as const;
    const row = buildNdtAllSeasons(sample, toc as never).teams.find((team) => team.school.startsWith("Harvard"))!;
    expect(row.highSchool?.map((r) => [r.year, r.place, r.debater, r.partners])).toEqual([
      [2015, "Runner-up", "David Herman", ["Third Person"]],
      [2016, "Champion", "Hemanth Sanjeev", ["Someone Else"]],
      [2016, "Top speaker", "Hemanth Sanjeev", []],
    ]);
    expect(row.parts.highSchool).toBe(r1(6 * w(2015) + 10 * w(2016) + 4 * w(2016)));
    expect(row.total).toBe(r1(r1(30 * w(2016)) + 18 + row.parts.highSchool));
  });

  it("shares ranks on equal totals", () => {
    const rows = [{ total: 10 }, { total: 10 }, { total: 5 }] as Parameters<typeof rowRanks>[0];
    expect(rowRanks(rows)).toEqual([1, 1, 3]);
  });

  it("puts the famous teams near the top of the real history", () => {
    const real = buildNdtAllSeasons(history as NdtSchoolHistory[]);
    const top = real.teams.slice(0, 10).map((row) => row.team);
    expect(top).toContain("Andrew Arsht & Andrew Markoff");
    expect(top).toContain("Alex Miles & Arjun Vellayappan");
    expect(real.schools[0].school).toBe("Northwestern University (IL)");
    expect(real.teams[0].team).toBe("Rafael Pierry & Giorgio Rabbini");
    // Pre-2000 legends drop out of the top 10 under the 0.3× legacy multiplier.
    expect(real.teams.slice(0, 10).every((row) => row.firstYear >= 2000)).toBe(true);
    // Vellayappan & Lee shows under Miles & Vellayappan, not as its own row.
    const mv = real.teams.find((row) => row.team === "Alex Miles & Arjun Vellayappan")!;
    expect(mv.sidePartnerships?.map((side) => side.team)).toContain("Peyton Lee & Arjun Vellayappan");
    expect(real.teams.map((row) => row.team)).not.toContain("Peyton Lee & Arjun Vellayappan");
    // Pierry & Rabbini pick up both TOC titles and Rabbini's top speaker award.
    const pr = real.teams.find((row) => row.team === "Rafael Pierry & Giorgio Rabbini")!;
    expect(pr.highSchool?.map((r) => [r.year, r.place, r.partners.join(" & ")])).toEqual([
      [2018, "Champion", "Dhruv Sudesh"],
      [2019, "Champion", "Nicholas Mancini"],
      [2019, "Top speaker", ""],
    ]);
  });
});

describe("NdtAllSeasonsButton", () => {
  let mounted: Mounted | null = null;
  afterEach(async () => {
    await mounted?.unmount();
    mounted = null;
  });

  it("opens a modal ranking teams, linking them to past-team pages, and highlights the school", async () => {
    mounted = await mount(<NdtAllSeasonsButton history={sample} school="Harvard University (MA)" />);
    const button = [...mounted.container.querySelectorAll("button")].find((b) => b.textContent === "All seasons")!;
    await click(button);
    const dialog = mounted.container.querySelector("dialog")!;
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.textContent).toContain("All seasons: NDT points");
    const link = [...dialog.querySelectorAll("a")].find((a) => a.textContent === "Andrew Arsht & Andrew Markoff")!;
    expect(link.getAttribute("href")).toBe("/@georgetown-arsht-markoff");
    expect(dialog.querySelectorAll("[data-own-school]").length).toBe(1);
    const sides = dialog.querySelector('[aria-label="Side partnerships"]')!;
    expect(sides.textContent).toContain("Ayush Midha & Hemanth Sanjeev");
    expect(sides.textContent).toContain("+18");
    expect(dialog.textContent).toContain("How the points work");

    const schoolsTab = [...dialog.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.startsWith("Schools"))!;
    await click(schoolsTab);
    expect(dialog.textContent).toContain("Georgetown University");
    expect(dialog.textContent).toContain(`${georgetownTotal} pts`);
  });
});
