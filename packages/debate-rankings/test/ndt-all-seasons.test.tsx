// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history";
import {
  buildNdtAllSeasons,
  cleanTeamName,
  ndtTeamKey,
  HS_NDCA_POINTS,
  highSchoolIndex,
  highSchoolPlaceLabel,
  hsNdcaPoints,
  NDT_POINTS_MULTIPLIERS,
  ndtEraMultiplier,
  rowRanks,
} from "../src/leaderboard/profile/ndtAllSeasons";
import {
  findNdcaSchoolRecord,
  NDCA_FINISH_YEARS,
  NDCA_PLACES_YEARS,
  NDCA_POLICY_PLACES,
  NDCA_POLICY_RESULTS,
  ndcaPlaceLabel,
} from "../src/sync/ndca-champions";
import { NdtAllSeasonsButton } from "../src/leaderboard/profile/NdtAllSeasonsDialog";
import history from "../data/ndt-school-history.json";
import { click, flush, mount, type Mounted } from "./helpers/mount";

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

// Every season counts the same: Markoff 2012 title 30; 2013 quarters 8, Copeland 12 × 1.5, bid 4, top speaker 10,
// plus Doubles 3 and an unlisted 8th speaker 3.
const georgetownTotal = 30 + 8 + 18 + 4 + 10 + 3 + 3;

describe("buildNdtAllSeasons", () => {
  const table = buildNdtAllSeasons(sample, [], []);

  it("weights the parts E + 1.5C + B + S + 0.25O + 0.5H", () => {
    expect(NDT_POINTS_MULTIPLIERS).toEqual({ elims: 1, copeland: 1.5, bids: 1, speakers: 1, partners: 0.25, highSchool: 0.5 });
  });

  it("counts results from seasons before 2000 at 0.6×, season by season", () => {
    expect([ndtEraMultiplier(1999), ndtEraMultiplier(2000)]).toEqual([0.6, 1]);
    const old = buildNdtAllSeasons(
      [
        school("Old College", {
          championships: [{ year: 1999, team: "Ann Old & Bea Old" }],
          elims: [{ year: 2000, team: "Ann Old & Bea Old", round: "Finals" }],
          copelandWinners: [{ year: 1999, team: "Ann Old & Bea Old" }],
        }),
      ],
      [{ year: 1996, event: "Policy", place: "Champion", school: "Prep", competitors: "Ann Old & Someone" }] as never,
      [],
    ).teams[0];
    // 1999 title 30 × 0.6 = 18, 2000 Finals 18 in full; Copeland 12 × 1.5 × 0.6; 1996 TOC title 10 × 0.5 × 0.6.
    expect(old.parts).toMatchObject({ elims: 36, copeland: 10.8, highSchool: 3 });
    expect(old.total).toBe(36 + 10.8 + 3);
  });

  it("keys a pair the same whichever order the names come in", () => {
    expect(ndtTeamKey("X", "A B & C D")).toBe(ndtTeamKey("X", "C D & A B (Rank: 3 )"));
    expect(cleanTeamName("Kieran Lawless & Zidao Wang (Rank: 11 )")).toBe("Kieran Lawless & Zidao Wang");
  });

  it("scores elims by deepest round, Copeland, bids and team speakers", () => {
    const markoff = table.teams[0];
    expect(markoff.team).toBe("Andrew Arsht & Andrew Markoff");
    // 2012: champion 30 (not semis too); 2013: quarters 8; Copeland 12 × 1.5; bid 4; top speaker 10 — every season counts the same.
    expect(markoff.parts).toEqual({
      elims: 38,
      copeland: 18,
      bids: 4,
      speakers: 10,
      partners: 0,
      highSchool: 0,
    });
    expect(markoff.total).toBe(70);
    expect(markoff.counts).toMatchObject({ titles: 1, elims: 2, copeland: 1, bids: 1, speakerAwards: 1 });
    expect([markoff.firstYear, markoff.lastYear]).toEqual([2012, 2013]);
  });

  it("folds a quarter of a debater's other partnership into their best team, listed underneath", () => {
    const harvard = table.teams.filter((row) => row.school.startsWith("Harvard"));
    // Herman & Sanjeev (2016 title) is both debaters' best; Midha & Sanjeev (2017 Finals, 18) is not
    // Sanjeev's best, so it adds a quarter of its 18 to Herman & Sanjeev instead of getting its own row.
    expect(harvard.map((row) => [row.team, row.total])).toEqual([
      ["David Herman & Hemanth Sanjeev", 34.5],
    ]);
    expect(harvard[0].parts.partners).toBe(4.5);
    expect(harvard[0].sidePartnerships).toEqual([
      expect.objectContaining({ team: "Ayush Midha & Hemanth Sanjeev", debater: "Hemanth Sanjeev", total: 18, credit: 4.5 }),
    ]);
    expect(table.teams.some((row) => row.team.includes("½"))).toBe(false);
  });

  it("ranks every partnership strictly on its own NDT results", () => {
    const strict = table.strictTeams.filter((row) => row.school.startsWith("Harvard"));
    // Midha & Sanjeev gets its own row, and Herman & Sanjeev keeps only its title.
    expect(strict.map((row) => [row.team, row.total, row.parts.partners])).toEqual([
      ["David Herman & Hemanth Sanjeev", 30, 0],
      ["Ayush Midha & Hemanth Sanjeev", 18, 0],
    ]);
    expect(strict.every((row) => !row.sidePartnerships && !row.highSchool)).toBe(true);
  });

  it("ranks debaters on every partnership in full and only their own speaker awards", () => {
    const sanjeev = table.debaters.find((row) => row.team === "Hemanth Sanjeev")!;
    expect(sanjeev.total).toBe(30 + 18);
    expect(sanjeev.sidePartnerships?.map((side) => [side.team, side.credit])).toEqual([
      ["David Herman & Hemanth Sanjeev", 30],
      ["Ayush Midha & Hemanth Sanjeev", 18],
    ]);
    // Markoff's top speaker award is his, not Arsht's.
    const markoff = table.debaters.find((row) => row.team === "Andrew Markoff")!;
    const arsht = table.debaters.find((row) => row.team === "Andrew Arsht")!;
    expect([markoff.parts.speakers, arsht.parts.speakers]).toEqual([10, 0]);
    expect(markoff.total).toBe(38 + 18 + 4 + 10);
    expect(table.debaters.map((row) => row.team)).not.toContain("Nobody Listed");
  });

  it("gives schools every team's points plus unmatched speaker awards", () => {
    const georgetown = table.schools.find((row) => row.school.startsWith("Georgetown"))!;
    // Markoff + Doubles 3 + unlisted 8th speaker 3 (both 2013).
    expect(georgetown.total).toBe(georgetownTotal);
    expect(table.schools.map((row) => row.school)).not.toContain("Never Broke College");
  });

  it("adds each debater's high school TOC policy results, with any partner, at half weight", () => {
    const toc = [
      { year: 2016, event: "Policy", place: "Champion", school: "Prep A (CA)", competitors: "Hemanth Sanjeev & Someone Else" },
      { year: 2016, event: "Policy", place: "Top speaker", school: "Prep A (CA)", competitors: "Hemanth Sanjeev" },
      { year: 2015, event: "Policy", place: "Runner-up", school: "Prep B (TX)", competitors: "David Herman & Third Person" },
      { year: 2015, event: "Lincoln-Douglas", place: "Champion", school: "Prep C", competitors: "David Herman" },
    ] as const;
    const row = buildNdtAllSeasons(sample, toc as never, []).teams.find((team) => team.school.startsWith("Harvard"))!;
    expect(row.highSchool?.map((r) => [r.tournament, r.year, r.place, r.debater, r.partners])).toEqual([
      ["TOC", 2015, "Runner-up", "David Herman", ["Third Person"]],
      ["TOC", 2016, "Champion", "Hemanth Sanjeev", ["Someone Else"]],
      ["TOC", 2016, "Top speaker", "Hemanth Sanjeev", []],
    ]);
    // Runner-up 6 + champion 10 + top speaker 4, halved.
    expect(row.parts.highSchool).toBe(10);
    expect(row.total).toBe(34.5 + 10);
  });

  it("adds NDCA national championship policy titles and top speakers like TOC ones", () => {
    const ndca = [
      { year: 2010, place: "Champion", school: "Bronx Science", competitors: "Zack Elias & Andrew Markoff" },
      { year: 2010, place: "Top speaker", school: "Kinkaid", competitors: "Andrew Arsht" },
    ] as const;
    const row = buildNdtAllSeasons(sample, [], ndca as never).teams[0];
    expect(row.team).toBe("Andrew Arsht & Andrew Markoff");
    expect(row.highSchool?.map((r) => [r.tournament, r.year, r.place, r.debater, r.partners, r.points])).toEqual([
      ["NDCA", 2010, "Top speaker", "Andrew Arsht", [], HS_NDCA_POINTS["Top speaker"] / 2],
      ["NDCA", 2010, "Champion", "Andrew Markoff", ["Zack Elias"], HS_NDCA_POINTS.Champion / 2],
    ]);
    expect(row.parts.highSchool).toBe(7);
    expect(row.total).toBe(70 + 7);
  });

  it("keeps the bundled NDCA list to policy champions and top speakers since 2006", () => {
    expect(NDCA_POLICY_RESULTS.every((r) => r.year >= 2006 && r.year !== 2020)).toBe(true);
    expect(NDCA_POLICY_RESULTS.filter((r) => r.place === "Top speaker").length).toBe(20);
    expect(NDCA_POLICY_RESULTS).toContainEqual(
      expect.objectContaining({ year: 2010, place: "Champion", competitors: "Zack Elias & Andrew Markoff" }),
    );
  });

  it("scores NDCA elimination finishes and speaker places on the TOC/NDCA scale", () => {
    expect(hsNdcaPoints({ place: "Finalist" })).toBe(6);
    expect(hsNdcaPoints({ place: "Semifinalist" })).toBe(4);
    expect(hsNdcaPoints({ place: "Quarterfinalist" })).toBe(2.5);
    expect(hsNdcaPoints({ place: "Octafinalist" })).toBe(1.5);
    expect(hsNdcaPoints({ place: "Speaker", rank: 5 })).toBe(2);
    expect(hsNdcaPoints({ place: "Speaker", rank: 6 })).toBe(1);
    expect(hsNdcaPoints({ place: "Speaker", rank: 15 })).toBe(0.5);
    expect(hsNdcaPoints({ place: "Champion" })).toBe(HS_NDCA_POINTS.Champion);
    const ndca = [
      { year: 2006, place: "Quarterfinalist", school: "Glenbrook North", competitors: "Matt Fisher & Stephanie Spies" },
      { year: 2006, place: "Speaker", rank: 5, school: "Glenbrook North", competitors: "Matt Fisher" },
    ] as const;
    const lookup = highSchoolIndex([], ndca as never);
    expect(lookup("Matt Fisher").map((r) => [r.year, highSchoolPlaceLabel(r), r.partners, r.points])).toEqual([
      [2006, "quarterfinalist", ["Stephanie Spies"], 1.25],
      [2006, "5th speaker", [], 1],
    ]);
  });

  it("matches a high school spelling to the NDT's for the same debater", () => {
    const lookup = highSchoolIndex([], [
      { year: 2012, place: "Speaker", rank: 5, school: "H-F", competitors: "Margaret Strong" },
      { year: 2006, place: "Octafinalist", school: "RHSM", competitors: "Chase Burton & Guz Eyzaguirre" },
    ]);
    expect(lookup("Marge Strong").map(highSchoolPlaceLabel)).toEqual(["5th speaker"]);
    expect(lookup("Gustavo Eyzaguirre").map((r) => r.partners)).toEqual([["Chase Burton"]]);
  });

  it("bundles NDCA elim finishes (no seeds) and 2006–2012 speakers, with no 2010 and names reconciled", () => {
    expect(NDCA_PLACES_YEARS).not.toContain(2010);
    const finishes = NDCA_POLICY_PLACES.filter((r) => r.place !== "Speaker");
    expect(new Set(finishes.map((r) => r.year))).toEqual(new Set(NDCA_FINISH_YEARS));
    expect(NDCA_FINISH_YEARS).toEqual([2006, 2009, 2011, 2012]);
    // 2006: Georgetown Day's close-out, then 2 semifinalists, 4 quarterfinalists, 4 octafinalists.
    const in2006 = (place: string) => finishes.filter((r) => r.year === 2006 && r.place === place).length;
    expect(["Finalist", "Semifinalist", "Quarterfinalist", "Octafinalist"].map(in2006)).toEqual([0, 2, 4, 4]);
    for (const year of [2009, 2011, 2012]) {
      expect(finishes.filter((r) => r.year === year).map((r) => r.place)).toEqual(["Finalist"]);
    }
    for (const year of NDCA_PLACES_YEARS) {
      const speakers = NDCA_POLICY_PLACES.filter((r) => r.year === year && r.place === "Speaker").map((r) => r.rank);
      expect(speakers).toEqual(Array.from({ length: 14 }, (_, i) => i + 2));
    }
    const names = [...NDCA_POLICY_PLACES, ...NDCA_POLICY_RESULTS].flatMap((r) => r.competitors.split(" & "));
    for (const variant of ["Shezaad Zainulbhi", "Azahar Unwala", "Azhar Unvala", "Rahim Shakoo", "Ana Dimetrejevic", "Geoffery Stone"]) {
      expect(names).not.toContain(variant);
    }
    expect(ndcaPlaceLabel({ place: "Quarterfinalist" })).toBe("Quarterfinalist");
    expect(ndcaPlaceLabel({ place: "Speaker", rank: 13 })).toBe("13th speaker");
  });

  it("finds a high school's NDCA record across the history page's and the bracket's spellings", () => {
    const westminster = findNdcaSchoolRecord("The Westminster Schools (GA)")!;
    expect(westminster.titles).toBeGreaterThanOrEqual(3);
    expect(westminster.results).toContainEqual(
      expect.objectContaining({ year: 2011, place: "Finalist", competitors: "Ellis Allen & Daniel Taylor" }),
    );
    expect(findNdcaSchoolRecord("Glenbrook North")?.elimFinishes).toBe(1);
    expect(findNdcaSchoolRecord("Nowhere High School")).toBeNull();
  });

  it("notes the high school partner and finish for NDT teams in the real history", () => {
    const real = buildNdtAllSeasons(history as NdtSchoolHistory[]);
    const fs = real.teams.find((row) => row.team === "Matt Fisher & Stephanie Spies")!;
    expect(
      fs.highSchool?.filter((r) => r.tournament === "NDCA").map((r) => [r.year, r.debater, highSchoolPlaceLabel(r), r.partners.join(" & ")]),
    ).toEqual([
      [2006, "Matt Fisher", "quarterfinalist", "Stephanie Spies"],
      [2006, "Matt Fisher", "5th speaker", ""],
      [2006, "Stephanie Spies", "quarterfinalist", "Matt Fisher"],
      [2007, "Matt Fisher", "5th speaker", ""],
      [2007, "Stephanie Spies", "14th speaker", ""],
    ]);
    const allen = real.teams.find((row) => row.team === "Ellis Allen & Alex Pappas")!;
    expect(allen.highSchool).toContainEqual(
      expect.objectContaining({ tournament: "NDCA", year: 2011, place: "Finalist", debater: "Ellis Allen", partners: ["Daniel Taylor"] }),
    );
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
    expect(real.teams[0].team).toBe("Andrew Arsht & Andrew Markoff");
    // A partnership's own results lead: Arsht & Markoff and Miles & Vellayappan rank first, and Branson &
    // Morales (whose 97 side points add 25.75) below. Fisher & Spies's 2006 NDCA quarterfinal and speaker places
    // lift them half a point past Pierry & Rabbini.
    const five = [
      "Andrew Arsht & Andrew Markoff",
      "Alex Miles & Arjun Vellayappan",
      "Matt Fisher & Stephanie Spies",
      "Rafael Pierry & Giorgio Rabbini",
      "Josh Branson & Tristan Morales",
    ];
    expect(real.teams.map((row) => row.team).filter((team) => five.includes(team))).toEqual(five);
    // Pre-2000 seasons count 0.6×, so the top ten are all teams that debated after 2000.
    expect(real.teams.slice(0, 10).every((row) => row.lastYear >= 2000)).toBe(true);
    const gs = real.teams.find((row) => row.team === "Michael Gottlieb & Ryan Sparacino")!;
    expect(gs.lastYear).toBeLessThan(2000);
    // Markoff's 2010 NDCA title (with Zack Elias) now counts for Arsht & Markoff.
    const am = real.teams.find((row) => row.team === "Andrew Arsht & Andrew Markoff")!;
    expect(am.highSchool?.map((r) => [r.tournament, r.year, r.place])).toEqual([["NDCA", 2010, "Champion"]]);
    // Vellayappan & Lee shows under Miles & Vellayappan, not as its own row.
    const mv = real.teams.find((row) => row.team === "Alex Miles & Arjun Vellayappan")!;
    expect(mv.sidePartnerships?.map((side) => side.team)).toContain("Peyton Lee & Arjun Vellayappan");
    expect(real.teams.map((row) => row.team)).not.toContain("Peyton Lee & Arjun Vellayappan");
    // Pierry & Rabbini pick up both TOC titles, Rabbini's TOC top speaker award, and his NDCA title and top speaker.
    const pr = real.teams.find((row) => row.team === "Rafael Pierry & Giorgio Rabbini")!;
    expect(pr.highSchool?.map((r) => [r.tournament, r.year, r.place, r.partners.join(" & ")])).toEqual([
      ["NDCA", 2018, "Champion", "Nicholas Mancini"],
      ["TOC", 2018, "Champion", "Dhruv Sudesh"],
      ["NDCA", 2019, "Top speaker", ""],
      ["TOC", 2019, "Champion", "Nicholas Mancini"],
      ["TOC", 2019, "Top speaker", ""],
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
    expect(sides.textContent).toContain("+4.5");
    expect(dialog.textContent).toContain("How the points work");

    const picker = dialog.querySelector<HTMLSelectElement>('select[aria-label="Rank by"]')!;
    await flush(() => {
      picker.value = "debaters";
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(dialog.textContent).toContain("Debaters (");
    const lists = [...dialog.querySelectorAll('[aria-label="Partnerships"]')].map((list) => list.textContent).join(" ");
    expect(lists).toContain("David Herman & Hemanth Sanjeev");
    await flush(() => {
      picker.value = "strict";
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(dialog.querySelector('[aria-label="Side partnerships"]')).toBeNull();
    expect([...dialog.querySelectorAll("a")].map((a) => a.textContent)).toContain("Ayush Midha & Hemanth Sanjeev");

    const schoolsTab = [...dialog.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.startsWith("Schools"))!;
    await click(schoolsTab);
    expect(dialog.textContent).toContain("Georgetown University");
    expect(dialog.textContent).toContain(`${georgetownTotal} pts`);
    // School rows carry the school's logo beside the name; the name stays the link text.
    const georgetown = [...dialog.querySelectorAll("a")].find((a) => a.textContent === "Georgetown University")!;
    expect(georgetown.querySelector("img, svg")).not.toBeNull();
    const never = [...dialog.querySelectorAll("a")].find((a) => a.textContent === "Never Broke College");
    expect(never?.querySelector("img, svg") ?? null).toBeNull();
  });
});
