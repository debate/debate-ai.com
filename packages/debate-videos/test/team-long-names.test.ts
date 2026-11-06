import { describe, expect, it } from "vitest";

import {
  isInitialsTeamLabel,
  longNameToDisplay,
  parseExtinctionTeams,
  planTeamLongNames,
  resolveTeamLongName,
  resolveTeamTitleParts,
  teamDisplayNames,
  teamLongName,
  teamLongNameFormat,
  type TeamLongNameRow,
} from "../src/lib/team-long-names";

const hs2019 = [
  { school: "Strath Haven", name: "Smith & Yang" },
  { school: "Whitney Young", name: "Boss & Mohan" },
  { school: "Harker", name: "Lee & Liu" },
  { school: "Harker", name: "Lin & Lu" },
];
const hs2018 = [{ school: "Glenbrook North", name: "Adams & Brown" }];
const college2020 = [
  { school: "University of Kansas", name: "Larson & Schultz" },
  { school: "Georgetown University", name: "Ahmed & Doe" },
];

const row = (overrides: Partial<TeamLongNameRow>): TeamLongNameRow => ({
  videoId: "v1",
  style: 1,
  seasonYear: 2019,
  affTeam: null,
  negTeam: null,
  affTeamLong: null,
  negTeamLong: null,
  ...overrides,
});

describe("isInitialsTeamLabel", () => {
  it("takes a school and two initials, with a speech or round tacked on", () => {
    expect(isInitialsTeamLabel("Strath Haven YS")).toBe(true);
    expect(isInitialsTeamLabel("Kansas LS - 1AC")).toBe(true);
    expect(isInitialsTeamLabel("Kansas LSM")).toBe(false);
    expect(isInitialsTeamLabel("Boston College")).toBe(false);
    expect(isInitialsTeamLabel(null)).toBe(false);
  });
});

describe("teamLongName", () => {
  it("orders the last names the way the initials do", () => {
    expect(teamLongName("Smith & Yang", "YS")).toBe("yang-smith");
    expect(teamLongName("Smith & Yang", "SY")).toBe("smith-yang");
    expect(teamLongName("Amy Yang & Ben Smith", "YS")).toBe("yang-smith");
  });

  it("keeps the entry's order when the initials can't tell", () => {
    expect(teamLongName("Shah & Shih", "SS")).toBe("shah-shih");
  });

  it("needs two debaters", () => {
    expect(teamLongName("Siddhartha Daswani", "SD")).toBeNull();
  });
});

describe("teamLongNameFormat", () => {
  it("fills HS policy, PF and college; not LD or lectures", () => {
    expect(teamLongNameFormat(1)).toBe("hspolicy");
    expect(teamLongNameFormat(2)).toBe("hspf");
    expect(teamLongNameFormat(4)).toBe("collegepolicy");
    expect(teamLongNameFormat(3)).toBeNull();
    expect(teamLongNameFormat(null)).toBeNull();
  });
});

describe("resolveTeamLongName", () => {
  it("finds the team in its season's rankings", () => {
    expect(resolveTeamLongName("hspolicy", "Strath Haven YS", [[hs2019]])).toBe("yang-smith");
  });

  it("falls back to the season before", () => {
    expect(resolveTeamLongName("hspolicy", "Glenbrook North AB", [[hs2019], [hs2018]])).toBe("adams-brown");
  });

  it("leaves a code two teams of one school share unresolved", () => {
    expect(resolveTeamLongName("hspolicy", "Harker LL", [[hs2019]])).toBeNull();
  });

  it("reads college shorthand for the school", () => {
    expect(resolveTeamLongName("collegepolicy", "KU LS", [[college2020]])).toBe("larson-schultz");
    expect(resolveTeamLongName("collegepolicy", "Gtown AD", [[[], college2020]])).toBe("ahmed-doe");
  });

  it("ignores labels that aren't two initials", () => {
    expect(resolveTeamLongName("hspolicy", "Strath Haven", [[hs2019]])).toBeNull();
  });
});

describe("parseExtinctionTeams", () => {
  it("splits each SchoolTeamCode into school and last names", () => {
    const body = JSON.stringify({
      attribution: "x",
      teams: JSON.stringify([
        { SchoolTeamCode: "Whitney Young BM: Boss & Mohan", FullName1: "A Boss", FullName2: "B Mohan", OverallELO: "1900" },
        { SchoolTeamCode: "Lone School", FullName1: "Cat Doe", FullName2: "Eve Fox", OverallELO: "1500" },
        { nope: true },
      ]),
    });
    expect(parseExtinctionTeams(body)).toEqual([
      { school: "Whitney Young", name: "Boss & Mohan", rank: 1 },
      { school: "Lone School", name: "Cat Doe & Eve Fox", rank: 2 },
    ]);
  });

  it("gives nothing for a malformed body", () => {
    expect(parseExtinctionTeams("not json")).toEqual([]);
    expect(parseExtinctionTeams(JSON.stringify({ teams: 3 }))).toEqual([]);
  });
});

describe("planTeamLongNames", () => {
  it("fills empty sides and keeps stored ones", () => {
    const rows = [
      row({ videoId: "a", affTeam: "Strath Haven YS", negTeam: "Whitney Young BM" }),
      row({ videoId: "b", affTeam: "Strath Haven YS", affTeamLong: "custom", negTeam: "Nowhere ZZ" }),
    ];
    expect(planTeamLongNames(rows, "hspolicy", [[hs2019]])).toEqual([
      { videoId: "a", affTeamLong: "yang-smith", negTeamLong: "boss-mohan" },
    ]);
  });

  it("re-resolves stored sides when overwriting, skipping no-op writes", () => {
    const rows = [
      row({ videoId: "a", affTeam: "Strath Haven YS", affTeamLong: "custom" }),
      row({ videoId: "b", affTeam: "Strath Haven YS", affTeamLong: "yang-smith" }),
    ];
    expect(planTeamLongNames(rows, "hspolicy", [[hs2019]], true)).toEqual([{ videoId: "a", affTeamLong: "yang-smith" }]);
  });
});

describe("teamDisplayNames / longNameToDisplay", () => {
  it("orders the last names by the code's initials, keeping their case", () => {
    expect(teamDisplayNames("Smith & Yang", "YS")).toBe("Yang & Smith");
    expect(teamDisplayNames("Ana McDonald & Bo Ortiz", "MO")).toBe("McDonald & Ortiz");
    expect(teamDisplayNames("Solo", "SO")).toBeNull();
  });

  it("title-cases a stored long name", () => {
    expect(longNameToDisplay("yang-smith")).toBe("Yang & Smith");
    expect(longNameToDisplay("a-b-c")).toBeNull();
    expect(longNameToDisplay(null)).toBeNull();
  });
});

describe("resolveTeamTitleParts", () => {
  const ranked = [
    { school: "Strath Haven", name: "Smith & Yang", rank: 4 },
    { school: "Whitney Young", name: "Boss & Mohan", rank: 1 },
  ];

  it("takes names and rank from the video's own season", () => {
    expect(resolveTeamTitleParts("hspolicy", "Strath Haven YS", [[ranked], []])).toEqual({ names: "Yang & Smith", rank: 4 });
  });

  it("takes only names from the season before", () => {
    expect(resolveTeamTitleParts("hspolicy", "Whitney Young BM", [[], [ranked]])).toEqual({ names: "Boss & Mohan", rank: null });
  });

  it("knows nothing about an unknown or code-less team", () => {
    expect(resolveTeamTitleParts("hspolicy", "Nowhere ZZ", [[ranked]])).toEqual({ names: null, rank: null });
    expect(resolveTeamTitleParts("hspolicy", "Boston College", [[ranked]])).toEqual({ names: null, rank: null });
  });
});
