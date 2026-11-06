// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history";
import {
  buildNdtAllSeasons,
  cleanTeamName,
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

describe("buildNdtAllSeasons", () => {
  const table = buildNdtAllSeasons(sample);

  it("keys a pair the same whichever order the names come in", () => {
    expect(ndtTeamKey("X", "A B & C D")).toBe(ndtTeamKey("X", "C D & A B (Rank: 3 )"));
    expect(cleanTeamName("Kieran Lawless & Zidao Wang (Rank: 11 )")).toBe("Kieran Lawless & Zidao Wang");
  });

  it("scores elims by deepest round, Copeland, bids and team speakers", () => {
    const markoff = table.teams[0];
    expect(markoff.team).toBe("Andrew Arsht & Andrew Markoff");
    // 2012: champion 30 (not semis too); 2013: quarters 8; Copeland 12; bid 4; top speaker 10.
    expect(markoff.parts).toEqual({ elims: 38, copeland: 12, bids: 4, speakers: 10 });
    expect(markoff.total).toBe(64);
    expect(markoff.counts).toMatchObject({ titles: 1, elims: 2, copeland: 1, bids: 1, speakerAwards: 1 });
    expect([markoff.firstYear, markoff.lastYear]).toEqual([2012, 2013]);
  });

  it("treats a debater with two partners as two teams", () => {
    const harvard = table.teams.filter((row) => row.school.startsWith("Harvard"));
    expect(harvard.map((row) => [row.team, row.total])).toEqual([
      ["David Herman & Hemanth Sanjeev", 30],
      ["Ayush Midha & Hemanth Sanjeev", 18],
    ]);
  });

  it("gives schools every team's points plus unmatched speaker awards", () => {
    const georgetown = table.schools.find((row) => row.school.startsWith("Georgetown"))!;
    // Markoff 64 + Doubles 3 + unlisted 8th speaker 3.
    expect(georgetown.total).toBe(70);
    expect(table.schools.map((row) => row.school)).not.toContain("Never Broke College");
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
    expect(dialog.querySelectorAll("[data-own-school]").length).toBe(2);
    expect(dialog.textContent).toContain("How the points work");

    const schoolsTab = [...dialog.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.startsWith("Schools"))!;
    await click(schoolsTab);
    expect(dialog.textContent).toContain("Georgetown University");
    expect(dialog.textContent).toContain("70 pts");
  });
});
