/**
 * @fileoverview Covers the same-round matcher: which uploads it treats as one
 * debate round (re-uploads, part splits, per-speech uploads) and which it must
 * keep apart. Titles and team labels are taken from real library rows.
 */
import { describe, expect, it } from "vitest";

import {
  findSameRoundPairs,
  roundPartOf,
  sameTeam,
  teamKey,
  teamsFromTitle,
  tournamentWords,
  type SameRoundFields,
} from "../src/data/same-round-matcher";
import { buildVideoStacks, type VideoStackRow } from "../src/data/video-stacks";

const DAY = 24 * 60 * 60 * 1000;

function row(overrides: Partial<VideoStackRow> & { videoId: string }): VideoStackRow {
  return {
    source: "round",
    description: "",
    publishedMs: Date.parse("2019-03-26"),
    stackKey: null,
    stackPosition: 0,
    style: 4,
    seasonYear: 2019,
    ...overrides,
  };
}

function pairs(rows: SameRoundFields[]): string[] {
  return findSameRoundPairs(rows).map((pair) => [...pair].sort().join("+"));
}

describe("teamKey / sameTeam", () => {
  it("drops side markers and judge credits", () => {
    expect(teamKey("Central Florida WU Judge: Nic Nave")).toEqual({
      code: "wu",
      hasCode: true,
      school: ["central", "florida"],
    });
    expect(teamKey("Dartmouth TV (aff)")?.school).toEqual(["dartmouth"]);
  });

  it("matches a school written longer or shorter, but never another school", () => {
    expect(sameTeam(teamKey("Berkeley SW"), teamKey("Cal Berkeley SW"))).toBe(true);
    expect(sameTeam(teamKey("Wake BM"), teamKey("Wake Forest BM"))).toBe(true);
    expect(sameTeam(teamKey("Kansas BR"), teamKey("Emory BR"))).toBe(false);
    expect(sameTeam(teamKey("Kansas BR"), teamKey("Kansas BC"))).toBe(false);
  });

  it("requires a code-less name to match in full", () => {
    expect(sameTeam(teamKey("Jane Smith"), teamKey("Jane Smith"))).toBe(true);
    expect(sameTeam(teamKey("Jane Smith"), teamKey("John Smith"))).toBe(false);
  });
});

describe("tournamentWords", () => {
  it("ignores years and filler", () => {
    expect([...tournamentWords("2017 CEDA Nats")]).toEqual(["ceda"]);
    expect([...tournamentWords("NDT 2018 Round")]).toEqual(["ndt"]);
  });
});

describe("findSameRoundPairs", () => {
  it("pairs re-uploads of one round across channels, with sides swapped", () => {
    expect(
      pairs([
        row({ videoId: "a", tournament: "NDT 2014", roundLevel: "Finals", affTeam: "Michigan AP", negTeam: "Georgetown AM" }),
        row({ videoId: "b", tournament: "2014 NDT", roundLevel: "Finals", affTeam: "Georgetown AM", negTeam: "Michigan AP" }),
      ]),
    ).toEqual(["a+b"]);
  });

  it("reads the round from the title when the column is empty", () => {
    expect(
      pairs([
        row({ videoId: "a", title: "NDT 2018 Round 4: ASU CR vs Gonzaga DW", affTeam: "ASU CR", negTeam: "Gonzaga DW" }),
        row({ videoId: "b", roundLevel: "Round 4", affTeam: "ASU CR", negTeam: "Gonzaga DW" }),
      ]),
    ).toEqual(["a+b"]);
  });

  it("keeps different rounds, tournaments and seasons apart", () => {
    const base = { affTeam: "Kansas RS", negTeam: "Emory GH" };
    expect(
      pairs([
        row({ videoId: "semis", tournament: "NDT 2024", roundLevel: "Semis", ...base }),
        row({ videoId: "r3", tournament: "NDT 2024", roundLevel: "Round 3", ...base }),
        row({ videoId: "texas", tournament: "Texas 2024", roundLevel: "Semis", ...base }),
        row({
          videoId: "later",
          tournament: "NDT 2025",
          roundLevel: "Semis",
          seasonYear: 2025,
          publishedMs: Date.parse("2019-03-26") + 365 * DAY,
          ...base,
        }),
      ]),
    ).toEqual([]);
  });

  it("only pairs unknown-round rows listed on the same sides, published close together", () => {
    const at = Date.parse("2016-04-01");
    expect(
      pairs([
        row({ videoId: "a", tournament: "NDT 2016", affTeam: "Kansas BR", negTeam: "Berkeley SW", publishedMs: at }),
        row({ videoId: "b", tournament: "NDT 2016", affTeam: "Berkeley SW", negTeam: "Kansas BR", publishedMs: at }),
        row({ videoId: "c", tournament: "2016 NDT", affTeam: "Kansas BR", negTeam: "Cal Berkeley SW", publishedMs: at + 3 * DAY }),
        row({ videoId: "d", tournament: "2016 NDT", affTeam: "Kansas BR", negTeam: "Cal Berkeley SW", publishedMs: at + 30 * DAY }),
      ]),
    ).toEqual(["a+c"]);
  });

  it("skips rows without both teams", () => {
    expect(pairs([row({ videoId: "a", affTeam: "Kansas BR" }), row({ videoId: "b", affTeam: "Kansas BR" })])).toEqual([]);
  });
});

describe("roundPartOf", () => {
  it("reads parts, speeches and decisions", () => {
    expect(roundPartOf("2025 Shirley - Finals - Emory GS vs Kansas LS - Part 2")).toEqual({ order: 12, label: "Part 2" });
    expect(roundPartOf("GSU Round 5- Harvard AM v Trinity DK (video 1/2)").label).toBe("Part 1");
    expect(roundPartOf("Georgia RS vs Kentucky BT, 2019 NDT, FINALS 2NR").label).toBe("2NR");
    expect(roundPartOf("NDT 24 — Semis — RFD — Kansas RS (AFF) vs. Emory GH (NEG)").label).toBe("Decision");
  });

  it("treats a full round as the whole round, even when it mentions a speech in an aside", () => {
    expect(roundPartOf("NDT 2019 Finals: Georgia RS vs Kentucky BT")).toEqual({ order: 0, label: null });
    expect(roundPartOf("Emory SY vs Kansas KR, Round the Seventh, NDT 2018 (with complete 2AR)").label).toBeNull();
  });
});

describe("buildVideoStacks with same-round uploads", () => {
  it("stacks per-speech uploads with the full round, in speaking order", () => {
    const teams = { affTeam: "Georgia RS", negTeam: "Kentucky BT", tournament: "NDT 2019", roundLevel: "Finals" };
    const stacks = buildVideoStacks([
      row({ videoId: "x2ar", title: "Georgia RS vs Kentucky BT, 2019 NDT, FINALS 2AR", ...teams }),
      row({ videoId: "x2nc", title: "Georgia RS vs Kentucky BT, 2019 NDT, FINALS 2NC", ...teams }),
      row({ videoId: "x1ac", title: "Georgia RS vs Kentucky BT, 2019 NDT, FINALS   1AC and 1NC", ...teams }),
      row({
        videoId: "full",
        title: "NDT 2019 Finals: Georgia RS vs Kentucky BT",
        publishedMs: Date.parse("2019-04-01"),
        ...teams,
      }),
      row({ videoId: "other", title: "NDT 2019 Semis", ...teams, roundLevel: "Semis" }),
    ]);
    expect(stacks).toEqual([{ key: "full", memberIds: ["full", "x1ac", "x2nc", "x2ar"] }]);
  });
});

describe("per-speech uploads with speech names in the team labels", () => {
  // The 2013 NDT final as it sits in the library: no tournament, no round
  // level, the speech glued onto the neg team and one "2Kansas" typo.
  const speeches: Array<[string, string, string, string]> = [
    ["5QpxgLANeRg", "2Kansas KQ vs. Northwestern FS 2AR", "2013-05-20", "2Kansas KQ"],
    ["n-3_TH6ymrg", "Kansas KQ vs. Northwestern FS 2NR", "2013-05-20", "Kansas KQ"],
    ["-n2p_sFxyls", "Kansas KQ vs. Northwestern FS 1NR", "2013-05-19", "Kansas KQ"],
    ["NfoIV7-VPac", "Kansas KQ vs. Northwestern FS 1AR", "2013-05-19", "Kansas KQ"],
    ["Y6V0240SHh8", "Kansas KQ vs. Northwestern FS 2NC", "2013-05-19", "Kansas KQ"],
    ["VfLxLz5tSAU", "Kansas KQ vs. Northwestern FS 1AC", "2013-05-17", "Kansas KQ"],
    ["wTINZL3CZUw", "Kansas KQ vs. Northwestern FS 2AC", "2013-05-17", "Kansas KQ"],
    ["yIsQiehytMk", "Kansas KQ vs. Northwestern FS 1NC", "2013-05-17", "Kansas KQ"],
  ];
  const rows = speeches.map(([videoId, title, date, aff]) =>
    row({
      videoId,
      title,
      publishedMs: Date.parse(date),
      seasonYear: 2013,
      affTeam: aff,
      negTeam: title.replace(/^.*vs\. /, ""),
      tournament: videoId === "-n2p_sFxyls" ? "Kansas KQ vs. Northwestern FS" : null,
      roundLevel: videoId === "-n2p_sFxyls" ? "1NR" : null,
    }),
  );

  it("strips the speech name and the glued speech digit from team labels", () => {
    expect(teamKey("Northwestern FS 2AR")).toEqual(teamKey("Northwestern FS"));
    expect(teamKey("2Kansas KQ")).toEqual(teamKey("Kansas KQ"));
    expect(teamKey("Kansas KQ Part 2")).toEqual(teamKey("Kansas KQ"));
    expect(teamKey("Kansas KQ Final Focus")).toEqual(teamKey("Kansas KQ"));
    // A real code that happens to be a speech-like word is never stripped alone.
    expect(teamKey("2AR")?.code).toBe("2ar");
  });

  it("stacks all eight speeches as one round, in speaking order", () => {
    const stacks = buildVideoStacks(rows);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].memberIds.map((id) => roundPartOf(rows.find((r) => r.videoId === id)?.title).label)).toEqual([
      "1AC",
      "1NC",
      "2AC",
      "2NC",
      "1NR",
      "1AR",
      "2NR",
      "2AR",
    ]);
  });

  it("falls back to the title when the team columns are empty", () => {
    expect(teamsFromTitle("2013 NDT Finals - Kansas KQ vs. Northwestern FS 1NR")).toEqual([
      "Kansas KQ",
      "Northwestern FS 1NR",
    ]);
    expect(teamsFromTitle("Lecture on topicality")).toBeNull();
    const bare = rows.map((r) => ({ ...r, affTeam: null, negTeam: null }));
    expect(buildVideoStacks(bare)).toHaveLength(1);
  });

  it("keeps a different Northwestern entry out of the stack", () => {
    const other = row({
      videoId: "otherRound1",
      title: "Kansas KQ vs. Northwestern MV 1AC",
      publishedMs: Date.parse("2013-05-18"),
      seasonYear: 2013,
      affTeam: "Kansas KQ",
      negTeam: "Northwestern MV 1AC",
    });
    const stacks = buildVideoStacks([...rows, other]);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].memberIds).not.toContain("otherRound1");
  });
});
